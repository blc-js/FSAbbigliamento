from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import Category, DiscountCode, Order, OrderItem, Product, shipping_cost_for


class OrderCreateTests(APITestCase):
    url = '/api/orders/'

    def setUp(self):
        # Il limite di richieste usa la cache: la svuotiamo per non dipendere dagli altri test
        cache.clear()
        self.felpa = Product.objects.create(
            name='Felpa', price=Decimal('79.90'), color='Verde', size_type='clothing', stock=30
        )
        self.scarpa = Product.objects.create(
            name='Scarpa', price=Decimal('119.90'), color='Nero', size_type='shoes', stock=30
        )

    def post(self, items):
        return self.client.post(self.url, {'items': items}, format='json')

    def stock(self, product):
        product.refresh_from_db()
        return product.stock

    def assertNothingChanged(self):
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)
        self.assertEqual(self.stock(self.felpa), 30)
        self.assertEqual(self.stock(self.scarpa), 30)

    def test_valid_order_updates_stock_and_total(self):
        response = self.post([{'product_id': self.felpa.pk, 'size': 'M', 'quantity': 2}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['total']), Decimal('159.80'))
        self.assertEqual(self.stock(self.felpa), 28)
        item = OrderItem.objects.get()
        self.assertEqual((item.size, item.quantity, item.unit_price), ('M', 2, Decimal('79.90')))

    def test_same_product_two_sizes_shares_the_stock(self):
        response = self.post([
            {'product_id': self.felpa.pk, 'size': 'M', 'quantity': 1},
            {'product_id': self.felpa.pk, 'size': 'XL', 'quantity': 1},
        ])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.stock(self.felpa), 28)
        self.assertEqual(OrderItem.objects.count(), 2)

    def test_shoe_size_valid_for_shoes(self):
        response = self.post([{'product_id': self.scarpa.pk, 'size': '42', 'quantity': 1}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.stock(self.scarpa), 29)

    def test_insufficient_stock_is_rejected(self):
        response = self.post([{'product_id': self.felpa.pk, 'size': 'M', 'quantity': 31}])
        self.assertEqual(response.status_code, 400)
        self.assertIn('disponibili 30, richiesti 31', response.data['items'][0])
        self.assertNothingChanged()

    def test_stock_checked_on_total_across_sizes(self):
        self.felpa.stock = 3
        self.felpa.save()
        response = self.post([
            {'product_id': self.felpa.pk, 'size': 'M', 'quantity': 2},
            {'product_id': self.felpa.pk, 'size': 'XL', 'quantity': 2},
        ])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.stock(self.felpa), 3)
        self.assertEqual(Order.objects.count(), 0)

    def test_size_of_wrong_type_is_rejected(self):
        for product, size in [(self.felpa, '42'), (self.scarpa, 'M')]:
            response = self.post([{'product_id': product.pk, 'size': size, 'quantity': 1}])
            self.assertEqual(response.status_code, 400)
        self.assertNothingChanged()

    def test_unknown_product_is_rejected(self):
        response = self.post([{'product_id': 9999, 'size': 'M', 'quantity': 1}])
        self.assertEqual(response.status_code, 400)
        self.assertNothingChanged()

    def test_invalid_quantity_and_empty_items_are_rejected(self):
        for items in (
            [{'product_id': self.felpa.pk, 'size': 'M', 'quantity': 0}],
            [{'product_id': self.felpa.pk, 'size': 'M', 'quantity': -1}],
            [],
        ):
            self.assertEqual(self.post(items).status_code, 400)
        self.assertNothingChanged()

    def test_one_bad_line_cancels_the_whole_order(self):
        response = self.post([
            {'product_id': self.felpa.pk, 'size': 'M', 'quantity': 2},
            {'product_id': self.scarpa.pk, 'size': 'M', 'quantity': 1},
        ])
        self.assertEqual(response.status_code, 400)
        self.assertNothingChanged()

    def test_failure_after_stock_update_rolls_back_the_stock(self):
        # Simula un guasto DOPO la riduzione dello stock: la transazione deve annullarla
        with patch('abbigliamento.serializers.Order.objects.create', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.post([{'product_id': self.felpa.pk, 'size': 'M', 'quantity': 5}])
        self.assertNothingChanged()

    def test_price_sent_by_the_browser_is_ignored(self):
        response = self.post([
            {'product_id': self.felpa.pk, 'size': 'M', 'quantity': 1, 'price': '0.01'}
        ])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['total']), Decimal('79.90'))


