import { useState } from 'react'
import { Link } from 'react-router'
import { quantityOfProduct } from './cart'
import { useCart } from './cart-context'
import { formatPrice } from './format'

function ProductCard({ product }) {
  // Prima foto del prodotto (può non esserci)
  const image = product.images[0]
  const { items, addItem } = useCart()
  // size: taglia scelta nel pannello ('' finché non ne sceglie una)
  const [size, setSize] = useState('')
  // message: conferma mostrata dopo l'aggiunta al carrello
  const [message, setMessage] = useState('')

  // Lo stock è unico per prodotto: si possono aggiungere solo i pezzi non ancora nel carrello
  const available = Math.max(0, product.stock - quantityOfProduct(items, product.id))

  const handleAdd = () => {
    addItem(product.id, size, 1)
    setMessage(`Aggiunto al carrello: taglia ${size}`)
  }

  return (
    <article className="product-card">
      {/* Foto, nome e prezzo sono un link al dettaglio. I pulsanti stanno fuori dal link:
          in HTML un link non può contenere pulsanti */}
      <Link to={`/prodotto/${product.id}`}>
        {image ? (
          <img
            className="product-card__image"
            src={image.image}
            alt={image.alt_text || product.name}
          />
        ) : (
          // Segnaposto grigio se il prodotto non ha foto
          <div className="product-card__image product-card__image--empty" />
        )}
        <div className="product-card__body">
          <h2>{product.name}</h2>
          <p className="product-card__price">{formatPrice(product.price)}</p>
          <p className="product-card__meta">{product.color}</p>
        </div>
      </Link>

      {/* Pannello nascosto: compare sotto la scheda al passaggio del mouse (o con il focus da tastiera) */}
      <div className="product-card__extra">
        {product.description && (
          <p className="product-card__description">{product.description}</p>
        )}

        <div
          className="product-card__sizes"
          role="group"
          aria-label={`Taglia di ${product.name}`}
        >
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

        {/* Il pulsante resta disattivato finché manca la taglia o non ci sono pezzi disponibili */}
        <button
          type="button"
          className="product-card__add"
          disabled={!size || available === 0}
          onClick={handleAdd}
        >
          Aggiungi al carrello
        </button>

        <p className="product-card__status" role="status">
          {available === 0
            ? product.stock === 0
              ? 'Prodotto esaurito'
              : 'Hai già nel carrello tutti i pezzi disponibili'
            : message || (size ? '' : 'Scegli una taglia')}
        </p>
      </div>
    </article>
  )
}

export default ProductCard
