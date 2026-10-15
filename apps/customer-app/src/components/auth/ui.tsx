import { useState, forwardRef, type ReactNode } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet,
  type TextInputProps, type StyleProp, type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Eye, EyeOff, CircleAlert, CircleCheck, ArrowLeft, ArrowRight, Globe } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const F = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  display: 'Alexandria_700Bold',
  displaySemi: 'Alexandria_600SemiBold',
}

export const PHONE_RE = /^01[0-9]{9}$/

export const HERO = require('../../../assets/auth/hero.webp')
export const LOGO = require('../../../assets/logo.jpg')

function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function useAuthTheme() {
  const { colors, isDark } = useTheme()
  const primary = colors.primary
  return isDark
    ? {
        isDark, primary, ring: withAlpha(primary, 0.28), sky: '#8EC1FF',
        bg: '#0A1222', sheet: '#0E172A', tint: ['#0F1D3A', '#0C162C', '#0A1222'] as const,
        ink: '#E8EEF7', ink2: '#B9C5D8', muted: '#8A9BB4', faint: '#7D8FAC',
        field: '#121C31', fieldBorder: '#22304A', iconBg: 'rgba(59,130,246,0.15)', iconFg: '#8EC1FF',
        line: '#22304A', danger: '#F87171', dangerBg: 'rgba(248,113,113,0.12)', ok: '#4ADE80', okBg: 'rgba(34,197,94,0.12)',
        disabled: '#22304A', soft: '#18233A',
      }
    : {
        isDark, primary, ring: withAlpha(primary, 0.16), sky: '#8EC1FF',
        bg: '#FFFFFF', sheet: '#FFFFFF', tint: ['#E7F0FF', '#F2F7FF', '#FFFFFF'] as const,
        ink: '#0A1628', ink2: '#334256', muted: '#6B7A90', faint: '#9AA7B8',
        field: '#FFFFFF', fieldBorder: '#DFE6F0', iconBg: '#EEF4FF', iconFg: primary,
        line: '#E2E8F1', danger: '#DC2626', dangerBg: '#FEE2E2', ok: '#16A34A', okBg: '#ECFDF3',
        disabled: '#C7D3E6', soft: '#F3F6FA',
      }
}

export type AuthTheme = ReturnType<typeof useAuthTheme>

export function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export function ErrorLine({ message }: { message?: string | null }) {
  const th = useAuthTheme()
  if (!message) return null
  return (
    <View style={s.errRow} accessibilityLiveRegion="polite">
      <CircleAlert size={15} color={th.danger} />
      <Text style={[s.errText, { color: th.danger }]}>{message}</Text>
    </View>
  )
}

