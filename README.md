# BLC – E-commerce di abbigliamento

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-6-092E20?logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/DRF-3.18-A30000)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)

Negozio online di abbigliamento full stack: catalogo per categorie, carrello, codici sconto e ordini, con
**API REST in Django** e **single page app in React**. Il focus è sulla correttezza del flusso d'acquisto:
prezzi, sconti e stock sono sempre decisi dal server, mai fidandosi del browser.

> Progetto dimostrativo: pagamento e dati di spedizione sono simulati e non c'è un sistema di utenti.

**Demo online:** https://abbigliamento2-0.vercel.app · **API:** https://abbigliamento2-0.onrender.com/api/

Per provarla: aggiungi qualche capo al carrello, inserisci il codice `BENVENUTO10` e completa il checkout (i dati
sono finti, non viene salvato niente di personale).

## Tech stack

| Livello | Tecnologie |
|---|---|
| Frontend | React 19, React Router, Vite, CSS semplice; lint con Oxlint |
| Backend | Python, Django 6, Django REST Framework, django-cors-headers, WhiteNoise, Gunicorn |
| Database | PostgreSQL su Supabase (produzione), SQLite (locale) |
| Deploy | Vercel (frontend), Render (backend), Supabase (database) |
| Test | test di Django per l'API, `node --test` per la logica del frontend |

## Funzionalità

- Catalogo con filtro per categoria; scheda prodotto con foto, colore, disponibilità e scelta della taglia.
- Carrello persistente nel browser (`localStorage`), modificabile dalla pagina prodotto o dalla griglia.
- Codici sconto in percentuale con limite di utilizzi e importo minimo, ricontrollati a ogni modifica del carrello.
- Spedizione: 10 € fissi, gratuita sopra i 50 € di articoli (dopo lo sconto).
- Checkout simulato con validazione del modulo; l'ordine aggiorna lo stock.
- Admin di Django per gestire prodotti, categorie, foto, codici sconto e consultare gli ordini.

## Scelte progettuali

- **Il totale lo calcola sempre il backend.** Dal browser arrivano solo id prodotto, taglia, quantità e codice
  sconto; prezzi, sconto e spedizione si leggono dal database. Il frontend li ricalcola solo per mostrarli.
- **L'ordine è una transazione atomica.** Convalida taglie e stock, scala lo stock con un `UPDATE` condizionale
  (sicuro anche con ordini simultanei) e consuma il codice sconto; se qualcosa fallisce non cambia niente.
- **Prezzo storico.** Ogni riga d'ordine copia il prezzo al momento dell'acquisto.
- **Nessun dato personale salvato.** I campi di spedizione e pagamento non vengono inviati.
- **Rate limiting** (30 richieste/min per IP) su ordini e verifica dei codici, contro tentativi a raffica.
- **Configurazione da variabili d'ambiente**; `DEBUG` è spento per default e la `SECRET_KEY` è obbligatoria fuori
  dallo sviluppo locale.
- **Query ottimizzate:** `prefetch_related` sulla lista prodotti (3 query invece di 31 con 15 prodotti).

## Struttura del progetto

```
backEnd/
  config/                  impostazioni e URL principali di Django
  abbigliamento/           app del negozio
    models.py              categorie, prodotti, foto, ordini, codici sconto
    serializers.py         JSON e logica transazionale di creazione ordine
    views.py, urls.py      endpoint
    admin.py               pannello di amministrazione
    tests.py               test dell'API
    management/commands/   seed_products: dati di esempio
  media/                   foto dei prodotti
frontEnd/
  src/
    App.jsx                layout e rotte
    *Page.jsx, Product*.jsx, ...   pagine e componenti
    cart.js, checkout.js, discount.js, shipping.js   logica senza interfaccia, con test (*.test.js)
    CartProvider.jsx, useDiscount.js   stato del carrello e verifica dello sconto
```

## Installazione in locale

Servono Python 3.12+ e Node.js 20+.

```bash
git clone https://github.com/blc-js/abbigliamento2.0.git
cd abbigliamento2.0
```

**Backend**

```bash
cd backEnd
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # Windows: copy .env.example .env
python manage.py migrate
python manage.py seed_products # categorie, 15 prodotti, 2 codici sconto (ripetibile)
python manage.py createsuperuser   # facoltativo, per l'admin
python manage.py runserver
```

**Frontend** (in un secondo terminale)

```bash
cd frontEnd
npm install
cp .env.example .env.local     # facoltativo: senza, usa http://127.0.0.1:8000/api
npm run dev
```

- Sito: http://localhost:5173 (aprilo da `localhost`, non da `127.0.0.1`: il CORS accetta solo quello)
- API: http://127.0.0.1:8000/api/ · Admin: http://127.0.0.1:8000/admin/
- Codici sconto di prova: `BENVENUTO10` (10%) e `SUPER20` (20%, ordini da almeno 100 €, 10 utilizzi)

### Variabili d'ambiente

| Variabile | Dove | Descrizione |
|---|---|---|
| `SECRET_KEY` | backend | Obbligatoria se `DEBUG` è spento |
| `DEBUG` | backend | `True` solo in locale |
| `DATABASE_URL` | backend | PostgreSQL; se assente si usa SQLite |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | backend | Valori separati da virgola |
| `CORS_ALLOWED_ORIGINS` | backend | Indirizzo del frontend in produzione |
| `VITE_API_URL` | frontend | Indirizzo base dell'API |

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/products/` | Lista prodotti, dal più recente; `?category=<slug>` per filtrare |
| GET | `/api/products/<id>/` | Dettaglio prodotto |
| GET | `/api/categories/` | Lista categorie |
| POST | `/api/discount-codes/check/` | Verifica un codice sul carrello: sconto, spedizione e totale |
| POST | `/api/orders/` | Crea un ordine e scala lo stock |

## Test

```bash
cd backEnd && python manage.py test     # API, ordini, sconti, spedizione, seed
cd frontEnd && node --test              # carrello, checkout, sconti, spedizione
cd frontEnd && npm run lint
```

## Possibili sviluppi

- Utenti e login, con ordini collegati all'account.
- Stock per taglia (modello `ProductVariant`, vedi `TODO` in `models.py`).
- Regole di spedizione esposte dall'API invece che duplicate nel frontend.
- Paginazione, ricerca e ordinamento; spazio esterno per le foto; test dei componenti React.
