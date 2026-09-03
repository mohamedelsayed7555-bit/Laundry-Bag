import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, AppColors } from '../theme'

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved)
      }
    })
  }, [])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem(STORAGE_KEY, m)
  }

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark'
  const themeColors = isDark ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ colors: themeColors as AppColors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
