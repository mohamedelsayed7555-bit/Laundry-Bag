import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LockKeyhole, MessageCircle, Phone } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { F, useAuthTheme, RoundButton, BackArrow, TintBackground, tapHaptic } from '../../src/components/auth/ui'

const SUPPORT_PHONE = '01002438847'
const SUPPORT_WHATSAPP_INTL = '201002438847'

export default function ForgotScreen() {
  const th = useAuthTheme()
  const { t } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()

  function openWhatsapp() {
    tapHaptic()
    const text = `${t('authWhatsappMsg')} ${phone}`.trim()
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_INTL}?text=${encodeURIComponent(text)}`).catch(() => {})
  }

  function call() {
    tapHaptic()
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})
  }

  const options = [
    { key: 'wa', Icon: MessageCircle, title: t('authWhatsapp'), sub: t('authWhatsappSub'), onPress: openWhatsapp, bg: th.isDark ? 'rgba(22,163,74,0.15)' : '#E8F8EE', fg: th.ok },
    { key: 'call', Icon: Phone, title: t('authCall'), sub: t('authCallSub'), onPress: call, bg: th.iconBg, fg: th.iconFg },
  ]

  return (
    <View style={[s.root, { backgroundColor: th.bg }]}>
      <StatusBar style={th.isDark ? 'light' : 'dark'} />
      <TintBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <View style={s.nav}>
          <RoundButton onPress={() => router.back()} label="Back">
            <BackArrow color={th.ink} />
          </RoundButton>
        </View>

        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center' }}>
          <View style={[s.illus1, { backgroundColor: th.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)' }]}>
            <View style={[s.illus2, { backgroundColor: th.isDark ? 'rgba(59,130,246,0.18)' : '#DCE9FF' }]}>
              <View style={[s.illus3, { backgroundColor: th.primary, shadowColor: th.primary }]}>
                <LockKeyhole size={22} color="#fff" />
              </View>
            </View>
          </View>
          <Text style={[s.h, { color: th.ink }]}>{t('authForgotTitle')}</Text>
          <Text style={[s.p, { color: th.muted }]}>{t('authForgotSub')}</Text>
        </Animated.View>

        <View style={{ gap: 10, marginTop: 20 }}>
          {options.map(({ key, Icon, title, sub, onPress, bg, fg }, i) => (
            <Animated.View key={key} entering={FadeInDown.duration(450).delay(150 + i * 100)}>
              <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={[s.opt, { backgroundColor: th.field, borderColor: th.fieldBorder }]}
              >
                <View style={[s.optIcon, { backgroundColor: bg }]}>
                  <Icon size={20} color={fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optTitle, { color: th.ink }]}>{title}</Text>
                  <Text style={[s.optSub, { color: th.muted }]}>{sub}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityRole="button">
          <Text style={[s.backText, { color: th.ink2 }]}>{t('authBackToSignIn')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', marginBottom: 12 },
  illus1: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  illus2: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  illus3: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  h: { fontSize: 22, lineHeight: 32, fontFamily: F.display, marginTop: 16, textAlign: 'center' },
  p: { fontSize: 13, lineHeight: 21, fontFamily: F.regular, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, borderWidth: 1, minHeight: 64 },
  optIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontFamily: F.semibold },
  optSub: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  back: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 10 },
  backText: { fontSize: 13.5, fontFamily: F.semibold },
})
