// Shown in place of a screen that only means something with an account (orders, chats,
// profile). App Review requires the services and prices to be open without one
// (guideline 5.1.1(v)), so a visitor reaches these tabs too and needs a way in.
import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogIn } from 'lucide-react-native'
import { useLanguage } from '../contexts/LanguageContext'
import { useBrand, F } from './brand'
import { PrimaryButton } from './auth/ui'

export function GuestGate({ title, message, icon }: { title: string; message: string; icon?: ReactNode }) {
  const b = useBrand()
  const { t } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.root, { backgroundColor: b.page, paddingTop: insets.top + 14 }]}>
      <Text style={[s.pageTitle, { color: b.ink }]}>{title}</Text>
      <View style={s.body}>
        <View style={[s.iconTile, { backgroundColor: b.tint }]}>
          {icon ?? <LogIn size={30} color={b.tintText} />}
        </View>
        <Text style={[s.title, { color: b.ink }]}>{t('guestTitle')}</Text>
        <Text style={[s.message, { color: b.muted }]}>{message}</Text>
        <PrimaryButton title={t('guestSignIn')} onPress={() => router.push('/(auth)/welcome')} style={s.btn} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  pageTitle: { fontSize: 24, fontFamily: F.display },
  // Lifted a little above centre so the floating tab bar doesn't crowd the button.
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  iconTile: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 19, fontFamily: F.display, textAlign: 'center' },
  message: { fontSize: 13.5, lineHeight: 21, fontFamily: F.regular, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  btn: { marginTop: 22, alignSelf: 'stretch' },
})