class DiscountCodeTests(APITestCase):
    check_url = '/api/discount-codes/check/'
    order_url = '/api/orders/'

    def setUp(self):
        cache.clear()
        self.felpa = Product.objects.create(
            name='Felpa', price=Decimal('79.90'), color='Verde', size_type='clothing', stock=30
        )
        self.maglia = Product.objects.create(
            name='Maglia', price=Decimal('19.99'), color='Bianco', size_type='clothing', stock=30
        )
        self.code = DiscountCode.objects.create(code='ben10', percent=10)

    def line(self, product, quantity=1, size='M'):
        return {'product_id': product.pk, 'size': size, 'quantity': quantity}

    def check(self, code, *items):
        return self.client.post(self.check_url, {'code': code, 'items': list(items)}, format='json')

    def order(self, code, *items):
        body = {'items': list(items)}
        if code is not None:
            body['discount_code'] = code
        return self.client.post(self.order_url, body, format='json')

    def assertNothingChanged(self):
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)
        for product in (self.felpa, self.maglia):
            product.refresh_from_db()
            self.assertEqual(product.stock, 30)
        self.code.refresh_from_db()
        self.assertEqual(self.code.times_used, 0)

    # --- Controllo del codice (carrello) ---

    def test_check_returns_the_discount_computed_on_database_prices(self):
        response = self.check('BEN10', self.line(self.felpa, 2))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['percent'], 10)
        # Gli importi sono testi con 2 decimali, non numeri
        self.assertEqual(response.data['subtotal'], '159.80')
        self.assertEqual(response.data['discount_amount'], '15.98')
        self.assertEqual(response.data['total'], '143.82')

    def test_codes_ignore_case_and_surrounding_spaces(self):
        for typed in ('ben10', 'BEN10', '  Ben10  '):
            self.assertEqual(self.check(typed, self.line(self.felpa)).status_code, 200, typed)
        self.assertEqual(DiscountCode.objects.get().code, 'BEN10')

    def test_check_rejects_unknown_and_inactive_codes_with_the_same_message(self):
        self.code.active = False
        self.code.save()
        for typed in ('BEN10', 'NONESISTE'):
            response = self.check(typed, self.line(self.felpa))
            self.assertEqual(response.status_code, 400, typed)
            self.assertEqual(response.data['code'], ['Codice sconto non valido.'])

    def test_check_rejects_exhausted_code(self):
        self.code.max_uses = 2
        self.code.times_used = 2
        self.code.save()
        response = self.check('BEN10', self.line(self.felpa))
        self.assertEqual(response.status_code, 400)
        self.assertIn('esaurito', response.data['code'][0])

    def test_check_enforces_the_minimum_order_amount(self):
        self.code.min_order = Decimal('100.00')
        self.code.save()
        low = self.check('BEN10', self.line(self.felpa))  # 79,90 €
        self.assertEqual(low.status_code, 400)
        self.assertIn('almeno 100,00 €', low.data['code'][0])
        self.assertEqual(self.check('BEN10', self.line(self.felpa, 2)).status_code, 200)  # 159,80 €

    def test_check_with_unknown_product_is_rejected(self):
        response = self.check('BEN10', {'product_id': 9999, 'size': 'M', 'quantity': 1})
        self.assertEqual(response.status_code, 400)

    def test_check_does_not_change_anything(self):
        self.check('BEN10', self.line(self.felpa, 3))
        self.assertNothingChanged()

    # --- Ordine con codice ---

    def test_order_with_code_applies_the_discount(self):
        response = self.order('ben10', self.line(self.felpa, 2))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['subtotal']), Decimal('159.80'))
        self.assertEqual(Decimal(response.data['discount_amount']), Decimal('15.98'))
        self.assertEqual(Decimal(response.data['total']), Decimal('143.82'))
        self.assertEqual(response.data['discount_code'], 'BEN10')
        order = Order.objects.get()
        self.assertEqual((order.discount_code, order.discount_amount, order.total),
                         ('BEN10', Decimal('15.98'), Decimal('143.82')))
        self.code.refresh_from_db()
        self.assertEqual(self.code.times_used, 1)
        self.felpa.refresh_from_db()
        self.assertEqual(self.felpa.stock, 28)

    def test_discount_is_rounded_to_the_cent(self):
        # 19,99 x 15% = 2,9985 -> 3,00
        DiscountCode.objects.create(code='QUINDICI', percent=15)
        response = self.order('QUINDICI', self.line(self.maglia))
        self.assertEqual(Decimal(response.data['discount_amount']), Decimal('3.00'))
        # Articoli scontati 16,99 € (sotto i 50 €): si aggiungono 10,00 € di spedizione
        self.assertEqual(Decimal(response.data['shipping_cost']), Decimal('10.00'))
        self.assertEqual(Decimal(response.data['total']), Decimal('26.99'))

    def test_order_without_code_or_with_blank_code_has_no_discount(self):
        for code in (None, '', '   '):
            Order.objects.all().delete()
            response = self.order(code, self.line(self.felpa))
            self.assertEqual(response.status_code, 201, repr(code))
            self.assertEqual(Decimal(response.data['discount_amount']), Decimal('0.00'))
            self.assertEqual(response.data['discount_code'], '')
            self.assertEqual(Decimal(response.data['total']), Decimal('79.90'))
        self.code.refresh_from_db()
        self.assertEqual(self.code.times_used, 0)

    def test_order_with_invalid_code_is_rejected_and_changes_nothing(self):
        response = self.order('SBAGLIATO', self.line(self.felpa, 2))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['discount_code'], ['Codice sconto non valido.'])
        self.assertNothingChanged()

    def test_order_with_inactive_code_is_rejected(self):
        self.code.active = False
        self.code.save()
        self.assertEqual(self.order('BEN10', self.line(self.felpa)).status_code, 400)
        self.assertNothingChanged()

    def test_order_below_minimum_is_rejected(self):
        self.code.min_order = Decimal('100.00')
        self.code.save()
        response = self.order('BEN10', self.line(self.felpa))
        self.assertEqual(response.status_code, 400)
        self.assertIn('almeno 100,00 €', response.data['discount_code'][0])
        self.assertNothingChanged()

    def test_code_can_be_used_only_max_uses_times(self):
        self.code.max_uses = 1
        self.code.save()
        self.assertEqual(self.order('BEN10', self.line(self.felpa)).status_code, 201)
        second = self.order('BEN10', self.line(self.felpa))
        self.assertEqual(second.status_code, 400)
        self.assertIn('esaurito', second.data['discount_code'][0])
        self.assertEqual(Order.objects.count(), 1)
        self.felpa.refresh_from_db()
        self.assertEqual(self.felpa.stock, 29)  # il secondo ordine non ha toccato lo stock

    def test_stock_error_does_not_consume_the_code(self):
        response = self.order('BEN10', self.line(self.felpa, 31))
        self.assertEqual(response.status_code, 400)
        self.assertNothingChanged()

    def test_failure_after_updates_rolls_back_stock_and_code_usage(self):
        with patch('abbigliamento.serializers.Order.objects.create', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.order('BEN10', self.line(self.felpa, 5))
        self.assertNothingChanged()

    def test_code_sent_by_the_browser_cannot_set_the_discount_amount(self):
        response = self.client.post(
            self.order_url,
            {'items': [self.line(self.felpa)], 'discount_code': 'BEN10',
             'percent': 100, 'discount_amount': '79.90', 'total': '0.01'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['total']), Decimal('71.91'))

    # --- Limite di richieste ---

    def test_too_many_code_checks_are_throttled(self):
        statuses = [self.check('PROVA%d' % n, self.line(self.felpa)).status_code for n in range(31)]
        self.assertEqual(statuses[:30], [400] * 30)
        self.assertEqual(statuses[30], 429)


class ShippingTests(APITestCase):
    def setUp(self):
        cache.clear()
        make = lambda name, price: Product.objects.create(  # noqa: E731
            name=name, price=Decimal(price), color='Nero', size_type='clothing', stock=30
        )
        self.cheap = make('Economica', '19.99')
        self.fifty = make('Cinquanta', '50.00')
        self.just_over = make('Appena sopra', '50.01')
        self.felpa = make('Felpa', '79.90')
        self.code = DiscountCode.objects.create(code='QUARANTA', percent=40)

    def order(self, product, quantity=1, code=None):
        body = {'items': [{'product_id': product.pk, 'size': 'M', 'quantity': quantity}]}
        if code:
            body['discount_code'] = code
        return self.client.post('/api/orders/', body, format='json')

    def test_shipping_rule_boundaries(self):
        self.assertEqual(shipping_cost_for(Decimal('0.00')), Decimal('10.00'))
        self.assertEqual(shipping_cost_for(Decimal('49.99')), Decimal('10.00'))
        self.assertEqual(shipping_cost_for(Decimal('50.00')), Decimal('10.00'))  # "sopra" 50 = più di 50
        self.assertEqual(shipping_cost_for(Decimal('50.01')), Decimal('0.00'))

    def test_order_below_the_threshold_pays_shipping(self):
        response = self.order(self.cheap)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['shipping_cost']), Decimal('10.00'))
        self.assertEqual(Decimal(response.data['subtotal']), Decimal('19.99'))  # solo articoli
        self.assertEqual(Decimal(response.data['total']), Decimal('29.99'))
        self.assertEqual(Order.objects.get().shipping_cost, Decimal('10.00'))

    def test_order_of_exactly_fifty_pays_shipping(self):
        response = self.order(self.fifty)
        self.assertEqual(Decimal(response.data['shipping_cost']), Decimal('10.00'))
        self.assertEqual(Decimal(response.data['total']), Decimal('60.00'))

    def test_order_just_over_fifty_ships_for_free(self):
        response = self.order(self.just_over)
        self.assertEqual(Decimal(response.data['shipping_cost']), Decimal('0.00'))
        self.assertEqual(Decimal(response.data['total']), Decimal('50.01'))

    def test_many_cheap_items_reach_free_shipping(self):
        # 3 x 19,99 = 59,97 -> spedizione gratuita
        response = self.order(self.cheap, 3)
        self.assertEqual(Decimal(response.data['shipping_cost']), Decimal('0.00'))
        self.assertEqual(Decimal(response.data['total']), Decimal('59.97'))

    def test_threshold_is_checked_after_the_discount(self):
        free = self.order(self.felpa)  # 79,90 senza sconto: gratuita
        self.assertEqual(Decimal(free.data['shipping_cost']), Decimal('0.00'))
        # 79,90 - 40% = 47,94 -> sotto la soglia: spedizione a pagamento
        discounted = self.order(self.felpa, code='QUARANTA')
        self.assertEqual(Decimal(discounted.data['discount_amount']), Decimal('31.96'))
        self.assertEqual(Decimal(discounted.data['shipping_cost']), Decimal('10.00'))
        self.assertEqual(Decimal(discounted.data['total']), Decimal('57.94'))
        self.assertEqual(Decimal(discounted.data['subtotal']), Decimal('79.90'))

    def test_discount_check_includes_shipping_in_the_total(self):
        def check(product, quantity):
            body = {'code': 'QUARANTA', 'items': [{'product_id': product.pk, 'size': 'M', 'quantity': quantity}]}
            return self.client.post('/api/discount-codes/check/', body, format='json').data

        paid = check(self.felpa, 1)  # 47,94 dopo lo sconto -> spedizione a pagamento
        self.assertEqual((paid['shipping_cost'], paid['total']), ('10.00', '57.94'))
        free = check(self.felpa, 2)  # 159,80 - 63,92 = 95,88 -> gratuita
        self.assertEqual((free['shipping_cost'], free['total']), ('0.00', '95.88'))

    def test_shipping_does_not_count_for_the_code_minimum(self):
        # Il minimo del codice riguarda solo gli articoli: 19,99 + 10 di spedizione non superano 25
        self.code.min_order = Decimal('25.00')
        self.code.save()
        body = {'code': 'QUARANTA', 'items': [{'product_id': self.cheap.pk, 'size': 'M', 'quantity': 1}]}
        self.assertEqual(self.client.post('/api/discount-codes/check/', body, format='json').status_code, 400)


