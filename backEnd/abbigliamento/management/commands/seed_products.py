from django.conf import settings
from django.core.management.base import BaseCommand

from abbigliamento.models import Category, DiscountCode, Product, ProductImage

# Categorie del negozio (slug, nome). Se esistono già non si toccano.
CATEGORIES = [
    ('felpe', 'Felpe'),
    ('magliette', 'Magliette'),
    ('nuovi-arrivi', 'Nuovi Arrivi'),
    ('pantaloni', 'Pantaloni'),
    ('giacche', 'Giacche'),
    ('scarpe', 'Scarpe'),
]

# image: prefisso dei file in media/ (es. "felpa1" -> felpa1.jpg e felpa1.1.jpg)
PRODUCTS = [
    # Felpe
    {'name': 'Felpa in pile Alpine', 'color': 'Verde oliva', 'price': '79.90',
     'size_type': 'clothing', 'image': 'felpa1',
     'categories': ['felpe', 'nuovi-arrivi'],
     'description': 'Felpa con cappuccio in morbido pile sherpa, tasca a marsupio e logo montagna-sole sul petto.'},
    {'name': 'Felpa zip Palma a maniche corte', 'color': 'Verde militare', 'price': '64.90',
     'size_type': 'clothing', 'image': 'felpa2',
     'categories': ['felpe'],
     'description': 'Felpa con cappuccio e zip integrale a maniche corte, tasche laterali, taschino con zip sulla manica e palma ricamata sul petto.'},
    {'name': 'Felpa zip Compass', 'color': 'Grigio', 'price': '54.90',
     'size_type': 'clothing', 'image': 'felpa3',
     'categories': ['felpe'],
     'description': 'Felpa con cappuccio e zip integrale, rosa dei venti stampata sul petto, tasca a marsupio e passapollice ai polsini.'},
    # Giacche
    {'name': 'Giacca softshell Ridge', 'color': 'Antracite', 'price': '119.90',
     'size_type': 'clothing', 'image': 'giacca1',
     'categories': ['giacche', 'nuovi-arrivi'],
     'description': 'Giacca softshell antivento con zip a tutta lunghezza, dettagli riflettenti e inserti traspiranti.'},
    {'name': 'Giacca Horizon con cappuccio', 'color': 'Verde salvia', 'price': '99.90',
     'size_type': 'clothing', 'image': 'giacca2',
     'categories': ['giacche'],
     'description': 'Giacca tecnica con cappuccio e zip integrale, tasche a soffietto, taschino sulla manica, passapollice e logo montagna-sole sul petto.'},
    {'name': 'Giacca Compass Field', 'color': 'Grigio', 'price': '129.90',
     'size_type': 'clothing', 'image': 'giacca3',
     'categories': ['giacche'],
     'description': 'Giacca con collo alto e zip integrale, tasche con zip sul petto, due tasche a soffietto e rosa dei venti sul davanti.'},
    # Magliette
    {'name': 'T-shirt tecnica Trail', 'color': 'Grigio', 'price': '34.90',
     'size_type': 'clothing', 'image': 'maglietta1',
     'categories': ['magliette'],
     'description': 'Maglia tecnica in tessuto traspirante con grafica geometrica e coulisse laterali.'},
    {'name': 'T-shirt traspirante Summit', 'color': 'Grigio', 'price': '29.90',
     'size_type': 'clothing', 'image': 'maglietta2',
     'categories': ['magliette'],
     'description': 'T-shirt a rapida asciugatura con cuciture piatte e logo montagna-sole sul petto.'},
    {'name': 'T-shirt Sunrise', 'color': 'Verde salvia', 'price': '24.90',
     'size_type': 'clothing', 'image': 'maglietta3',
     'categories': ['magliette'],
     'description': 'T-shirt girocollo in tessuto traforato leggero, logo montagna-sole sul petto e taschino con zip sulla manica.'},
    # Pantaloni
    {'name': 'Pantaloni cargo Ridge', 'color': 'Antracite', 'price': '89.90',
     'size_type': 'clothing', 'image': 'pantalone1',
     'categories': ['pantaloni'],
     'description': 'Pantaloni tecnici con tasca cargo con zip, cintura regolabile e fondo elasticizzato.'},
    {'name': 'Pantaloni trekking Sentiero', 'color': 'Verde salvia', 'price': '84.90',
     'size_type': 'clothing', 'image': 'pantalone2',
     'categories': ['pantaloni'],
     'description': 'Pantaloni outdoor dal taglio slim con tasche cargo con zip, ginocchia sagomate e chiusura con bottone.'},
    {'name': 'Pantaloni trekking Sentiero Navy', 'color': 'Blu navy', 'price': '84.90',
     'size_type': 'clothing', 'image': 'pantalone3',
     'categories': ['pantaloni'],
     'description': 'Lo stesso modello dei Sentiero in blu navy: taglio slim, tasche cargo con zip, ginocchia sagomate e anello portaoggetti in vita.'},
    # Scarpe
    {'name': 'Sneakers Aero Flow', 'color': 'Bianco/giallo', 'price': '129.90',
     'size_type': 'shoes', 'image': 'scarpa1',
     'categories': ['scarpe'],
     'description': 'Sneakers dal design sportivo con tomaia traspirante e suola ammortizzata.'},
    {'name': 'Scarpe Trail Stride', 'color': 'Nero/blu', 'price': '119.90',
     'size_type': 'shoes', 'image': 'scarpa2',
     'categories': ['scarpe', 'nuovi-arrivi'],
     'description': 'Scarpe da trail con suola scolpita, tomaia in mesh e dettagli blu elettrico.'},
    {'name': 'Scarpe Trail Stride Dark', 'color': 'Grigio scuro', 'price': '119.90',
     'size_type': 'shoes', 'image': 'scarpa3',
     'categories': ['scarpe'],
     'description': 'Versione total dark delle Trail Stride, con tomaia ripstop e suola con camera d\'aria.'},
]

IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')

# Codici sconto di esempio. Se un codice esiste già non si modifica (così non si perdono
# le modifiche fatte dall'admin né il conteggio degli utilizzi).
DISCOUNT_CODES = [
    {'code': 'BENVENUTO10', 'percent': 10},
    {'code': 'SUPER20', 'percent': 20, 'min_order': '100.00', 'max_uses': 10},
]


class Command(BaseCommand):
    help = (
        'Inserisce categorie, prodotti e codici sconto di esempio e collega le foto presenti in media/. '
        'Si può rilanciare senza creare duplicati.'
    )

    def handle(self, *args, **options):
        for slug, name in CATEGORIES:
            Category.objects.get_or_create(slug=slug, defaults={'name': name})

        for data in PRODUCTS:
            product = Product.objects.filter(name=data['name']).first() or Product(name=data['name'])
            product.description = data['description']
            product.price = data['price']
            product.size_type = data['size_type']
            product.color = data['color']
            # Lo stock non si tocca: i nuovi prodotti partono dal valore di default
            # del modello (30) e rilanciare il comando non azzera gli acquisti fatti.
            product.full_clean()
            product.save()
            product.categories.set(Category.objects.filter(slug__in=data['categories']))

            linked = self.link_images(product, data['image'])
            self.stdout.write(f'{product.name}: {linked} foto collegate')

        self.stdout.write(self.style.SUCCESS(f'Prodotti totali: {Product.objects.count()}'))

        for data in DISCOUNT_CODES:
            code, created = DiscountCode.objects.get_or_create(
                code=DiscountCode.normalize(data['code']),
                defaults={key: value for key, value in data.items() if key != 'code'},
            )
            self.stdout.write(f'Codice sconto {code.code}: {"creato" if created else "già presente"}')

    def link_images(self, product, prefix):
        # Foto principale "prefisso.ext", seconda foto "prefisso.1.ext"
        linked = 0
        for suffix in ('', '.1'):
            for ext in IMAGE_EXTENSIONS:
                filename = f'{prefix}{suffix}.{ext}'
                if (settings.MEDIA_ROOT / filename).exists():
                    ProductImage.objects.get_or_create(
                        product=product,
                        image=filename,
                        defaults={'alt_text': f'{product.name} - {"vista 1" if not suffix else "vista 2"}'},
                    )
                    linked += 1
                    break
        return linked
