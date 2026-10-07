import { useEffect, useState } from 'react'
import {
  addToCart,
  CART_KEY,
  countItems,
  DISCOUNT_KEY,
  loadCart,
  loadDiscountCode,
  removeFromCart,
  saveCart,
  saveDiscountCode,
  setQuantity,
} from './cart'
import { CartContext } from './cart-context'

function CartProvider({ children }) {
  // Il carrello parte da quello salvato nel browser (la funzione viene eseguita una sola volta)
  const [items, setItems] = useState(loadCart)
  // Codice sconto applicato ('' = nessuno). Si salva solo il testo: lo sconto lo calcola il backend
  const [discountCode, setDiscountCode] = useState(loadDiscountCode)

  // A ogni modifica carrello e codice vengono salvati nel localStorage
  useEffect(() => {
    saveCart(items)
  }, [items])
  useEffect(() => {
    saveDiscountCode(discountCode)
  }, [discountCode])

  // Se il carrello cambia in un'altra scheda del browser, lo rileggiamo: senza, questa scheda
  // lo sovrascriverebbe con dati vecchi alla modifica successiva
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === CART_KEY || event.key === DISCOUNT_KEY || event.key === null) {
        setItems(loadCart())
        setDiscountCode(loadDiscountCode())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = {
    items,
    count: countItems(items),
    addItem: (productId, size, quantity = 1) =>
      setItems((current) => addToCart(current, productId, size, quantity)),
    updateQuantity: (productId, size, quantity) =>
      setItems((current) => setQuantity(current, productId, size, quantity)),
    removeItem: (productId, size) =>
      setItems((current) => removeFromCart(current, productId, size)),
    discountCode,
    applyDiscountCode: (code) => setDiscountCode(code),
    removeDiscountCode: () => setDiscountCode(''),
    // Dopo un ordine si svuota tutto, anche il codice: non resta applicato al carrello successivo
    clearCart: () => {
      setItems([])
      setDiscountCode('')
    },
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export default CartProvider
