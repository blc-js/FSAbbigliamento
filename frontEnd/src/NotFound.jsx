import { Link } from 'react-router'

// Pagina mostrata per qualsiasi indirizzo del sito che non esiste (rotta "*" in App.jsx).
// È solo frontend: il backend non c'entra, perché le pagine del sito le serve Vite, non Django
function NotFound() {
  return (
    <div className="not-found">
      <h2>Pagina non trovata</h2>
      <p>L'indirizzo che hai aperto non esiste.</p>
      <Link to="/" className="not-found__home">
        Torna alla home
      </Link>
    </div>
  )
}

export default NotFound