class SeedProductsTests(TestCase):
    """Il comando seed_products deve funzionare partendo da un database vuoto."""

    def seed(self):
        call_command('seed_products', stdout=StringIO())

    def test_creates_categories_products_and_discount_codes(self):
        self.seed()
        self.assertEqual(Category.objects.count(), 6)
        self.assertEqual(Product.objects.count(), 15)
        self.assertEqual(DiscountCode.objects.count(), 2)
        # Ogni categoria ha i suoi prodotti ("Nuovi Arrivi" ne condivide 3 con le altre)
        for category in Category.objects.all():
            self.assertEqual(category.products.count(), 3, category.slug)

    def test_can_be_run_twice_without_duplicates_or_resetting_data(self):
        self.seed()
        Product.objects.filter(name='Felpa in pile Alpine').update(stock=5)
        DiscountCode.objects.filter(code='BENVENUTO10').update(times_used=3)
        self.seed()
        self.assertEqual(Category.objects.count(), 6)
        self.assertEqual(Product.objects.count(), 15)
        self.assertEqual(DiscountCode.objects.count(), 2)
        # Stock e utilizzi dei codici non vengono azzerati
        self.assertEqual(Product.objects.get(name='Felpa in pile Alpine').stock, 5)
        self.assertEqual(DiscountCode.objects.get(code='BENVENUTO10').times_used, 3)
