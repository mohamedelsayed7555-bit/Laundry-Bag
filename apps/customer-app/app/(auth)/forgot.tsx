import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Animated as RNAnimated, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LockKeyhole, MessageCircle, Phone, UserCheck, LogIn, ShieldAlert, ChevronLeft, ChevronRight, KeyRound, Mail } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { F, useAuthTheme, RoundButton, BackArrow, SecondaryButton, Halftone, tapHaptic, ErrorLine } from '../../src/components/auth/ui'

const SUPPORT_PHONE = '01002438847'
const SUPPORT_WHATSAPP_INTL = '201002438847'

type Hours = { enabled: boolean; open?: string; close?: string; is_open: boolean }

// "08:00" -> "8:00 ص" / "8:00 AM"
function formatHour(hhmm: string, en: boolean) {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? (en ? 'AM' : 'ص') : (en ? 'PM' : 'م')}`
}

export default function ForgotScreen() {
  const th = useAuthTheme()
  const { t, locale, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const [hours, setHours] = useState<Hours | null>(null)
  const [mailState, setMailState] = useState<{ busy: boolean; note: string | null; ok: boolean }>({ busy: false, note: null, ok: false })
  const pulse = useRef(new RNAnimated.Value(0)).current
  const pulse2 = useRef(new RNAnimated.Value(0)).current
  const en = locale === 'en'

  useEffect(() => {
    // Working hours set in the dashboard. If this fails we just fall back to the fixed text.
    supabase.rpc('support_hours').then(({ data }) => {
      if (data && typeof data === 'object') setHours(data as Hours)
    }, () => {})
  }, [])

  useEffect(() => {
    const a = RNAnimated.loop(RNAnimated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true }))
    const b = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.delay(850),
      RNAnimated.timing(pulse2, { toValue: 1, duration: 2600, useNativeDriver: true }),
      RNAnimated.timing(pulse2, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]))
    a.start(); b.start()
    return () => { a.stop(); b.stop() }
  }, [])

  // The one path that involves nobody here: the link goes to the customer's own inbox.
  async function requestEmailLink() {
    tapHaptic()
    setMailState({ busy: true, note: null, ok: false })
    const { data, error } = await supabase.functions.invoke('request-password-reset', {
      body: { phone },
    })
    const res = (data ?? {}) as { sent?: boolean; masked?: string; retry?: boolean }
    if (error) {
      setMailState({ busy: false, note: t('authNetworkError'), ok: false })
      return
    }
    if (res.sent) {
      setMailState({ busy: false, note: t('authEmailLinkSent', { masked: res.masked ?? '' }), ok: true })
      return
    }
    setMailState({ busy: false, note: res.retry ? t('authEmailLinkBusy') : t('authEmailLinkNone'), ok: false })
  }

  function openWhatsapp() {
    tapHaptic()
    const text = `${t('authWhatsappMsg')} ${phone}`.trim()
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_INTL}?text=${encodeURIComponent(text)}`).catch(() => {})
  }

  function call() {
    tapHaptic()
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})
  }

  const callSub = !hours
    ? t('authCallSub')
    : hours.enabled && hours.open && hours.close
      ? t('authHoursRange', { open: formatHour(hours.open, en), close: formatHour(hours.close, en) })
      : t('authHoursAllDay')

  const Chevron = isRTL ? ChevronLeft : ChevronRight
  const ringStyle = (v: RNAnimated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
  })
  const steps = [
    { Icon: MessageCircle, label: t('authHow1') },
    { Icon: UserCheck, label: t('authHow2') },
    { Icon: LogIn, label: t('authHow3') },
  ]
  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  return (
    <View style={[s.root, { backgroundColor: th.bg }]}>
      <StatusBar style={th.isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={th.isDark ? ['#112445', '#0F1A31', '#0A1222'] : ['#E3F0FD', '#F3F8FF', '#FFFFFF']}
        locations={[0, 0.3, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <View style={s.nav}>
          <RoundButton onPress={() => router.back()} label="Back">
            <BackArrow color={th.ink} />
          </RoundButton>
        </View>

        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center' }}>
          {/* Dots spread out from the lock; the box is centred on it and wider than the screen. */}
          <View pointerEvents="none" style={[s.dots, { width, marginLeft: -width / 2 }]}>
            <Halftone width={width} height={320} cx={width / 2} cy={150} color={th.dot} />
          </View>
          <View style={s.lockWrap}>
            <RNAnimated.View style={[s.lockPulse, { borderColor: th.primary }, ringStyle(pulse)]} />
            <RNAnimated.View style={[s.lockPulse, { borderColor: th.primary }, ringStyle(pulse2)]} />
            <View style={[s.lockCore, { backgroundColor: th.primary, shadowColor: th.primary }]}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.lockFill} />
              <LockKeyhole size={26} color="#fff" />
            </View>
          </View>
          <Text style={[s.h, { color: th.ink }]}>{t('authForgotTitle')}</Text>
          <Text style={[s.p, { color: th.muted }]}>{t('authForgotSub')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(150)}>
          <TouchableOpacity
            onPress={openWhatsapp}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[
              s.opt,
              { backgroundColor: th.field, borderColor: th.isDark ? 'rgba(74,222,128,0.35)' : '#BBF0CF', shadowColor: '#16A34A' },
              s.optRaised,
            ]}
          >
            <View style={[s.optIcon, { backgroundColor: th.isDark ? 'rgba(22,163,74,0.15)' : '#E8F8EE' }]}>
              <MessageCircle size={20} color={th.ok} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optTitle, { color: th.ink }, align]}>{t('authWhatsapp')}</Text>
              <Text style={[s.optSub, { color: th.muted }, align]}>{t('authWhatsappSub')}</Text>
              {hours ? (
                <View style={[s.live, { backgroundColor: hours.is_open ? th.okBg : th.soft }]}>
                  <View style={[s.liveDot, { backgroundColor: hours.is_open ? '#22C55E' : th.faint }]} />
                  <Text style={[s.liveText, { color: hours.is_open ? th.ok : th.muted }]}>
                    {hours.is_open ? t('authAvailableNow') : t('authReplyWhenOpen')}
                  </Text>
                </View>
              ) : null}
            </View>
            <Chevron size={18} color={th.faint} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(250)}>
          <TouchableOpacity
            onPress={call}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.opt, { backgroundColor: th.field, borderColor: th.fieldBorder, marginTop: 10 }]}
          >
            <View style={[s.optIcon, { backgroundColor: th.iconBg }]}>
              <Phone size={20} color={th.iconFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optTitle, { color: th.ink }, align]}>{t('authCall')}</Text>
              <Text style={[s.optSub, { color: th.muted }, align]}>{callSub}</Text>
            </View>
            <Chevron size={18} color={th.faint} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(300)}>
          <TouchableOpacity
            onPress={requestEmailLink}
            disabled={mailState.busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.opt, { backgroundColor: th.field, borderColor: th.fieldBorder, marginTop: 10, opacity: mailState.busy ? 0.6 : 1 }]}
          >
            <View style={[s.optIcon, { backgroundColor: th.iconBg }]}>
              <Mail size={20} color={th.iconFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optTitle, { color: th.ink }, align]}>{t('authEmailLink')}</Text>
              <Text style={[s.optSub, { color: th.muted }, align]}>{t('authEmailLinkSub')}</Text>
            </View>
            <Chevron size={18} color={th.faint} />
          </TouchableOpacity>
          {mailState.note ? (
            mailState.ok
              ? <Text style={[s.optSub, { color: th.ok, marginTop: 7, paddingHorizontal: 4 }, align]}>{mailState.note}</Text>
              : <ErrorLine message={mailState.note} />
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(320)}>
          <TouchableOpacity
            onPress={() => { tapHaptic(); router.push({ pathname: '/(auth)/reset-code', params: { phone } }) }}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[s.opt, { backgroundColor: th.field, borderColor: th.fieldBorder, marginTop: 10 }]}
          >
            <View style={[s.optIcon, { backgroundColor: th.iconBg }]}>
              <KeyRound size={20} color={th.iconFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optTitle, { color: th.ink }, align]}>{t('authHaveCode')}</Text>
              <Text style={[s.optSub, { color: th.muted }, align]}>{t('authHaveCodeSub')}</Text>
            </View>
            <Chevron size={18} color={th.faint} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(350)}>
          <Text style={[s.howTitle, { color: th.ink2 }, align]}>{t('authHowTitle')}</Text>
          <View style={s.how}>
            <View style={[s.howLine, { borderColor: th.isDark ? '#2C3D5C' : '#C9D7EA' }]} />
            {steps.map(({ Icon, label }) => (
              <View key={label} style={s.howStep}>
                <View style={[s.howIcon, { backgroundColor: th.isDark ? th.sheet : '#fff', borderColor: th.isDark ? '#2A3B5A' : '#D5E3F8' }]}>
                  <Icon size={16} color={th.isDark ? th.sky : th.primary} />
                </View>
                <Text style={[s.howLabel, { color: th.ink2 }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.warn, { backgroundColor: th.isDark ? 'rgba(245,158,11,0.08)' : '#FFF8E8', borderColor: th.isDark ? 'rgba(245,158,11,0.25)' : '#F7E2B0' }]}>
            <ShieldAlert size={17} color={th.isDark ? '#FBBF24' : '#D97706'} />
            <Text style={[s.warnText, { color: th.isDark ? '#E7D3A8' : '#7A5410' }, align]}>{t('authScamWarn')}</Text>
          </View>

          <SecondaryButton
            title={t('authBackToSignIn')}
            icon={<BackArrow color={th.ink2} size={16} />}
            onPress={() => router.back()}
            style={{ marginTop: 14 }}
          />
        </Animated.View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', marginBottom: 4 },
  dots: { position: 'absolute', top: -150 + 48, left: '50%', height: 320 },
  lockWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  lockPulse: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5 },
  lockCore: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  lockFill: { ...StyleSheet.absoluteFillObject, borderRadius: 29 },
  h: { fontSize: 22, lineHeight: 32, fontFamily: F.display, marginTop: 8, textAlign: 'center' },
  p: { fontSize: 13, lineHeight: 21, fontFamily: F.regular, marginTop: 4, marginBottom: 6, textAlign: 'center', paddingHorizontal: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, borderWidth: 1, minHeight: 64, marginTop: 12 },
  optRaised: { elevation: 3, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  optIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontFamily: F.semibold },
  optSub: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  live: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10.5, fontFamily: F.semibold },
  howTitle: { fontSize: 12.5, fontFamily: F.bold, marginTop: 20, marginBottom: 10, marginHorizontal: 2 },
  how: { flexDirection: 'row' },
  howLine: { position: 'absolute', top: 18, left: '17%', right: '17%', borderTopWidth: 1.5, borderStyle: 'dashed' },
  howStep: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  howIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  howLabel: { fontSize: 11, lineHeight: 16, fontFamily: F.semibold, textAlign: 'center' },
  warn: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: 12, borderRadius: 14, borderWidth: 1 },
  warnText: { flex: 1, fontSize: 11.5, lineHeight: 19, fontFamily: F.regular },
})
