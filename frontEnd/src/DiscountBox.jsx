import { useState } from 'react'
import { checkDiscount } from './discount'
import { formatPrice } from './format'

// Riquadro del codice sconto nel carrello. "discount" è lo stato calcolato da useDiscount
function DiscountBox({ items, code, discount, onApply, onRemove }) {
  const [input, setInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  const handleApply = async (event) => {
    event.preventDefault()
    const typed = input.trim()
    if (!typed) {
      setError('Inserisci un codice sconto')
      return
    }
    setApplying(true)
    setError('')
    try {
      // Il codice si salva solo se il backend lo accetta per questo carrello
      const result = await checkDiscount(typed, items)
      onApply(result.code)
      setInput('')
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  if (code) {
    return (
      <div className="discount">
        <p>
          Codice sconto: <strong>{code}</strong>{' '}
          <button type="button" onClick={onRemove}>
            Rimuovi codice
          </button>
        </p>
        {discount.status === 'checking' && <p>Verifica del codice...</p>}
        {discount.status === 'valid' && (
          <p className="discount__ok">
            Sconto {discount.result.percent}%: −{formatPrice(discount.result.discount_amount)}
          </p>
        )}
        {discount.status === 'invalid' && <p className="cart__problem">{discount.error}</p>}
      </div>
    )
  }

  return (
    <form className="discount" onSubmit={handleApply} noValidate>
      <label>
        Codice sconto
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="submit" disabled={applying}>
        {applying ? 'Verifica...' : 'Applica'}
      </button>
      {error && <p className="cart__problem">{error}</p>}
    </form>
  )
}

export default DiscountBox
