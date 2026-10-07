import { useParams } from 'react-router'
import ProductCard from './ProductCard'

// expanded e onExpand arrivano da App, che non viene mai smontato: così "Mostra tutti i prodotti"
// resta valido anche dopo aver aperto un prodotto e essere tornati in home
function ProductList({ products, expanded = false, onExpand }) {
  // slug è la parte variabile dell'indirizzo: "felpe" in /categoria/felpe, undefined nella home
  const { slug } = useParams()

  // Con uno slug teniamo solo i prodotti che hanno quella categoria, altrimenti li mostriamo tutti
  const visibleProducts = slug
    ? products.filter((product) =>
        product.categories.some((category) => category.slug === slug),
      )
    : products

  if (visibleProducts.length === 0) {
    return (
      <p>
        {slug ? 'Nessun prodotto in questa categoria' : 'Nessun prodotto disponibile'}
      </p>
    )
  }

  // Solo la home è limitata a 3 righe di schede: le righe le nasconde il CSS (product-list--limited)
  // perché quante schede fanno 3 righe dipende dal numero di colonne, che cambia con lo schermo
  const limited = !slug && !expanded

  // product-list--category: le pagine di categoria hanno 3 colonne invece di 4 (lo decide il CSS)
  const classes = ['product-list']
  if (limited) classes.push('product-list--limited')
  if (slug) classes.push('product-list--category')

  return (
    <div className={classes.join(' ')}>
      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {/* Anche quando la griglia è limitata, tutti i prodotti restano in pagina: il CSS nasconde
          il pulsante se non c'è nessuna scheda da mostrare */}
      {limited && (
        <button type="button" className="product-list__show-all" onClick={onExpand}>
          Mostra tutti i prodotti
        </button>
      )}
    </div>
  )
}

export default ProductList
