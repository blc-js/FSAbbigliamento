import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter attiva la gestione degli indirizzi (/, /categoria/felpe, ...) */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
