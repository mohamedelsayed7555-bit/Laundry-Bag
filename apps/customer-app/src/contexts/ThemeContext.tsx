import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, AppColors } from '../theme'
import { supabase } from '../lib/supabase'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  colors: AppColors
  isDark: boolean
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  colors: darkColors,
  isDark: true,
  mode: 'system',
  setMode: () => {},
})

const STORAGE_KEY = '@theme_mode'
const BRAND_COLOR_KEY = '@brand_color'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function applyBrandColor(base: typeof darkColors, brandColor: string): AppColors {
  return {
    ...base,
    primary: brandColor,
    primaryLight: lightenHex(brandColor, 40),
    primaryDark: darkenHex(brandColor, 30),
    primaryGlow: hexToRgba(brandColor, 0.15),
    gradientAccent: [brandColor, darkenHex(brandColor, 40)] as [string, string],
  } as AppColors
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [brandColor, setBrandColor] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved)
      }
    })

    AsyncStorage.getItem(BRAND_COLOR_KEY).then(cached => {
      if (cached && cached.startsWith('#')) setBrandColor(cached)
    })

    supabase.from('settings').select('value').eq('key', 'brand_color').single()
      .then(({ data }) => {
        if (!data?.value) return
        let val = data.value
        if (typeof val === 'string') try { val = JSON.parse(val) } catch { return }
        if (val?.selected && typeof val.selected === 'string' && val.selected.startsWith('#')) {
          setBrandColor(val.selected)
          AsyncStorage.setItem(BRAND_COLOR_KEY, val.selected)
        }
      })
  }, [])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem(STORAGE_KEY, m)
  }

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark'
  const baseColors = isDark ? darkColors : lightColors

  const themeColors = useMemo(() => {
    if (!brandColor || brandColor === '#00c966') return baseColors
    return applyBrandColor(baseColors, brandColor)
  }, [baseColors, brandColor])

  return (
    <ThemeContext.Provider value={{ colors: themeColors as AppColors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
