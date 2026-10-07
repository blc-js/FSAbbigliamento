import { createContext, useContext } from 'react'

export const CartContext = createContext(null)

// Hook per leggere il carrello da qualsiasi componente: const { items, count, addItem } = useCart()
export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) {
    throw new Error('useCart va usato dentro CartProvider')
  }
  return cart
}
