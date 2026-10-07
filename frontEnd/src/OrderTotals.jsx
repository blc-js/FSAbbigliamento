import { cartTotalCents, priceToCents } from './cart'
import { formatPrice } from './format'
import { FREE_SHIPPING_ABOVE_CENTS, shippingCents } from './shipping'

// Subtotale, sconto, spedizione e totale. Con un codice valido gli importi sono quelli del backend;
// altrimenti si calcolano dalle righe del carrello.
// children: contenuto da mostrare tra la spedizione e il totale (nel carrello, il riquadro del codice
// sconto). discountLine: se false non si mostra la riga dello sconto (ci pensa chi passa i children)
function OrderTotals({ lines, discount, discountLine = true, children }) {
  const { result } = discount
  const valid = discount.status === 'valid'

  const subtotal = valid ? priceToCents(result.subtotal) : cartTotalCents(lines)
  const discountAmount = valid ? priceToCents(result.discount_amount) : 0
  const shipping = valid ? priceToCents(result.shipping_cost) : shippingCents(subtotal)
  const total = valid ? priceToCents(result.total) : subtotal + shipping

  return (
    <div className="totals">
      <p>Subtotale: {formatPrice(subtotal / 100)}</p>
      {valid && discountLine && (
        <p>
          Sconto {result.code} (−{result.percent}%): −{formatPrice(discountAmount / 100)}
        </p>
      )}
      <p>Spedizione: {shipping === 0 ? 'gratuita' : formatPrice(shipping / 100)}</p>
      {shipping > 0 && (
        <p className="totals__hint">
          Spedizione gratuita per ordini sopra {formatPrice(FREE_SHIPPING_ABOVE_CENTS / 100)}
        </p>
      )}
      {children}
      <p className="cart__total">
        Totale: <strong>{formatPrice(total / 100)}</strong>
      </p>
    </div>
  )
}

export default OrderTotals
