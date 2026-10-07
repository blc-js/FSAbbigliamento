// Indirizzo base dell'API Django. In produzione arriva dalla variabile VITE_API_URL (impostata su Vercel);
// in locale, o nei test con Node dove import.meta.env non esiste, si usa il server di sviluppo.
export const API_URL = import.meta.env?.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
