import { useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { API_URL } from './api'
import Banner from './Banner'
import CartPage from './CartPage'
import CartProvider from './CartProvider'
import CheckoutPage from './CheckoutPage'
import Footer from './Footer'
import Navbar from './Navbar'
import NotFound from './NotFound'
import ProductDetail from './ProductDetail'
import ProductList from './ProductList'
import './App.css'

// Chiede all'API la lista dei prodotti (con lo stock aggiornato)
function fetchProducts() {
  return fetch(`${API_URL}/products/`).then((response) => {
    // fetch non genera errori per risposte 404/500: li controlliamo noi
    if (!response.ok) {
      throw new Error(`Errore del server (${response.status})`)
    }
    return response.json()
  })
}

function App() {
  // pathname: l'indirizzo corrente ("/" nella home): serve a mostrare il banner solo lì
  const { pathname } = useLocation()
  // products: lista ricevuta dall'API (vuota finché i dati non arrivano)
  const [products, setProducts] = useState([])
  // loading: true finché la richiesta è in corso
  const [loading, setLoading] = useState(true)
  // error: messaggio da mostrare se qualcosa va storto
  const [error, setError] = useState(null)
  // homeExpanded: true dopo il clic su "Mostra tutti i prodotti" (la home mostra solo 3 righe).
  // Sta qui perché App resta montato: la scelta sopravvive al passaggio tra le pagine
  const [homeExpanded, setHomeExpanded] = useState(false)

  // Con [] come secondo argomento, l'effetto parte una sola volta all'apertura della pagina
  useEffect(() => {
    fetchProducts()
      .then((data) => setProducts(data))
      // Intercetta sia l'errore lanciato sopra sia gli errori di rete (es. backend spento)
      .catch((err) => {
        console.error(err)
        setError('Impossibile caricare i prodotti')
      })
      .finally(() => setLoading(false))
  }, [])

  // Ricarica i prodotti dopo un ordine, per aggiornare lo stock. Non tocca "loading" né "error":
  // altrimenti la pagina corrente (la conferma dell'ordine) sparirebbe durante il ricaricamento
  const refreshProducts = () => {
    fetchProducts()
      .then((data) => setProducts(data))
      .catch((err) => console.error(err))
  }

  return (
    // Un solo CartProvider sopra a tutto: Navbar e pagine condividono lo stesso carrello
    <CartProvider>
      <header>
        <h1>BLC</h1>
        <Navbar />
      </header>
      {/* Il banner sta fuori da <main> (che ha i margini laterali) per occupare tutta la larghezza */}
      {pathname === '/' && <Banner />}
      <main>
        {loading && <p>Caricamento...</p>}
        {error && <p>{error}</p>}
        {!loading && !error && (
          // ProductList legge la categoria dall'indirizzo (:slug), ProductDetail il prodotto (:id)
          <Routes>
            <Route
              path="/"
              element={
                <ProductList
                  products={products}
                  expanded={homeExpanded}
                  onExpand={() => setHomeExpanded(true)}
                />
              }
            />
            <Route
              path="/categoria/:slug"
              element={<ProductList products={products} />}
            />
            <Route
              path="/prodotto/:id"
              element={<ProductDetail products={products} />}
            />
            <Route path="/carrello" element={<CartPage products={products} />} />
            <Route
              path="/checkout"
              element={
                <CheckoutPage products={products} onOrderPlaced={refreshProducts} />
              }
            />
            {/* "*" = qualsiasi altro indirizzo: va messa per ultima */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </main>
      <Footer />
    </CartProvider>
  )
}

export default App
