// Spedizione: stesse regole del backend (SHIPPING_COST e FREE_SHIPPING_ABOVE in models.py).
// Se si cambiano, vanno cambiate in entrambi i posti. Qui servono solo per mostrare l'importo
// nel carrello; all'ordine conta sempre il calcolo del backend.
export const SHIPPING_COST_CENTS = 1000 // 10,00 €
export const FREE_SHIPPING_ABOVE_CENTS = 5000 // gratuita sopra 50,00 € (esattamente 50,00 € paga)

// Costo di spedizione per un importo di articoli (già scontato), in centesimi
export function shippingCents(goodsCents) {
  return goodsCents > FREE_SHIPPING_ABOVE_CENTS ? 0 : SHIPPING_COST_CENTS
}
