// Si eseguono con: node --test (dalla cartella frontEnd)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addToCart,
  buildCartLines,
  CART_KEY,
  cartTotalCents,
  clampQuantity,
  countItems,
  DISCOUNT_KEY,
  loadCart,
  loadDiscountCode,
  priceToCents,
  quantityOfProduct,
  removeFromCart,
  saveCart,
  saveDiscountCode,
  setQuantity,
} from './cart.js'

// localStorage finto, per provare lettura e salvataggio senza browser
function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
  }
}

test('aggiungere un prodotto nuovo crea una riga', () => {
  assert.deepEqual(addToCart([], 2, 'M'), [{ productId: 2, size: 'M', quantity: 1 }])
})

test('aggiungere lo stesso prodotto e la stessa taglia aumenta la quantita', () => {
  const items = addToCart(addToCart([], 2, 'M'), 2, 'M', 3)
  assert.deepEqual(items, [{ productId: 2, size: 'M', quantity: 4 }])
})

test('lo stesso prodotto in taglie diverse sono righe separate', () => {
  const items = addToCart(addToCart([], 2, 'M'), 2, 'XL')
  assert.equal(items.length, 2)
  assert.equal(countItems(items), 2)
})

test('aggiungere non modifica l\'array originale', () => {
  const original = [{ productId: 2, size: 'M', quantity: 1 }]
  addToCart(original, 2, 'M')
  assert.equal(original[0].quantity, 1)
})

test('setQuantity cambia la quantita della sola riga indicata', () => {
  let items = addToCart(addToCart([], 2, 'M'), 2, 'XL')
  items = setQuantity(items, 2, 'XL', 5)
  assert.equal(items.find((l) => l.size === 'XL').quantity, 5)
  assert.equal(items.find((l) => l.size === 'M').quantity, 1)
})

test('setQuantity a 0 o meno toglie la riga', () => {
  const items = addToCart([], 2, 'M')
  assert.deepEqual(setQuantity(items, 2, 'M', 0), [])
  assert.deepEqual(setQuantity(items, 2, 'M', -1), [])
})

test('removeFromCart toglie solo la riga con quella taglia', () => {
  const items = addToCart(addToCart([], 2, 'M'), 2, 'XL')
  assert.deepEqual(removeFromCart(items, 2, 'M'), [{ productId: 2, size: 'XL', quantity: 1 }])
})

test('countItems somma i pezzi di tutte le righe', () => {
  let items = addToCart([], 2, 'M', 2)
  items = addToCart(items, 5, '42', 3)
  assert.equal(countItems(items), 5)
  assert.equal(countItems([]), 0)
})

test('salvare e rileggere restituisce lo stesso carrello', () => {
  const storage = fakeStorage()
  const items = addToCart(addToCart([], 2, 'M', 2), 14, '42')
  saveCart(items, storage)
  assert.deepEqual(loadCart(storage), items)
})

test('nel localStorage finiscono solo id, taglia e quantita (mai prezzi)', () => {
  const storage = fakeStorage()
  saveCart(addToCart([], 2, 'M'), storage)
  const saved = JSON.parse(storage.getItem(CART_KEY))
  assert.deepEqual(Object.keys(saved[0]).sort(), ['productId', 'quantity', 'size'])
})

test('un carrello vuoto o assente restituisce una lista vuota', () => {
  assert.deepEqual(loadCart(fakeStorage()), [])
  assert.deepEqual(loadCart(null), [])
})

test('dati danneggiati non rompono il carrello', () => {
  assert.deepEqual(loadCart(fakeStorage({ [CART_KEY]: '{non e json' })), [])
  assert.deepEqual(loadCart(fakeStorage({ [CART_KEY]: '{"a": 1}' })), [])
  assert.deepEqual(loadCart(fakeStorage({ [CART_KEY]: 'null' })), [])
})

test('le righe non valide vengono scartate, quelle valide restano', () => {
  const saved = JSON.stringify([
    { productId: 2, size: 'M', quantity: 1 },
    { productId: '2', size: 'M', quantity: 1 },
    { productId: 3, size: 'M', quantity: 0 },
    { productId: 4, size: 'M', quantity: -2 },
    { productId: 5, size: 'M', quantity: 1.5 },
    { productId: 6, quantity: 1 },
    null,
    'testo',
  ])
  assert.deepEqual(loadCart(fakeStorage({ [CART_KEY]: saved })), [
    { productId: 2, size: 'M', quantity: 1 },
  ])
})

test('quantityOfProduct somma le taglie dello stesso prodotto e ignora gli altri', () => {
  let items = addToCart([], 2, 'M', 2)
  items = addToCart(items, 2, 'XL', 3)
  items = addToCart(items, 5, 'M', 4)
  assert.equal(quantityOfProduct(items, 2), 5)
  assert.equal(quantityOfProduct(items, 5), 4)
  assert.equal(quantityOfProduct(items, 99), 0)
})

test('clampQuantity limita la quantita tra 1 e il massimo', () => {
  assert.equal(clampQuantity(3, 10), 3)
  assert.equal(clampQuantity(50, 10), 10)
  assert.equal(clampQuantity(0, 10), 1)
  assert.equal(clampQuantity(-4, 10), 1)
  assert.equal(clampQuantity('', 10), 1)
  assert.equal(clampQuantity('abc', 10), 1)
  assert.equal(clampQuantity(2.7, 10), 2)
  assert.equal(clampQuantity('4', 10), 4)
})

