from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
from rest_framework import serializers

from .models import (
    Category,
    DiscountCode,
    Order,
    OrderItem,
    Product,
    ProductImage,
    shipping_cost_for,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text']


class ProductSerializer(serializers.ModelSerializer):
    categories = CategorySerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    # Taglie tra cui il cliente può scegliere (dipendono da size_type)
    available_sizes = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'price', 'size_type', 'available_sizes',
            'color', 'stock', 'categories', 'images',
        ]


class OrderItemInputSerializer(serializers.Serializer):
    # Dal browser arrivano solo id, taglia e quantità: il prezzo si legge sempre dal database
    product_id = serializers.IntegerField()
    size = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)


class DiscountCheckSerializer(serializers.Serializer):
    """Controlla un codice sconto per mostrare al cliente lo sconto prima dell'ordine."""

    code = serializers.CharField(max_length=50)
    items = OrderItemInputSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        items = attrs['items']
        products = Product.objects.in_bulk({item['product_id'] for item in items})
        missing = sorted({i['product_id'] for i in items if i['product_id'] not in products})
        if missing:
            raise serializers.ValidationError(
                {'items': [f'Il prodotto {product_id} non esiste.' for product_id in missing]}
            )

        # Importo degli articoli calcolato sui prezzi del database
        subtotal = sum(products[item['product_id']].price * item['quantity'] for item in items)

        discount = DiscountCode.objects.filter(
            code=DiscountCode.normalize(attrs['code'])
        ).first()
        problem = discount.problem(subtotal) if discount else 'Codice sconto non valido.'
        if problem:
            raise serializers.ValidationError({'code': [problem]})

        discount_amount = discount.discount_for(subtotal)
        goods = subtotal - discount_amount
        shipping = shipping_cost_for(goods)
        # Gli importi escono come testo con 2 decimali ("159.80"), come negli ordini: mai come numeri decimali
        attrs['result'] = {
            'code': discount.code,
            'percent': discount.percent,
            'subtotal': f'{subtotal:.2f}',
            'discount_amount': f'{discount_amount:.2f}',
            'shipping_cost': f'{shipping:.2f}',
            'total': f'{goods + shipping:.2f}',
        }
        return attrs


class OrderCreateSerializer(serializers.Serializer):
    """Crea un ordine. La logica sta in create() e non in una view perché deve essere
    atomica e testabile senza passare da HTTP."""

    items = OrderItemInputSerializer(many=True, allow_empty=False)
    # Facoltativo: il codice si riverifica sempre qui, anche se il carrello l'aveva già controllato
    discount_code = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def create(self, validated_data):
        items = validated_data['items']
        code = DiscountCode.normalize(validated_data.get('discount_code', ''))

        # Tutto o niente: se un errore interrompe il blocco, anche lo stock già ridotto
        # e l'utilizzo del codice sconto tornano com'erano
        with transaction.atomic():
            # Blocca le righe dei prodotti coinvolti (SQLite lo ignora: blocca l'intero database in scrittura)
            products = Product.objects.select_for_update().in_bulk(
                {item['product_id'] for item in items}
            )

            errors = []
            # Quantità totale richiesta per prodotto: la stessa felpa in M e in XL consuma lo stesso stock
            requested = defaultdict(int)
            for item in items:
                product = products.get(item['product_id'])
                if product is None:
                    errors.append(f"Il prodotto {item['product_id']} non esiste.")
                elif item['size'] not in product.available_sizes:
                    errors.append(
                        f"La taglia {item['size']} non è disponibile per \"{product.name}\"."
                    )
                else:
                    requested[product.pk] += item['quantity']
            if errors:
                raise serializers.ValidationError({'items': errors})

            # Controllo "gentile" per dare al cliente un messaggio chiaro; la garanzia contro
            # gli ordini simultanei è l'UPDATE condizionale più sotto
            for product_id, quantity in requested.items():
                product = products[product_id]
                if quantity > product.stock:
                    errors.append(
                        f"\"{product.name}\": disponibili {product.stock}, richiesti {quantity}."
                    )
            if errors:
                raise serializers.ValidationError({'items': errors})

            # Il totale si calcola dai prezzi del database, mai da dati inviati dal browser
            subtotal = sum(
                products[item['product_id']].price * item['quantity'] for item in items
            )

            discount = None
            if code:
                discount = DiscountCode.objects.select_for_update().filter(code=code).first()
                problem = discount.problem(subtotal) if discount else 'Codice sconto non valido.'
                if problem:
                    raise serializers.ValidationError({'discount_code': [problem]})

            # UPDATE condizionale: riduce lo stock solo se basta ancora, anche se due ordini arrivano insieme
            for product_id, quantity in requested.items():
                updated = Product.objects.filter(
                    pk=product_id, stock__gte=quantity
                ).update(stock=F('stock') - quantity)
                if not updated:
                    raise serializers.ValidationError(
                        {'items': [f"\"{products[product_id].name}\": stock esaurito nel frattempo."]}
                    )

            # Stesso principio per il codice: conta l'utilizzo solo se ce ne sono ancora a disposizione
            if discount:
                consumed = DiscountCode.objects.filter(pk=discount.pk).filter(
                    Q(max_uses__isnull=True) | Q(times_used__lt=F('max_uses'))
                ).update(times_used=F('times_used') + 1)
                if not consumed:
                    raise serializers.ValidationError(
                        {'discount_code': ['Questo codice sconto è esaurito.']}
                    )

            discount_amount = discount.discount_for(subtotal) if discount else Decimal('0.00')
            # La spedizione si calcola sull'importo degli articoli dopo lo sconto
            goods = subtotal - discount_amount
            shipping = shipping_cost_for(goods)
            order = Order.objects.create(
                total=goods + shipping,
                discount_code=discount.code if discount else '',
                discount_amount=discount_amount,
                shipping_cost=shipping,
            )
            # unit_price copia il prezzo di oggi: lo storico non cambia se il listino cambia
            OrderItem.objects.bulk_create([
                OrderItem(
                    order=order,
                    product=products[item['product_id']],
                    size=item['size'],
                    quantity=item['quantity'],
                    unit_price=products[item['product_id']].price,
                )
                for item in items
            ])
        return order


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['product', 'product_name', 'size', 'quantity', 'unit_price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    # Importo degli articoli prima dello sconto
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'created_at', 'subtotal', 'discount_code', 'discount_amount',
            'shipping_cost', 'total', 'items',
        ]

    def get_subtotal(self, order):
        # Non è una colonna: si ricava dagli altri importi per non tenere dati ridondanti da sincronizzare
        return order.total + order.discount_amount - order.shipping_cost
