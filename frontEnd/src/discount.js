// Le estensioni .js servono ai test di Node, che le richiede (Vite funziona anche senza)
import { API_URL } from './api.js'
import { flattenErrors, orderPayload } from './checkout.js'

// Chiede al backend se il codice vale per questo carrello e quanto sconto dà.
// Risponde con { code, percent, subtotal, discount_amount, total }; se il codice non vale
// lancia un errore con il messaggio da mostrare. "signal" permette di annullare la richiesta.
export async function checkDiscount(code, items, signal) {
  let response
  try {
    response = await fetch(`${API_URL}/discount-codes/check/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...orderPayload(items) }),
      signal,
    })
  } catch (error) {
    // Una richiesta annullata di proposito non è un errore da mostrare
    if (error.name === 'AbortError') throw error
    throw new Error('Impossibile verificare il codice sconto. Riprova.')
  }

  const data = await response.json().catch(() => null)
  if (response.ok) return data
  if (response.status === 429) {
    throw new Error('Troppi tentativi: riprova tra qualche secondo.')
  }
  throw new Error(flattenErrors(data)[0] ?? 'Impossibile verificare il codice sconto. Riprova.')
}
