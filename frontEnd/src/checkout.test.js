// Si eseguono con: node --test (dalla cartella frontEnd)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyForm, flattenErrors, orderPayload, validateCheckout } from './checkout.js'

const now = new Date(2026, 9, 5) // 5 ottobre 2026

const validForm = {
  fullName: 'Mario Rossi',
  email: 'mario@example.com',
  address: 'Via Roma 1',
  city: 'Milano',
  postalCode: '20100',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/29',
  cvc: '123',
}

test('un modulo compilato correttamente non ha errori', () => {
  assert.deepEqual(validateCheckout(validForm, now), {})
})

test('un modulo vuoto segnala tutti gli 8 campi', () => {
  assert.deepEqual(Object.keys(validateCheckout(emptyForm, now)).sort(), [
    'address', 'cardNumber', 'city', 'cvc', 'email', 'expiry', 'fullName', 'postalCode',
  ])
})

test('email non valide', () => {
  for (const email of ['mario', 'mario@', '@example.com', 'mario@example', 'ma rio@example.com']) {
    assert.equal(validateCheckout({ ...validForm, email }, now).email, 'Email non valida', email)
  }
})

test('CAP: servono esattamente 5 cifre', () => {
  for (const postalCode of ['2010', '201000', 'abcde', '20 10']) {
    assert.ok(validateCheckout({ ...validForm, postalCode }, now).postalCode, postalCode)
  }
})

test('numero carta: 16 cifre, con o senza spazi', () => {
  assert.equal(validateCheckout({ ...validForm, cardNumber: '4242424242424242' }, now).cardNumber, undefined)
  for (const cardNumber of ['4242 4242 4242 424', '4242 4242 4242 42424', '4242 4242 4242 42ab']) {
    assert.ok(validateCheckout({ ...validForm, cardNumber }, now).cardNumber, cardNumber)
  }
})

test('scadenza: formato MM/AA', () => {
  for (const expiry of ['1229', '12/2029', '13/29', '00/29', 'ab/cd', '']) {
    assert.equal(validateCheckout({ ...validForm, expiry }, now).expiry, 'Usa il formato MM/AA', expiry)
  }
})

test('scadenza: la carta vale fino alla fine del mese indicato', () => {
  assert.equal(validateCheckout({ ...validForm, expiry: '01/20' }, now).expiry, 'Carta scaduta')
  assert.equal(validateCheckout({ ...validForm, expiry: '09/26' }, now).expiry, 'Carta scaduta')
  assert.equal(validateCheckout({ ...validForm, expiry: '10/26' }, now).expiry, undefined)
  assert.equal(validateCheckout({ ...validForm, expiry: '11/26' }, now).expiry, undefined)
})

test('CVC: 3 o 4 cifre', () => {
  assert.equal(validateCheckout({ ...validForm, cvc: '1234' }, now).cvc, undefined)
  for (const cvc of ['12', '12345', 'abc']) {
    assert.ok(validateCheckout({ ...validForm, cvc }, now).cvc, cvc)
  }
})

test('gli spazi attorno ai testi vengono ignorati', () => {
  assert.deepEqual(validateCheckout({ ...validForm, fullName: '  Mario Rossi  ', city: ' Milano ' }, now), {})
  assert.ok(validateCheckout({ ...validForm, fullName: '   ' }, now).fullName)
})

test('orderPayload contiene solo id, taglia e quantita (niente prezzi ne dati del modulo)', () => {
  const lines = [
    { productId: 2, size: 'M', quantity: 3, product: { name: 'Felpa', price: '79.90' }, max: 30, problem: null },
    { productId: 14, size: '42', quantity: 1, product: { name: 'Scarpa', price: '129.90' }, max: 30, problem: null },
  ]
  const payload = orderPayload(lines)
  assert.deepEqual(payload, {
    items: [
      { product_id: 2, size: 'M', quantity: 3 },
      { product_id: 14, size: '42', quantity: 1 },
    ],
  })
  assert.deepEqual(Object.keys(payload), ['items'])
  assert.deepEqual(Object.keys(payload.items[0]).sort(), ['product_id', 'quantity', 'size'])
})

test('orderPayload aggiunge il codice sconto solo se presente', () => {
  const lines = [{ productId: 2, size: 'M', quantity: 1 }]
  assert.deepEqual(orderPayload(lines, 'BENVENUTO10'), {
    items: [{ product_id: 2, size: 'M', quantity: 1 }],
    discount_code: 'BENVENUTO10',
  })
  assert.deepEqual(Object.keys(orderPayload(lines, '')), ['items'])
  assert.deepEqual(Object.keys(orderPayload(lines)), ['items'])
})

test('flattenErrors appiattisce gli errori di DRF', () => {
  assert.deepEqual(flattenErrors({ items: ['"Felpa": disponibili 1, richiesti 2.'] }), [
    '"Felpa": disponibili 1, richiesti 2.',
  ])
  assert.deepEqual(
    flattenErrors({ items: [{ quantity: ['Ensure this value is greater than or equal to 1.'] }, 'altro'] }),
    ['Ensure this value is greater than or equal to 1.', 'altro'],
  )
  assert.deepEqual(flattenErrors({ detail: 'Non trovato.' }), ['Non trovato.'])
  assert.deepEqual(flattenErrors(null), [])
  assert.deepEqual(flattenErrors(undefined), [])
  assert.deepEqual(flattenErrors(42), [])
})
