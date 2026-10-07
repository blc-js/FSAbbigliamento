// Si eseguono con: node --test (dalla cartella frontEnd)
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { checkDiscount } from './discount.js'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const ITEMS = [{ productId: 2, size: 'M', quantity: 2 }]
const response = (status, body) => ({ ok: status < 400, status, json: async () => body })

test('codice valido: restituisce la risposta del backend e invia solo codice e articoli', async () => {
  const calls = []
  const result = { code: 'BENVENUTO10', percent: 10, subtotal: '159.80', discount_amount: '15.98', total: '143.82' }
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return response(200, result)
  }
  const signal = new AbortController().signal
  assert.deepEqual(await checkDiscount('benvenuto10', ITEMS, signal), result)

  assert.equal(calls.length, 1)
  const [url, options] = calls[0]
  assert.equal(url, 'http://127.0.0.1:8000/api/discount-codes/check/')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/json')
  assert.equal(options.signal, signal)
  assert.deepEqual(JSON.parse(options.body), {
    code: 'benvenuto10',
    items: [{ product_id: 2, size: 'M', quantity: 2 }],
  })
})

test('codice non valido: lancia un errore con il messaggio del backend', async () => {
  globalThis.fetch = async () => response(400, { code: ['Codice sconto non valido.'] })
  await assert.rejects(checkDiscount('XXX', ITEMS), { message: 'Codice sconto non valido.' })
})

test('importo minimo non raggiunto: il messaggio arriva cosi come e', async () => {
  globalThis.fetch = async () => response(400, { code: ['Il codice vale per ordini di almeno 100,00 €.'] })
  await assert.rejects(checkDiscount('SUPER20', ITEMS), { message: 'Il codice vale per ordini di almeno 100,00 €.' })
})

test('troppe richieste (429): messaggio dedicato', async () => {
  globalThis.fetch = async () => response(429, { detail: 'Request was throttled.' })
  await assert.rejects(checkDiscount('XXX', ITEMS), { message: 'Troppi tentativi: riprova tra qualche secondo.' })
})

test('errore del server senza dettagli: messaggio generico', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error('non e json') } })
  await assert.rejects(checkDiscount('XXX', ITEMS), { message: 'Impossibile verificare il codice sconto. Riprova.' })
})

test('server irraggiungibile: messaggio generico', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(checkDiscount('XXX', ITEMS), { message: 'Impossibile verificare il codice sconto. Riprova.' })
})

test('richiesta annullata: l\'errore resta AbortError (non va mostrato all\'utente)', async () => {
  globalThis.fetch = async () => {
    const error = new Error('annullata')
    error.name = 'AbortError'
    throw error
  }
  await assert.rejects(checkDiscount('XXX', ITEMS), { name: 'AbortError' })
})
