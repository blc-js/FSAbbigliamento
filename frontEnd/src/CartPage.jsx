import { Link } from 'react-router'
import { buildCartLines, clampQuantity, priceToCents } from './cart'
import { useCart } from './cart-context'
import DiscountBox from './DiscountBox'
import { formatPrice } from './format'
import OrderTotals from './OrderTotals'
import { useDiscount } from './useDiscount'

// Testo da mostrare per i problemi trovati da buildCartLines
function problemText(line) {
  if (line.problem === 'unavailable') return 'Questo prodotto non è più disponibile'
  if (line.problem === 'size') return `La taglia ${line.size} non è più disponibile`
  if (line.max === 0) return 'Prodotto esaurito'
  return `Disponibili solo ${line.max} pezzi`
}

function CartPage({ products }) {
  const {
    items,
    updateQuantity,
    removeItem,
    discountCode,
    applyDiscountCode,
    removeDiscountCode,
  } = useCart()
  // Verifica il codice sconto (se c'è) e lo riverifica a ogni modifica del carrello
  const discount = useDiscount(items, discountCode)

  // Nel carrello salvato ci sono solo id, taglia e quantità: nome, prezzo e foto arrivano dai prodotti
  const lines = buildCartLines(items, products)
  const hasProblems = lines.some((line) => line.problem) || discount.status === 'invalid'

  if (lines.length === 0) {
    return (
      <>
        <p>Il carrello è vuoto</p>
        <Link to="/">Continua gli acquisti</Link>
      </>
    )
  }

  return (
    <div className="cart">
      <h2>Carrello</h2>

      {/* Due riquadri con un bordo sottile: a sinistra gli articoli, a destra costi e pulsanti */}
      <div className="cart__layout">
        <section className="cart__box" aria-label="Articoli nel carrello">
          <ul className="cart__lines">
            {lines.map((line) => {
              const { product } = line
              const image = product?.images[0]
              return (
                <li key={`${line.productId}-${line.size}`} className="cart__line">
                  {image ? (
                    <img
                      className="cart__image"
                      src={image.image}
                      alt={image.alt_text || product.name}
                    />
                  ) : (
                    // Segnaposto grigio se manca la foto (o il prodotto non esiste più)
                    <div className="cart__image" />
                  )}

                  <div className="cart__info">
                    {product ? (
                      <Link to={`/prodotto/${product.id}`}>{product.name}</Link>
                    ) : (
                      <span>Prodotto {line.productId}</span>
                    )}
                    <p>Taglia {line.size}</p>
                    {line.problem && <p className="cart__problem">{problemText(line)}</p>}
                  </div>

                  <div className="cart__actions">
                    {product && (
                      <label>
                        Quantità
                        <input
                          type="number"
                          min="1"
                          max={line.max}
                          value={line.quantity}
                          // Con 0 pezzi disponibili la riga si può solo rimuovere
                          disabled={line.max === 0}
                          aria-label={`Quantità ${product.name} taglia ${line.size}`}
                          onChange={(event) =>
                            updateQuantity(
                              line.productId,
                              line.size,
                              clampQuantity(event.target.value, line.max),
                            )
                          }
                        />
                      </label>
                    )}
                    {product && (
                      <p>
                        {formatPrice((priceToCents(product.price) * line.quantity) / 100)}
                      </p>
                    )}
                    <button
                      type="button"
                      aria-label={`Rimuovi ${product ? product.name : `prodotto ${line.productId}`} taglia ${line.size}`}
                      onClick={() => removeItem(line.productId, line.size)}
                    >
                      Rimuovi
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="cart__box cart__summary" aria-label="Riepilogo dei costi">
          {/* Subtotale, spedizione, codice sconto e totale, in quest'ordine */}
          <OrderTotals lines={lines} discount={discount} discountLine={false}>
            <DiscountBox
              items={items}
              code={discountCode}
              discount={discount}
              onApply={applyDiscountCode}
              onRemove={removeDiscountCode}
            />
          </OrderTotals>

          {/* I due pulsanti uno di fianco all'altro: "Procedi" in evidenza, "Continua gli acquisti" meno.
              Non si può procedere finché ci sono problemi (prodotto sparito, stock insufficiente, codice
              non valido...) o finché il codice sconto non è stato verificato */}
          <div className="cart__buttons">
            {hasProblems || discount.status === 'checking' ? (
              <button type="button" className="cart__checkout" disabled>
                Procedi all'ordine
              </button>
            ) : (
              <Link to="/checkout" className="cart__checkout">
                Procedi all'ordine
              </Link>
            )}
            <Link to="/" className="cart__back">
              Continua gli acquisti
            </Link>
          </div>
          {hasProblems && (
            <p className="cart__problem">
              Risolvi i problemi segnalati (modifica la quantità, rimuovi la riga o il codice sconto)
              per procedere
            </p>
          )}
          {!hasProblems && discount.status === 'checking' && (
            <p>Verifica del codice sconto in corso...</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default CartPage
