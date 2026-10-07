// L'anno si calcola una volta sola, fuori dal componente (così il rendering resta "puro")
const currentYear = new Date().getFullYear()

// Footer mostrato in fondo a ogni pagina (è in App.jsx, sotto <main>).
// L'indirizzo è inventato: sostituiscilo con quello vero del negozio.
function Footer() {
  return (
    <footer className="footer">
      <p>© {currentYear} BLC. Tutti i diritti riservati.</p>
      <address>Dove trovarci: Via dei Sentieri 12, 20100 Milano (MI)</address>
    </footer>
  )
}

export default Footer
