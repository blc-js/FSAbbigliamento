from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

# Spedizione: costo fisso, gratuita se gli articoli (dopo l'eventuale sconto) superano la soglia
SHIPPING_COST = Decimal('10.00')
FREE_SHIPPING_ABOVE = Decimal('50.00')


def shipping_cost_for(goods_total):
    """Costo di spedizione per un ordine con questo importo di articoli (già scontato)."""
    return Decimal('0.00') if goods_total > FREE_SHIPPING_ABOVE else SHIPPING_COST


class Category(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    SHOE_SIZES = [str(n) for n in range(38, 46)]

    SIZE_TYPE_CHOICES = [
        ('clothing', 'Abbigliamento'),
        ('shoes', 'Scarpe'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(
        max_digits=8, decimal_places=2, validators=[MinValueValidator(0)]
    )
    # TODO (ottimizzazione futura): per la demo lo stock è unico per prodotto e la
    # taglia si sceglie solo all'acquisto (size_type dice quali taglie sono ammesse).
    # Per avere uno stock per ogni taglia serve un modello ProductVariant (una riga
    # per taglia, ognuna col proprio stock). In alternativa si può spostare
    # size_type sulla Category.
    size_type = models.CharField(
        max_length=10, choices=SIZE_TYPE_CHOICES, default='clothing'
    )
    color = models.CharField(max_length=30)
    stock = models.PositiveIntegerField(default=30)
    categories = models.ManyToManyField(Category, related_name='products', blank=True)

    @property
    def available_sizes(self):
        return self.CLOTHING_SIZES if self.size_type == 'clothing' else self.SHOE_SIZES

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, related_name='images', on_delete=models.CASCADE
    )
    image = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f'{self.product.name} - immagine {self.pk}'


class DiscountCode(models.Model):
    code = models.CharField(max_length=30, unique=True)
    percent = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text='Percentuale di sconto sul totale degli articoli (da 1 a 100).',
    )
    active = models.BooleanField(default=True)
    max_uses = models.PositiveIntegerField(
        null=True, blank=True, help_text='Quante volte si può usare in totale. Vuoto = illimitato.'
    )
    # Cresce a ogni ordine che usa il codice (lo aggiorna solo il backend)
    times_used = models.PositiveIntegerField(default=0, editable=False)
    min_order = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text='Importo minimo degli articoli per usare il codice. Vuoto = nessun minimo.',
    )

    @staticmethod
    def normalize(code):
        # I codici non distinguono maiuscole e minuscole né spazi attorno
        return code.strip().upper()

    def save(self, *args, **kwargs):
        self.code = self.normalize(self.code)
        super().save(*args, **kwargs)

    def problem(self, subtotal):
        """Motivo per cui il codice non si può usare con questo importo, oppure None se va bene."""
        if not self.active:
            return 'Codice sconto non valido.'
        if self.max_uses is not None and self.times_used >= self.max_uses:
            return 'Questo codice sconto è esaurito.'
        if self.min_order is not None and subtotal < self.min_order:
            minimum = f'{self.min_order:.2f}'.replace('.', ',')
            return f'Il codice vale per ordini di almeno {minimum} €.'
        return None

    def discount_for(self, subtotal):
        """Importo dello sconto, arrotondato al centesimo."""
        return (subtotal * self.percent / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def __str__(self):
        return f'{self.code} (-{self.percent}%)'


class Order(models.Model):
    # Demo: non si salvano dati personali del cliente, solo l'ordine e il totale
    created_at = models.DateTimeField(auto_now_add=True)
    # Totale finale: totale = somma degli articoli - sconto + spedizione
    total = models.DecimalField(max_digits=10, decimal_places=2)
    # Codice usato (testo, non collegamento: lo storico resta anche se il codice viene eliminato)
    discount_code = models.CharField(max_length=30, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    def __str__(self):
        return f'Ordine #{self.pk}'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    # PROTECT: un prodotto già acquistato non si può eliminare, per non perdere lo storico
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    size = models.CharField(max_length=3)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Prezzo al momento dell'acquisto: non cambia se il prezzo del prodotto viene modificato
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f'{self.quantity} x {self.product.name} ({self.size})'
