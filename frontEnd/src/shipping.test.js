// Si eseguono con: node --test (dalla cartella frontEnd)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FREE_SHIPPING_ABOVE_CENTS, SHIPPING_COST_CENTS, shippingCents } from './shipping.js'

test('le regole sono 10 euro fissi e gratis sopra 50 euro', () => {
  assert.equal(SHIPPING_COST_CENTS, 1000)
  assert.equal(FREE_SHIPPING_ABOVE_CENTS, 5000)
})

test('sotto i 50 euro la spedizione costa 10 euro', () => {
  assert.equal(shippingCents(0), 1000)
  assert.equal(shippingCents(1999), 1000)
  assert.equal(shippingCents(4999), 1000)
})

test('esattamente 50 euro paga ancora la spedizione ("sopra" = piu di 50)', () => {
  assert.equal(shippingCents(5000), 1000)
})

test('sopra i 50 euro la spedizione e gratuita', () => {
  assert.equal(shippingCents(5001), 0)
  assert.equal(shippingCents(7990), 0)
  assert.equal(shippingCents(100000), 0)
})
