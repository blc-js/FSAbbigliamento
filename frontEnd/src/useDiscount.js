import { useEffect, useState } from 'react'
import { checkDiscount } from './discount'

// Attesa dopo l'ultima modifica del carrello prima di ricontrollare il codice: così cliccare più
// volte sui pulsanti della quantità non manda una richiesta per ogni clic (il backend ne limita il numero)
const DEBOUNCE_MS = 400

// Verifica il codice sconto sul carrello attuale e lo riverifica a ogni modifica.
// Restituisce { status, result, error } con status:
//   'none'     nessun codice applicato
//   'checking' verifica in corso
//   'valid'    codice valido: result = { code, percent, subtotal, discount_amount, total }
//   'invalid'  codice non valido (o non più valido): error = messaggio da mostrare
export function useDiscount(items, code) {
  // Ultima risposta ricevuta, con la richiesta (key) a cui si riferisce
  const [reply, setReply] = useState({ key: '', result: null, error: '' })

  const active = Boolean(code) && items.length > 0
  const key = active ? JSON.stringify([code, items]) : ''

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      checkDiscount(code, items, controller.signal)
        .then((result) => setReply({ key, result, error: '' }))
        .catch((error) => {
          if (error.name !== 'AbortError') {
            setReply({ key, result: null, error: error.message })
          }
        })
    }, DEBOUNCE_MS)
    // Se il carrello cambia prima della risposta, la richiesta vecchia viene annullata
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, key, code, items])

  if (!active) return { status: 'none', result: null, error: '' }
  // Finché non è arrivata la risposta per il carrello attuale, la verifica è in corso
  if (reply.key !== key) return { status: 'checking', result: null, error: '' }
  if (reply.error) return { status: 'invalid', result: null, error: reply.error }
  return { status: 'valid', result: reply.result, error: '' }
}
