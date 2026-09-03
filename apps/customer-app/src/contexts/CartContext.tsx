import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CART_KEY = 'cleano_cart'

export type CartItem = {
  name: string
  service_type: string
  quantity: number
  price: number
}

type CartContextType = {
  cart: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (index: number) => void
  updateQuantity: (index: number, quantity: number) => void
  clearCart: () => void
  totalPrice: number
  totalItems: number
  lastAddedIndex: number | null
  clearLastAdded: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then(raw => {
      if (raw) {
        try { setCart(JSON.parse(raw)) } catch {}
      }
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(CART_KEY, JSON.stringify(cart))
    }
  }, [cart, loaded])

  const addItem = useCallback((item: CartItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.name === item.name && c.service_type === item.service_type)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + item.quantity }
        setLastAddedIndex(idx)
        return updated
      }
      setLastAddedIndex(prev.length)
      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity < 1) return
    setCart(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], quantity }
      return updated
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    AsyncStorage.removeItem(CART_KEY)
  }, [])

  const clearLastAdded = useCallback(() => setLastAddedIndex(null), [])

  const totalPrice = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart])
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQuantity, clearCart, totalPrice, totalItems, lastAddedIndex, clearLastAdded }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
