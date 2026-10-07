import { useState } from 'react'
import { Link } from 'react-router'
import { API_URL } from './api'
import { buildCartLines, priceToCents } from './cart'
import { useCart } from './cart-context'
import { emptyForm, flattenErrors, orderPayload, validateCheckout } from './checkout'
import { formatPrice } from './format'
import OrderTotals from './OrderTotals'
import { useDiscount } from './useDiscount'

// Campo del modulo con la sua etichetta e l'eventuale messaggio di errore
function Field({ label, error, ...inputProps }) {
  return (
    <label className="checkout__field">
      {label}
      <input aria-invalid={Boolean(error)} {...inputProps} />
      {error && <span className="checkout__error">{error}</span>}
    </label>
  )
}

function CheckoutPage({ products, onOrderPlaced }) {
  const { items, discountCode, clearCart } = useCart()
  const [form, setForm] = useState(emptyForm)
  // errors: errori del modulo, per campo. Si riempiono al primo tentativo di invio
  const [errors, setErrors] = useState({})
  // submitting: true mentre l'ordine è in viaggio verso il server (evita il doppio invio)
  const [submitting, setSubmitting] = useState(false)
  // serverErrors: messaggi di errore arrivati dal backend (es. stock insufficiente)
  const [serverErrors, setServerErrors] = useState([])
  // order: l'ordine creato dal backend; quando c'è, la pagina mostra la conferma
  const [order, setOrder] = useState(null)
  // Sconto del codice applicato nel carrello (se c'è), verificato dal backend
  const discount = useDiscount(items, discountCode)

  const lines = buildCartLines(items, products)
  const hasProblems = lines.some((line) => line.problem) || discount.status === 'invalid'
  const checkingDiscount = discount.status === 'checking'

  // La conferma va controllata per prima: dopo l'acquisto il carrello è vuoto
  if (order) {
    return (
      <div className="checkout">
        <h2>Ordine confermato</h2>
        <p>
          Grazie! Il tuo ordine è il numero <strong>#{order.id}</strong>.
        </p>
        <ul className="checkout__summary">
          {order.items.map((item) => (
            <li key={`${item.product}-${item.size}`}>
              {item.quantity} x {item.product_name} (taglia {item.size}) —{' '}
              {formatPrice((priceToCents(item.unit_price) * item.quantity) / 100)}
            </li>
          ))}
        </ul>
        {/* Importi presi dalla risposta del server, non calcolati nel browser */}
        <p>Subtotale: {formatPrice(order.subtotal)}</p>
        {order.discount_code && (
          <p>
            Sconto {order.discount_code}: −{formatPrice(order.discount_amount)}
          </p>
        )}
        <p>
          Spedizione: {Number(order.shipping_cost) === 0 ? 'gratuita' : formatPrice(order.shipping_cost)}
        </p>
        <p className="cart__total">
          Totale: <strong>{formatPrice(order.total)}</strong>
        </p>
        <p>Pagamento e spedizione sono simulati: nessun dato è stato inviato o salvato.</p>
        <Link to="/">Torna ai prodotti</Link>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <>
        <p>Il carrello è vuoto</p>
        <Link to="/">Continua gli acquisti</Link>
      </>
    )
  }

  const handleChange = (event) => {
    const next = { ...form, [event.target.name]: event.target.value }
    setForm(next)
    // Dopo un invio con errori, i messaggi si aggiornano mentre si corregge
    if (Object.keys(errors).length > 0) {
      setErrors(validateCheckout(next))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting || checkingDiscount) return

    const found = validateCheckout(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    setServerErrors([])
    try {
      // Si inviano SOLO gli articoli e il codice sconto: spedizione e pagamento restano nel browser
      const response = await fetch(`${API_URL}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload(lines, discountCode)),
      })
      if (response.ok) {
        setOrder(await response.json())
        clearCart()
      } else {
        const data = await response.json().catch(() => null)
        const messages = flattenErrors(data)
        setServerErrors(messages.length > 0 ? messages : ["Impossibile completare l'ordine. Riprova."])
      }
      // In entrambi i casi ricarichiamo i prodotti: lo stock è cambiato (o potrebbe esserlo)
      onOrderPlaced()
    } catch (err) {
      console.error(err)
      setServerErrors(['Impossibile contattare il server. Riprova.'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="checkout">
      <h2>Riepilogo ordine</h2>

      <ul className="checkout__summary">
        {lines.map((line) => (
          <li key={`${line.productId}-${line.size}`}>
            {line.quantity} x {line.product ? line.product.name : `Prodotto ${line.productId}`} (taglia{' '}
            {line.size})
            {line.product &&
              ` — ${formatPrice((priceToCents(line.product.price) * line.quantity) / 100)}`}
          </li>
        ))}
      </ul>
      <OrderTotals lines={lines} discount={discount} />
      {discount.status === 'invalid' && <p className="cart__problem">{discount.error}</p>}

      {serverErrors.length > 0 && (
        <div role="alert" className="checkout__server-error">
          <p>L'ordine non è stato completato:</p>
          <ul>
            {serverErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {hasProblems ? (
        // Con prodotti non più disponibili, stock insufficiente o codice non valido non si può ordinare
        <>
          <p className="cart__problem">
            Alcuni articoli o il codice sconto non sono validi per questo ordine.
          </p>
          <Link to="/carrello">Torna al carrello per sistemarli</Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <fieldset>
            <legend>Dati di spedizione (simulati)</legend>
            <Field label="Nome e cognome" name="fullName" value={form.fullName} error={errors.fullName} onChange={handleChange} autoComplete="off" />
            <Field label="Email" name="email" type="email" value={form.email} error={errors.email} onChange={handleChange} autoComplete="off" />
            <Field label="Indirizzo" name="address" value={form.address} error={errors.address} onChange={handleChange} autoComplete="off" />
            <Field label="Città" name="city" value={form.city} error={errors.city} onChange={handleChange} autoComplete="off" />
            <Field label="CAP" name="postalCode" inputMode="numeric" value={form.postalCode} error={errors.postalCode} onChange={handleChange} autoComplete="off" />
          </fieldset>

          <fieldset>
            <legend>Pagamento (simulato)</legend>
            <p>
              Non inserire dati reali: questo è un sito dimostrativo. I dati della carta non vengono
              inviati né salvati.
            </p>
            {/* autoComplete="off": il browser non deve proporre carte vere */}
            <Field label="Numero carta" name="cardNumber" inputMode="numeric" placeholder="1234 5678 9012 3456" value={form.cardNumber} error={errors.cardNumber} onChange={handleChange} autoComplete="off" />
            <Field label="Scadenza (MM/AA)" name="expiry" placeholder="12/29" value={form.expiry} error={errors.expiry} onChange={handleChange} autoComplete="off" />
            <Field label="CVC" name="cvc" inputMode="numeric" value={form.cvc} error={errors.cvc} onChange={handleChange} autoComplete="off" />
          </fieldset>

          {/* Il pulsante resta disattivato mentre si verifica il codice, così non si ordina con uno sconto non controllato */}
          <button type="submit" className="cart__checkout" disabled={submitting || checkingDiscount}>
            {submitting
              ? 'Invio in corso...'
              : checkingDiscount
                ? 'Verifica del codice...'
                : 'Conferma ordine'}
          </button>
        </form>
      )}

      <p>
        <Link to="/carrello">Torna al carrello</Link>
      </p>
    </div>
  )
}

export default CheckoutPage
