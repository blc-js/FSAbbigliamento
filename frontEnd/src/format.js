// Formattatore creato una volta sola: 79.9 -> "79,90 €"
const priceFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

// L'API invia il prezzo come testo ("79.90"): lo convertiamo in numero prima di formattarlo
export function formatPrice(price) {
  return priceFormatter.format(Number(price))
}
