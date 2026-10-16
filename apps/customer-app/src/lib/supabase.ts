import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Public project URL and anon key. The anon key is designed to ship inside the client,
// so these are safe to embed. They are kept as a fallback so that a build whose
// EXPO_PUBLIC_* env vars weren't injected can never crash the app on launch
// (createClient throws "supabaseUrl is required." on an empty URL).
const FALLBACK_SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcXRybWVka3ZxZm9md3ltb25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjQ5NjIsImV4cCI6MjA5NjMwMDk2Mn0.P9VHNeyCXZhVA1f8P_G1SW_mj3C1iiOYIva0pUFnH6s'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS !== 'web' ? ExpoSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
