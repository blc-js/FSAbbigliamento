// Banner a tutta larghezza sotto la navbar. La foto è public/banner.jpg: per cambiarla basta
// sostituire quel file (stesso nome). Il testo si cambia qui sotto.
function Banner() {
  return (
    <section className="banner">
      {/* alt vuoto: la foto è decorativa, il messaggio è nel testo sopra di essa */}
      <img className="banner__image" src="/banner.jpg" alt="" />
      <div className="banner__text">
        <h2>Prossimamente</h2>
        <p>Nuovi arrivi</p>
      </div>
    </section>
  )
}

export default Banner