type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string
  icon: typeof CircleCheck
  error?: string | null
  valid?: boolean
  secure?: boolean
  ltr?: boolean
  style?: StyleProp<ViewStyle>
}

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { label, icon: Icon, error, valid, secure, ltr, style, onFocus, onBlur, ...input },
  ref,
) {
  const th = useAuthTheme()
  const { isRTL } = useLanguage()
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(true)
  const borderColor = error ? th.danger : focused ? th.primary : th.fieldBorder
  const ring = error ? th.dangerBg : focused ? th.ring : 'transparent'

  return (
    <View style={style}>
      <View style={[s.fieldRing, { backgroundColor: ring }]}>
        <View style={[s.field, { backgroundColor: th.field, borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
          <View style={[s.fieldIcon, { backgroundColor: error ? th.dangerBg : focused ? th.primary : th.iconBg }]}>
            <Icon size={16} color={error ? th.danger : focused ? '#fff' : th.iconFg} />
          </View>
          <View style={s.fieldBody}>
            <Text style={[s.fieldLabel, { color: error ? th.danger : focused ? th.primary : th.muted, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
            <TextInput
              ref={ref}
              {...input}
              secureTextEntry={secure ? hidden : false}
              placeholderTextColor={th.faint}
              selectionColor={th.primary}
              onFocus={e => { setFocused(true); onFocus?.(e) }}
              onBlur={e => { setFocused(false); onBlur?.(e) }}
              style={[s.fieldInput, { color: th.ink, textAlign: isRTL ? 'right' : 'left', writingDirection: ltr ? 'ltr' : undefined }]}
            />
          </View>
          {secure ? (
            <TouchableOpacity
              onPress={() => setHidden(h => !h)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            >
              {hidden ? <Eye size={19} color={th.faint} /> : <EyeOff size={19} color={th.faint} />}
            </TouchableOpacity>
          ) : error ? (
            <CircleAlert size={18} color={th.danger} />
          ) : valid ? (
            <CircleCheck size={18} color={th.ok} />
          ) : null}
        </View>
      </View>
      <ErrorLine message={error} />
    </View>
  )
})

export function PhoneField({ value, onChangeText, error, autoFocus, onSubmitEditing }: {
  value: string
  onChangeText: (v: string) => void
  error?: string | null
  autoFocus?: boolean
  onSubmitEditing?: () => void
}) {
  const th = useAuthTheme()
  const [focused, setFocused] = useState(false)
  const borderColor = error ? th.danger : focused ? th.primary : th.fieldBorder
  return (
    <View>
      <View style={[s.fieldRing, { backgroundColor: error ? th.dangerBg : focused ? th.ring : 'transparent' }]}>
        <View style={[s.phone, { backgroundColor: th.field, borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
          <View style={[s.cc, { backgroundColor: th.soft, borderColor: th.line }]}>
            <View style={s.flag}>
              <View style={{ flex: 1, backgroundColor: '#CE1126' }} />
              <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
              <View style={{ flex: 1, backgroundColor: '#000000' }} />
            </View>
            <Text style={[s.ccText, { color: th.ink }]}>+20</Text>
          </View>
          <TextInput
            value={value}
            onChangeText={t => onChangeText(t.replace(/[^0-9]/g, '').slice(0, 11))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus={autoFocus}
            placeholder="01X XXXX XXXX"
            placeholderTextColor={th.faint}
            selectionColor={th.primary}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={onSubmitEditing}
            returnKeyType="done"
            style={[s.phoneInput, { color: th.ink }]}
            accessibilityLabel="Mobile number"
          />
        </View>
      </View>
      <ErrorLine message={error} />
    </View>
  )
}

export function PrimaryButton({ title, onPress, loading, disabled, leading, trailing, style, loadingTitle }: {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
  loadingTitle?: string
}) {
  const th = useAuthTheme()
  const inactive = disabled || loading
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={inactive}
      onPress={() => { tapHaptic(); onPress() }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        s.btn,
        { backgroundColor: disabled && !loading ? th.disabled : th.primary },
        !disabled && !loading && { shadowColor: th.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" size="small" /> : leading}
      <Text style={s.btnText}>{loading && loadingTitle ? loadingTitle : title}</Text>
      {!loading && trailing}
    </TouchableOpacity>
  )
}

export function ForwardArrow({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  const { isRTL } = useLanguage()
  return isRTL ? <ArrowLeft size={size} color={color} /> : <ArrowRight size={size} color={color} />
}

export function BackArrow({ color, size = 20 }: { color: string; size?: number }) {
  const { isRTL } = useLanguage()
  return isRTL ? <ArrowRight size={size} color={color} /> : <ArrowLeft size={size} color={color} />
}

export function RoundButton({ onPress, children, glass, label }: { onPress: () => void; children: ReactNode; glass?: boolean; label: string }) {
  const th = useAuthTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        s.round,
        glass
          ? { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 }
          : { backgroundColor: th.isDark ? '#141F35' : '#FFFFFF', borderColor: th.line, borderWidth: th.isDark ? 1 : 0, elevation: th.isDark ? 0 : 2, shadowColor: '#10284F', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      ]}
    >
      {children}
    </TouchableOpacity>
  )
}

export function LangButton({ glass }: { glass?: boolean }) {
  const th = useAuthTheme()
  const { locale, setLanguage } = useLanguage()
  const color = glass ? '#fff' : th.ink2
  return (
    <TouchableOpacity
      onPress={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
      accessibilityRole="button"
      accessibilityLabel={locale === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      style={[
        s.lang,
        glass
          ? { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 }
          : { backgroundColor: th.isDark ? '#141F35' : '#FFFFFF', borderColor: th.line, borderWidth: 1 },
      ]}
    >
      <Globe size={15} color={glass ? '#fff' : th.primary} />
      <Text style={[s.langText, { color }]}>{locale === 'ar' ? 'EN' : 'ع'}</Text>
    </TouchableOpacity>
  )
}

export function TintBackground() {
  const th = useAuthTheme()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={th.tint} style={StyleSheet.absoluteFill} />
      <Image source={HERO} blurRadius={30} resizeMode="cover" style={[s.ambient, { opacity: th.isDark ? 0.22 : 0.4 }]} />
      <LinearGradient
        colors={th.isDark ? ['rgba(10,18,34,0)', '#0A1222'] : ['rgba(255,255,255,0)', '#FFFFFF']}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 0, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

const s = StyleSheet.create({
  errRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7, paddingHorizontal: 2 },
  errText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: F.medium },
  fieldRing: { borderRadius: 16, padding: 3, margin: -3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 6 },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, fontFamily: F.medium },
  fieldInput: { fontSize: 15, fontFamily: F.medium, paddingVertical: 2, paddingHorizontal: 0, margin: 0 },
  phone: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', height: 52, borderRadius: 13, overflow: 'hidden' },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7, height: '100%', paddingHorizontal: 12, borderRightWidth: 1 },
  flag: { width: 21, height: 14, borderRadius: 3, overflow: 'hidden' },
  ccText: { fontSize: 14, fontFamily: F.semibold },
  phoneInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, fontFamily: F.medium, letterSpacing: 0.8, textAlign: 'left' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 14, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontSize: 15.5, fontFamily: F.semibold },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22 },
  langText: { fontSize: 13, fontFamily: F.semibold },
  ambient: { position: 'absolute', top: -40, left: -40, right: -40, height: 420 },
})
