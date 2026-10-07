import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { clampQuantity, quantityOfProduct } from './cart'
import { useCart } from './cart-context'
import { formatPrice } from './format'

function ProductDetail({ products }) {
  // id è la parte variabile dell'indirizzo: "5" in /prodotto/5 (arriva come testo)
  const { id } = useParams()
  // selected: posizione della foto grande tra quelle del prodotto
  const [selected, setSelected] = useState(0)
  // size: taglia scelta dal cliente ('' finché non ne sceglie una)
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  // message: conferma mostrata dopo l'aggiunta al carrello
  const [message, setMessage] = useState('')
  const { items, addItem } = useCart()

  // Cerchiamo il prodotto tra quelli già caricati da App
  const product = products.find((item) => item.id === Number(id))

  if (!product) {
    return (
      <>
        <p>Prodotto non trovato</p>
        <Link to="/">Torna ai prodotti</Link>
      </>
    )
  }

  const mainImage = product.images[selected]

  // Lo stock è unico per prodotto: si possono aggiungere solo i pezzi non ancora nel carrello (in qualsiasi taglia)
  const inCart = quantityOfProduct(items, product.id)
  const available = Math.max(0, product.stock - inCart)
  const chosenQuantity = clampQuantity(quantity, available)

  const handleAdd = () => {
    addItem(product.id, size, chosenQuantity)
    setQuantity(1)
    setMessage(`Aggiunto al carrello: ${chosenQuantity} x taglia ${size}`)
  }

  return (
    <div className="product-detail">
      <Link to="/" className="product-detail__back">
        ← Torna ai prodotti
      </Link>

      <div className="product-detail__content">
        <div className="product-detail__gallery">
          {mainImage ? (
            <img
              className="product-detail__image"
              src={mainImage.image}
              alt={mainImage.alt_text || product.name}
            />
          ) : (
            // Segnaposto grigio se il prodotto non ha foto
            <div className="product-detail__image" />
          )}

          {/* Le miniature servono solo se c'è più di una foto */}
          {product.images.length > 1 && (
            <div className="product-detail__thumbs">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className={index === selected ? 'active' : ''}
                  onClick={() => setSelected(index)}
                >
                  <img src={image.image} alt={image.alt_text || product.name} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail__info">
          {/* Titolo con di fianco le categorie del prodotto: ogni link porta alla relativa sezione */}
          <div className="product-detail__heading">
            <h2>{product.name}</h2>
            <p className="product-detail__categories">
              {product.categories.map((category) => (
                <Link key={category.id} to={`/categoria/${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </p>
          </div>

          {/* Prezzo da solo, subito sotto il titolo */}
          <p className="product-detail__price">{formatPrice(product.price)}</p>

          {/* Colore e disponibilità sulla riga sotto */}
          <div className="product-detail__meta">
            <span>{product.color}</span>
            <span>
              {product.stock > 0 ? `Disponibili: ${product.stock}` : 'Esaurito'}
              {inCart > 0 && ` (nel carrello: ${inCart})`}
            </span>
          </div>

          {product.description && <p>{product.description}</p>}

          {/* Scelta della taglia: l'elenco arriva dall'API (capi XS-XXL, scarpe 38-45) */}
          <p>Taglia</p>
          <div className="product-detail__sizes" role="group" aria-label="Taglia">
            {product.available_sizes.map((option) => (
              <button
                key={option}
                type="button"
                className={option === size ? 'active' : ''}
                aria-pressed={option === size}
                onClick={() => {
                  setSize(option)
                  setMessage('')
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Quantità e pulsante sulla stessa riga. Il pulsante resta disattivato finché manca
              la taglia o non ci sono pezzi disponibili */}
          <div className="product-detail__buy">
            <label className="product-detail__quantity">
              Quantità
              <input
                type="number"
                min="1"
                max={available}
                value={chosenQuantity}
                disabled={available === 0}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="product-detail__add"
              disabled={!size || available === 0}
              onClick={handleAdd}
            >
              Aggiungi al carrello
            </button>
          </div>
          {product.stock === 0 && <p>Prodotto esaurito</p>}
          {product.stock > 0 && available === 0 && (
            <p>Hai già nel carrello tutti i pezzi disponibili</p>
          )}
          {available > 0 && !size && <p>Scegli una taglia</p>}
          <p role="status">{message}</p>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