test('clampQuantity con massimo 0 (nessun pezzo disponibile) restituisce 0', () => {
  assert.equal(clampQuantity(1, 0), 0)
})

const felpa = { id: 2, price: '79.90', stock: 5, available_sizes: ['S', 'M', 'L', 'XL'] }
const scarpa = { id: 14, price: '129.90', stock: 30, available_sizes: ['41', '42'] }

test('priceToCents converte i prezzi in centesimi senza errori di arrotondamento', () => {
  assert.equal(priceToCents('79.90'), 7990)
  assert.equal(priceToCents('0.10'), 10)
  assert.equal(priceToCents('19.99'), 1999)
  assert.equal(priceToCents(129.9), 12990)
})

test('buildCartLines: riga valida con prodotto e massimo calcolato', () => {
  const [line] = buildCartLines(addToCart([], 2, 'M', 3), [felpa])
  assert.equal(line.product, felpa)
  assert.equal(line.max, 5)
  assert.equal(line.problem, null)
})

test('buildCartLines: il massimo di una riga tiene conto delle altre taglie dello stesso prodotto', () => {
  const items = addToCart(addToCart([], 2, 'M', 3), 2, 'XL', 1)
  const lines = buildCartLines(items, [felpa])
  assert.equal(lines.find((l) => l.size === 'M').max, 4)
  assert.equal(lines.find((l) => l.size === 'XL').max, 2)
  assert.deepEqual(lines.map((l) => l.problem), [null, null])
})

test('buildCartLines: stock superato sommando le taglie segnala il problema su entrambe le righe', () => {
  const items = addToCart(addToCart([], 2, 'M', 3), 2, 'XL', 3)
  assert.deepEqual(buildCartLines(items, [felpa]).map((l) => l.problem), ['stock', 'stock'])
})

test('buildCartLines: stock sceso sotto la quantita nel carrello', () => {
  const [line] = buildCartLines(addToCart([], 2, 'M', 4), [{ ...felpa, stock: 2 }])
  assert.equal(line.problem, 'stock')
  assert.equal(line.max, 2)
})

test('buildCartLines: prodotto esaurito ha massimo 0', () => {
  const [line] = buildCartLines(addToCart([], 2, 'M'), [{ ...felpa, stock: 0 }])
  assert.equal(line.problem, 'stock')
  assert.equal(line.max, 0)
})

test('buildCartLines: prodotto non piu esistente', () => {
  const [line] = buildCartLines(addToCart([], 999, 'M'), [felpa])
  assert.equal(line.product, null)
  assert.equal(line.problem, 'unavailable')
})

test('buildCartLines: taglia non piu valida per il prodotto', () => {
  const [line] = buildCartLines(addToCart([], 2, '42'), [felpa])
  assert.equal(line.problem, 'size')
})

test('cartTotalCents somma prezzo x quantita e ignora i prodotti non piu esistenti', () => {
  let items = addToCart([], 2, 'M', 3)
  items = addToCart(items, 14, '42', 1)
  items = addToCart(items, 999, 'M', 5)
  const lines = buildCartLines(items, [felpa, scarpa])
  assert.equal(cartTotalCents(lines), 7990 * 3 + 12990)
  assert.equal(cartTotalCents([]), 0)
})

test('il codice sconto si salva e si rilegge come testo', () => {
  const storage = fakeStorage()
  assert.equal(loadDiscountCode(storage), '')
  saveDiscountCode('BENVENUTO10', storage)
  assert.equal(storage.getItem(DISCOUNT_KEY), 'BENVENUTO10')
  assert.equal(loadDiscountCode(storage), 'BENVENUTO10')
})

test('salvare un codice vuoto lo rimuove', () => {
  const storage = fakeStorage()
  const removed = []
  storage.removeItem = (key) => removed.push(key)
  saveDiscountCode('', storage)
  assert.deepEqual(removed, [DISCOUNT_KEY])
})

test('codice sconto: valori assenti, danneggiati o enormi non rompono nulla', () => {
  assert.equal(loadDiscountCode(null), '')
  assert.equal(loadDiscountCode(fakeStorage()), '')
  assert.equal(loadDiscountCode(fakeStorage({ [DISCOUNT_KEY]: '  ABC  ' })), 'ABC')
  assert.equal(loadDiscountCode(fakeStorage({ [DISCOUNT_KEY]: 'X'.repeat(500) })).length, 50)
  const broken = { getItem: () => { throw new Error('bloccato') }, setItem: () => { throw new Error('pieno') }, removeItem: () => { throw new Error('bloccato') } }
  assert.equal(loadDiscountCode(broken), '')
  assert.doesNotThrow(() => saveDiscountCode('ABC', broken))
  assert.doesNotThrow(() => saveDiscountCode('', broken))
})

test('il codice sconto e il carrello usano chiavi diverse', () => {
  assert.notEqual(DISCOUNT_KEY, CART_KEY)
})

test('se lo storage genera errori il carrello non si rompe', () => {
  const broken = {
    getItem: () => {
      throw new Error('bloccato')
    },
    setItem: () => {
      throw new Error('pieno')
    },
  }
  assert.deepEqual(loadCart(broken), [])
  assert.doesNotThrow(() => saveCart([{ productId: 2, size: 'M', quantity: 1 }], broken))
})
