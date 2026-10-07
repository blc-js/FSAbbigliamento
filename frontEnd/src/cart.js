// Logica del carrello, senza React. Una riga = un prodotto in una taglia:
// { productId, size, quantity }. Si salvano solo questi dati, mai i prezzi:
// nome, prezzo e stock si leggono sempre dall'API.

export const CART_KEY = 'cart'

// localStorage può mancare o essere bloccato (es. navigazione privata): in quel caso il carrello vive solo in memoria
export function getStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isValidLine(line) {
  return (
    line !== null &&
    typeof line === 'object' &&
    Number.isInteger(line.productId) &&
    typeof line.size === 'string' &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0
  )
}

// I dati salvati possono essere vuoti o danneggiati (li può modificare chiunque): scartiamo ciò che non è valido
export function loadCart(storage = getStorage()) {
  if (!storage) return []
  try {
    const saved = JSON.parse(storage.getItem(CART_KEY))
    return Array.isArray(saved) ? saved.filter(isValidLine) : []
  } catch {
    return []
  }
}

export function saveCart(items, storage = getStorage()) {
  try {
    storage?.setItem(CART_KEY, JSON.stringify(items))
  } catch {
    // Spazio esaurito o storage bloccato: il carrello resta comunque in memoria
  }
}

const isSameLine = (line, productId, size) =>
  line.productId === productId && line.size === size

// Se la riga (prodotto + taglia) esiste aumenta la quantità, altrimenti la aggiunge
export function addToCart(items, productId, size, quantity = 1) {
  if (items.some((line) => isSameLine(line, productId, size))) {
    return items.map((line) =>
      isSameLine(line, productId, size)
        ? { ...line, quantity: line.quantity + quantity }
        : line,
    )
  }
  return [...items, { productId, size, quantity }]
}

export function removeFromCart(items, productId, size) {
  return items.filter((line) => !isSameLine(line, productId, size))
}

// Una quantità di 0 o meno equivale a togliere la riga
export function setQuantity(items, productId, size, quantity) {
  if (quantity <= 0) return removeFromCart(items, productId, size)
  return items.map((line) =>
    isSameLine(line, productId, size) ? { ...line, quantity } : line,
  )
}

// Numero totale di pezzi (quello mostrato accanto all'icona del carrello)
export function countItems(items) {
  return items.reduce((total, line) => total + line.quantity, 0)
}

// Pezzi di un prodotto già nel carrello, in tutte le taglie (lo stock è unico per prodotto)
export function quantityOfProduct(items, productId) {
  return items
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0)
}

// Prezzi in centesimi (interi) per sommare senza errori di arrotondamento: "79.90" -> 7990
export function priceToCents(price) {
  return Math.round(Number(price) * 100)
}

// Unisce le righe del carrello (id, taglia, quantità) ai dati aggiornati dei prodotti.
// Per ogni riga calcola anche "max" (i pezzi che possono stare in quella riga, dato che lo stock
// è unico per prodotto) e "problem": null se tutto va bene, altrimenti
// 'unavailable' (prodotto sparito), 'size' (taglia non più valida) o 'stock' (pezzi insufficienti)
export function buildCartLines(items, products) {
  const productsById = new Map(products.map((product) => [product.id, product]))
  return items.map((line) => {
    const product = productsById.get(line.productId) ?? null
    if (!product) {
      return { ...line, product: null, max: 0, problem: 'unavailable' }
    }
    const inOtherLines = quantityOfProduct(items, line.productId) - line.quantity
    const max = Math.max(0, product.stock - inOtherLines)
    let problem = null
    if (!product.available_sizes.includes(line.size)) {
      problem = 'size'
    } else if (line.quantity > max) {
      problem = 'stock'
    }
    return { ...line, product, max, problem }
  })
}

// Totale in centesimi delle righe con un prodotto valido
export function cartTotalCents(lines) {
  return lines.reduce(
    (total, line) =>
      line.product ? total + priceToCents(line.product.price) * line.quantity : total,
    0,
  )
}

// Il codice sconto applicato si salva a parte, come semplice testo. Sconto e totale NON si salvano:
// si richiedono al backend, che verifica le regole (attivo, utilizzi, importo minimo)
export const DISCOUNT_KEY = 'cart_discount'

export function loadDiscountCode(storage = getStorage()) {
  if (!storage) return ''
  try {
    const saved = storage.getItem(DISCOUNT_KEY)
    return typeof saved === 'string' ? saved.trim().slice(0, 50) : ''
  } catch {
    return ''
  }
}

export function saveDiscountCode(code, storage = getStorage()) {
  try {
    if (code) {
      storage?.setItem(DISCOUNT_KEY, code)
    } else {
      storage?.removeItem(DISCOUNT_KEY)
    }
  } catch {
    // Spazio esaurito o storage bloccato: il codice resta comunque in memoria
  }
}

// Porta un valore qualsiasi (anche vuoto o decimale) a un intero tra 1 e max
export function clampQuantity(quantity, max) {
  const whole = Math.floor(Number(quantity))
  const safe = Number.isFinite(whole) && whole >= 1 ? whole : 1
  return Math.min(safe, max)
}
