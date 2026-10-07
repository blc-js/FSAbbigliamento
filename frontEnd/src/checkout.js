// Logica del checkout, senza React. Spedizione e pagamento sono SIMULATI: i dati del modulo
// si controllano nel browser ma non vengono mai inviati né salvati.

export const emptyForm = {
  fullName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
}

const REQUIRED = 'Campo obbligatorio'

// Restituisce un oggetto { campo: messaggio } con solo i campi non validi (vuoto = tutto ok).
// "now" si può passare per provare il controllo della scadenza.
export function validateCheckout(form, now = new Date()) {
  const errors = {}

  if (form.fullName.trim().length < 2) errors.fullName = REQUIRED
  if (!form.email.trim()) {
    errors.email = REQUIRED
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Email non valida'
  }
  if (!form.address.trim()) errors.address = REQUIRED
  if (!form.city.trim()) errors.city = REQUIRED
  if (!/^\d{5}$/.test(form.postalCode.trim())) errors.postalCode = 'Il CAP deve avere 5 cifre'

  if (!/^\d{16}$/.test(form.cardNumber.replace(/\s/g, ''))) {
    errors.cardNumber = 'Il numero della carta deve avere 16 cifre'
  }

  const expiry = /^(\d{2})\/(\d{2})$/.exec(form.expiry.trim())
  if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) {
    errors.expiry = 'Usa il formato MM/AA'
  } else if (new Date(2000 + Number(expiry[2]), Number(expiry[1]), 1) <= now) {
    // La carta vale fino alla fine del mese di scadenza: scade il primo giorno del mese dopo
    errors.expiry = 'Carta scaduta'
  }

  if (!/^\d{3,4}$/.test(form.cvc.trim())) errors.cvc = 'Il CVC deve avere 3 o 4 cifre'

  return errors
}

// Dati inviati al backend: SOLO id prodotto, taglia e quantità (+ il codice sconto, se c'è).
// Niente prezzi (li legge il backend) e niente dati del modulo.
export function orderPayload(lines, discountCode = '') {
  const payload = {
    items: lines.map((line) => ({
      product_id: line.productId,
      size: line.size,
      quantity: line.quantity,
    })),
  }
  if (discountCode) payload.discount_code = discountCode
  return payload
}

// Gli errori di DRF possono essere testi, liste o oggetti annidati: li appiattiamo in una lista di testi
export function flattenErrors(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(flattenErrors)
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenErrors)
  return []
}
