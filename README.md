# BLC – negozio di abbigliamento

Un piccolo e-commerce di abbigliamento: catalogo diviso per categorie, carrello, codici sconto e ordini.
Il backend è un'API in Django REST Framework, il frontend è una single page app in React.

È un progetto dimostrativo. Il pagamento e i dati di spedizione sono simulati e non c'è un sistema di
utenti: servono a mostrare come funziona l'acquisto, non a vendere davvero.

## Cosa si può fare

- Sfogliare il catalogo per categoria. La home mostra le prime righe di prodotti, con un pulsante per vederli tutti.
- Aprire un prodotto: foto, descrizione, colore, disponibilità e scelta della taglia.
- Aggiungere al carrello dalla pagina del prodotto o direttamente dalla scheda nella griglia.
- Modificare il carrello, che resta salvato nel browser anche se si chiude la pagina.
- Applicare un codice sconto (percentuale, con un limite di utilizzi e un importo minimo).
- Vedere la spedizione: 10 € fissi, gratuita se gli articoli (dopo lo sconto) superano i 50 €.
- Completare un ordine simulato. Lo stock dei prodotti si aggiorna.
- Gestire prodotti, categorie, foto e codici sconto, e consultare gli ordini, dall'admin di Django.

## Tecnologie

| Parte | Cosa |
|---|---|
| Backend | Python, Django 6, Django REST Framework, django-cors-headers, Pillow |
| Database | SQLite (in sviluppo) |
| Frontend | React 19, React Router, Vite |
| Stile | CSS semplice, senza librerie di componenti |
| Test | test di Django per l'API, `node --test` per la logica del frontend |

## Avvio in locale

Servono Python 3.12 o superiore e Node.js 20 o superiore (provato con Python 3.14 e Node 24).

**Backend** (da una prima finestra del terminale):

```bash
cd backEnd
python -m venv venv
venv\Scripts\activate          # su macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_products
python manage.py createsuperuser   # facoltativo, serve per entrare nell'admin
python manage.py runserver
```

`seed_products` crea le categorie, 15 prodotti di esempio (con le foto che trova in `backEnd/media`) e due codici
sconto. Si può rilanciare senza creare duplicati e senza azzerare lo stock.

**Frontend** (da una seconda finestra):

```bash
cd frontEnd
npm install
npm run dev
```

Poi:

- sito: http://localhost:5173
- API: http://127.0.0.1:8000/api/
- admin: http://127.0.0.1:8000/admin/

Il sito va aperto da `localhost:5173` (non da `127.0.0.1:5173`): il backend accetta le richieste solo da quell'indirizzo.

Codici sconto di esempio: `BENVENUTO10` (10%) e `SUPER20` (20%, per ordini da almeno 100 €, massimo 10 utilizzi).

## API

| Metodo | Indirizzo | A cosa serve |
|---|---|---|
| GET | `/api/products/` | Lista dei prodotti, dal più recente. Con `?category=<slug>` solo quelli di una categoria |
| GET | `/api/products/<id>/` | Dettaglio di un prodotto |
| GET | `/api/categories/` | Lista delle categorie |
| POST | `/api/discount-codes/check/` | Controlla un codice sul carrello e restituisce sconto, spedizione e totale |
| POST | `/api/orders/` | Crea un ordine e scala lo stock |

## Come è fatto

```
backEnd/
  config/                  impostazioni e URL principali del progetto Django
  abbigliamento/           l'app del negozio
    models.py              categorie, prodotti, foto, ordini, codici sconto
    serializers.py         da modello a JSON, e la logica con cui si crea un ordine
    views.py, urls.py      gli endpoint
    admin.py               pannello di amministrazione
    tests.py               test dell'API
    management/commands/   seed_products: dati di esempio
  media/                   foto dei prodotti
frontEnd/
  public/                  immagine del banner e favicon
  src/
    App.jsx                struttura della pagina e rotte
    *Page.jsx, Product*.jsx, ...   pagine e componenti
    cart.js, checkout.js, discount.js, shipping.js   logica senza interfaccia, con i suoi test (*.test.js)
    App.css, index.css     stili
```

Alcune scelte che vale la pena sapere:

- **Il totale lo calcola sempre il backend.** Dal browser arrivano solo prodotti, taglie, quantità e il codice
  sconto; i prezzi, lo sconto e la spedizione si leggono dal database. Il frontend li ricalcola solo per mostrarli
  nel carrello.
- **L'ordine è una transazione.** Controlla taglie, stock e codice, scala lo stock e crea l'ordine. Se qualcosa
  non va, non cambia niente.
- **Il carrello è nel browser** (`localStorage`) e contiene solo id, taglia e quantità. Nome, prezzo e foto si
  leggono dall'API.
- **Non si salvano dati personali.** I campi di spedizione e pagamento del checkout si controllano nel browser
  ma non vengono inviati.
- **Ordini e verifica dei codici hanno un limite di richieste** (30 al minuto per indirizzo IP).

## Test

```bash
cd backEnd && python manage.py test        # API, ordini, sconti, spedizione, comando seed_products
cd frontEnd && node --test                 # logica del carrello, checkout, sconti e spedizione
cd frontEnd && npm run lint
```

## Limiti e cose da migliorare

È un progetto di base e ci sono parecchie cose da sistemare.

- Non ci sono utenti né login: gli ordini non sono collegati a nessuno.
- Lo stock è uno solo per prodotto, la taglia si sceglie all'acquisto e non ha una disponibilità propria.
  Per averla servirebbe un modello a parte (`ProductVariant`), segnato con un `TODO` in `models.py`.
- Le regole della spedizione sono scritte due volte, nel backend e in `shipping.js`. Meglio farle arrivare dall'API.
- La configurazione è quella di sviluppo: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, l'origine CORS e l'indirizzo
  dell'API nel frontend (`src/api.js`) sono scritti nel codice e vanno spostati in variabili d'ambiente.
- Le foto sono file locali in `media/`: per pubblicare il sito serve uno spazio esterno per i file.
- Si testa la logica del frontend ma non i componenti.
- Mancano paginazione, ricerca e ordinamento dei prodotti.
- L'indirizzo nel footer è di esempio.

## Pubblicazione

Da fare. L'idea è mettere il frontend su Vercel, il backend su Render e il database PostgreSQL su Supabase.
Prima va resa configurabile la parte descritta sopra (variabili d'ambiente, database, `ALLOWED_HOSTS`, CORS,
indirizzo dell'API) e aggiunti un server per Django in produzione e la gestione dei file statici.
