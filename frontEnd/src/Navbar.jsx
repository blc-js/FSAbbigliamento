import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { API_URL } from './api'
import { useCart } from './cart-context'

function Navbar() {
  // categories: elenco ricevuto da /api/categories/ (vuoto finché non arriva)
  const [categories, setCategories] = useState([])
  // count: numero totale di pezzi nel carrello, mostrato accanto all'icona
  const { count } = useCart()

  useEffect(() => {
    fetch(`${API_URL}/categories/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Errore del server (${response.status})`)
        }
        return response.json()
      })
      .then((data) => setCategories(data))
      // Se le categorie non si caricano il sito resta usabile: rimane solo il link "Home Page"
      .catch((err) => console.error(err))
  }, [])

  // "Nuovi Arrivi" va subito dopo Home Page; le altre categorie restano nell'ordine dell'API
  const orderedCategories = [
    ...categories.filter((category) => category.slug === 'nuovi-arrivi'),
    ...categories.filter((category) => category.slug !== 'nuovi-arrivi'),
  ]

  return (
    <nav className="navbar">
      {/* "end" evita che "Home Page" risulti attivo anche nelle pagine delle categorie */}
      <NavLink to="/" end>
        Home Page
      </NavLink>
      {orderedCategories.map((category) => (
        // NavLink aggiunge da solo la classe "active" al link della pagina corrente
        <NavLink key={category.id} to={`/categoria/${category.slug}`}>
          {category.name}
        </NavLink>
      ))}
      {/* Icona del carrello: il numero dei pezzi compare solo se il carrello non è vuoto */}
      <NavLink
        to="/carrello"
        className="navbar__cart"
        aria-label={`Carrello, ${count} ${count === 1 ? 'articolo' : 'articoli'}`}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
        {count > 0 && <span className="navbar__cart-count">{count}</span>}
      </NavLink>
    </nav>
  )
}

export default Navbar
