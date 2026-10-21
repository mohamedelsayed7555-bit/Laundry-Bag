import { useState, useEffect, useRef, useMemo, memo, forwardRef, type ReactNode } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet, useWindowDimensions,
  Animated, Easing, AccessibilityInfo, I18nManager,
  type TextInputProps, type StyleProp, type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Path } from 'react-native-svg'
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

function mix(hex: string, target: string, amount: number) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  const out = [1, 3, 5].map(i => Math.round(ch(hex, i) + (ch(target, i) - ch(hex, i)) * amount))
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('')
}

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
        cardTint: ['#112445', '#0F1A31', '#0E172A'] as const, cardTintAt: [0, 0.26, 0.5] as const,
        cardEdge: 'rgba(56,189,248,0.35)', dot: '#38BDF8',
      }
    : {
        isDark, primary, ring: withAlpha(primary, 0.16), sky: '#8EC1FF',
        bg: '#FFFFFF', sheet: '#FFFFFF', tint: ['#E7F0FF', '#F2F7FF', '#FFFFFF'] as const,
        ink: '#0A1628', ink2: '#334256', muted: '#6B7A90', faint: '#9AA7B8',
        field: '#FFFFFF', fieldBorder: '#DFE6F0', iconBg: '#EEF4FF', iconFg: primary,
        line: '#E2E8F1', danger: '#DC2626', dangerBg: '#FEE2E2', ok: '#16A34A', okBg: '#ECFDF3',
        disabled: '#C7D3E6', soft: '#F3F6FA',
        cardTint: ['#EAF4FD', '#F6FAFF', '#FFFFFF'] as const, cardTintAt: [0, 0.22, 0.45] as const,
        cardEdge: 'rgba(14,165,233,0.28)', dot: '#0EA5E9',
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
  /** Shown under the field while there is no error — e.g. why we ask for this. */
  hint?: string
  valid?: boolean
  secure?: boolean
  ltr?: boolean
  style?: StyleProp<ViewStyle>
}

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { label, icon: Icon, error, hint, valid, secure, ltr, style, onFocus, onBlur, ...input },
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
            <Text style={[s.fieldLabel, { color: error ? th.danger : focused ? th.primary : th.ink2, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
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
      {!error && hint ? (
        <Text style={[s.hint, { color: th.muted, textAlign: isRTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.3}>{hint}</Text>
      ) : null}
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
  // A gentle looping glow around the field, to catch the eye on first open. It is only
  // rendered while idle; focusing (or an error) shows the normal ring instead.
  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse])
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.3] })
  return (
    <View>
      <View style={s.phoneWrap}>
        {!focused && !error ? (
          <Animated.View pointerEvents="none" style={[s.phoneGlow, { backgroundColor: th.primary, opacity: glowOpacity }]} />
        ) : null}
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
  const off = disabled && !loading
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={inactive}
      onPress={() => { tapHaptic(); onPress() }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        s.btn,
        { backgroundColor: off ? th.disabled : th.primary },
        !inactive && { shadowColor: th.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
        style,
      ]}
    >
      {!off ? (
        // The fill lives in its own clipped layer so the button's shadow isn't clipped (iOS).
        <View style={s.btnFill} pointerEvents="none">
          <LinearGradient
            colors={[mix(th.primary, '#ffffff', 0.15), th.primary, mix(th.primary, '#000000', 0.15)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {!loading ? <Shine /> : null}
        </View>
      ) : null}
      {loading ? <ActivityIndicator color="#fff" size="small" /> : leading}
      <Text style={s.btnText}>{loading && loadingTitle ? loadingTitle : title}</Text>
      {!loading && trailing}
    </TouchableOpacity>
  )
}

// A soft light sweep across the primary button every few seconds. Skipped when the OS asks for reduced motion.
function Shine() {
  const [w, setW] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!w) return
    let loop: Animated.CompositeAnimation | undefined
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce || cancelled) return
      loop = Animated.loop(Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1900),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]))
      loop.start()
    }).catch(() => {})
    return () => { cancelled = true; loop?.stop() }
  }, [w])
  // `start: 0` sits on the right in RTL, so the sweep runs the other way there.
  const dir = I18nManager.isRTL ? -1 : 1
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.5 * dir, w * 1.1 * dir] })
  return (
    <View style={StyleSheet.absoluteFill} onLayout={e => setW(e.nativeEvent.layout.width)} pointerEvents="none">
      {w ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: w * 0.38, transform: [{ translateX: tx }] }}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

export function SecondaryButton({ title, onPress, icon, style }: {
  title: string
  onPress: () => void
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const th = useAuthTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => { tapHaptic(); onPress() }}
      accessibilityRole="button"
      style={[s.btn2, { backgroundColor: th.field, borderColor: th.fieldBorder }, style]}
    >
      {icon}
      <Text style={[s.btn2Text, { color: th.ink2 }]}>{title}</Text>
    </TouchableOpacity>
  )
}

/** Google's four-colour "G", drawn so it stays crisp and needs no asset. */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <Path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8 41.3 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10l7.3-5.7z" />
      <Path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.7 4.5 14l7.3 5.7c1.7-5.2 6.5-8.9 12.2-8.9z" />
    </Svg>
  )
}

/**
 * The same button on sign-in and sign-up on purpose: Google decides whether this is
 * a new or a returning customer, so there is nothing for him to choose here.
 */
export function GoogleButton({ title, onPress, loading, disabled, compact, style }: {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  /** Icon only, sized to sit beside another provider instead of stacking. */
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const th = useAuthTheme()
  const off = loading || disabled
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { if (off) return; tapHaptic(); onPress() }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={title}
      style={[
        s.google,
        compact && s.googleCompact,
        { backgroundColor: th.isDark ? '#1B2740' : '#FFFFFF', borderColor: th.isDark ? '#30405E' : '#DADCE0', opacity: off ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={th.ink2} /> : <GoogleG size={compact ? 22 : 19} />}
      {compact ? null : (
        <Text style={[s.googleText, { color: th.isDark ? '#E8EDF6' : '#3C4043' }]} maxFontSizeMultiplier={1.3}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

/**
 * Sign in with Apple, in Apple's own black-on-white form. Apple's Human Interface
 * Guidelines require the mark and wording to be theirs, so this is deliberately not
 * styled like the rest of the buttons.
 */
export function AppleButton({ title, onPress, loading, disabled, compact, style }: {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const th = useAuthTheme()
  const off = loading || disabled
  const fg = th.isDark ? '#000' : '#fff'
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { if (off) return; tapHaptic(); onPress() }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={title}
      style={[s.google, compact && s.googleCompact, { backgroundColor: th.isDark ? '#fff' : '#000', borderColor: th.isDark ? '#fff' : '#000', opacity: off ? 0.6 : 1 }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : (
        <Svg width={compact ? 19 : 17} height={compact ? 23 : 20} viewBox="0 0 814 1000">
          <Path
            fill={fg}
            d="M788 340c-5 4-147 84-147 262 0 206 181 279 186 281-1 4-29 99-95 196-59 85-121 170-215 170s-118-55-227-55c-106 0-144 57-230 57S60 1000 0 849c0 0-73-176-73-347 0-275 179-421 355-421 93 0 171 61 230 61 56 0 143-65 249-65 40 0 183 4 277 123zM524 155c44-52 75-124 75-196 0-10-1-20-3-28-71 3-156 48-207 107-40 45-78 117-78 190 0 11 2 22 3 26 4 1 11 2 18 2 64 0 145-43 192-101z"
          />
        </Svg>
      )}
      {compact ? null : (
        <Text style={[s.googleText, { color: fg }]} maxFontSizeMultiplier={1.3}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

/**
 * Both providers on one row, as icons. Stacking two full-width buttons pushed the phone
 * field off the first screen; side by side they cost one row and read as a pair.
 */
export function SocialRow({ children }: { children: ReactNode }) {
  return <View style={s.socialRow}>{children}</View>
}

/** "──── or ────" between the Google button and the form. */
export function OrDivider({ label }: { label: string }) {
  const th = useAuthTheme()
  return (
    <View style={s.orRow}>
      <View style={[s.orLine, { backgroundColor: th.fieldBorder }]} />
      <Text style={[s.orText, { color: th.muted }]} maxFontSizeMultiplier={1.2}>{label}</Text>
      <View style={[s.orLine, { backgroundColor: th.fieldBorder }]} />
    </View>
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

// The hero photo sized explicitly (not resizeMode="cover") so the woman and the washer stay in
// frame on every screen shape, instead of the platform picking an arbitrary crop.
export function HeroImage({ height }: { height: number }) {
  const { width } = useWindowDimensions()
  const imgH = Math.max(width * 1.5, height)
  const imgW = imgH / 1.5
  const top = Math.min(0, Math.max(height - imgH, height * 0.5 - imgH * 0.42))
  return (
    <Image
      source={HERO}
      style={{ position: 'absolute', top, left: (width - imgW) / 2, width: imgW, height: imgH }}
      accessibilityIgnoresInvertColors
    />
  )
}

// Halftone dots on a grid that grow toward (cx, cy) and fade out with distance. Drawn once and memoised.
export const Halftone = memo(function Halftone({ width, height, cx, cy, color }: {
  width: number
  height: number
  cx: number
  cy: number
  color: string
}) {
  const dots = useMemo(() => {
    const step = 14
    const out: { x: number; y: number; r: number; o: number }[] = []
    const x0 = cx - Math.floor(cx / step) * step
    const y0 = cy + 6 - Math.floor((cy + 6) / step) * step
    for (let y = y0; y < height; y += step) {
      for (let x = x0; x < width; x += step) {
        const d = Math.hypot(x - cx, (y - cy) * 1.3)
        const dia = 3.6 - d / 55
        if (dia < 0.6) continue
        out.push({ x, y, r: dia / 2, o: Math.min(0.55, 0.15 + dia / 8) })
      }
    }
    return out
  }, [width, height, cx, cy])
  return (
    <Svg width={width} height={height} pointerEvents="none">
      {dots.map(d => <Circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={d.o} />)}
    </Svg>
  )
})

// The card surface used by the auth sheets: a soft brand tint at the top, a lit top edge, and the
// halftone dots spreading out from the logo/avatar at the top centre.
export function SheetBackdrop() {
  const th = useAuthTheme()
  const { width } = useWindowDimensions()
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.backdrop, { borderTopColor: th.cardEdge }]}>
      <LinearGradient colors={th.cardTint} locations={th.cardTintAt} style={StyleSheet.absoluteFill} />
      <Halftone width={width} height={150} cx={width / 2} cy={0} color={th.dot} />
    </View>
  )
}

const AMBIENT_H = 380

export function TintBackground() {
  const th = useAuthTheme()
  // The blurred photo fades into the page colour inside its own box, so there's no hard edge where it ends.
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg }]} pointerEvents="none">
      <View style={s.ambientBox}>
        <LinearGradient colors={th.tint} style={StyleSheet.absoluteFill} />
        <Image source={HERO} blurRadius={30} resizeMode="cover" style={[s.ambient, { opacity: th.isDark ? 0.22 : 0.4 }]} />
        <LinearGradient
          colors={th.isDark ? ['rgba(10,18,34,0)', '#0A1222'] : ['rgba(255,255,255,0)', '#FFFFFF']}
          locations={[0.2, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  errRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7, paddingHorizontal: 2 },
  errText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: F.medium },
  fieldRing: { borderRadius: 16, padding: 3, margin: -3 },
  phoneWrap: { position: 'relative' },
  phoneGlow: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 20 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 6 },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 12.5, fontFamily: F.semibold },
  fieldInput: { fontSize: 15, fontFamily: F.medium, paddingVertical: 2, paddingHorizontal: 0, margin: 0 },
  phone: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', height: 50, borderRadius: 13, overflow: 'hidden' },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7, height: '100%', paddingHorizontal: 12, borderRightWidth: 1 },
  flag: { width: 21, height: 14, borderRadius: 3, overflow: 'hidden' },
  ccText: { fontSize: 14, fontFamily: F.semibold },
  phoneInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, fontFamily: F.medium, letterSpacing: 0.8, textAlign: 'left' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 14, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontSize: 15.5, fontFamily: F.semibold },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22 },
  langText: { fontSize: 13, fontFamily: F.semibold },
  ambientBox: { position: 'absolute', top: 0, left: 0, right: 0, height: AMBIENT_H, overflow: 'hidden' },
  ambient: { position: 'absolute', top: -40, left: -40, right: -40, height: AMBIENT_H + 40 },
  backdrop: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', borderTopWidth: 1 },
  btnFill: { ...StyleSheet.absoluteFillObject, borderRadius: 14, overflow: 'hidden' },
  btn2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16 },
  btn2Text: { fontSize: 14, fontFamily: F.semibold },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 50, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18 },
  googleText: { fontSize: 15, fontFamily: F.semibold },
  googleCompact: { flex: 1, gap: 0, paddingHorizontal: 0 },
  socialRow: { flexDirection: 'row', gap: 10 },
  hint: { fontSize: 11.5, lineHeight: 17, fontFamily: F.regular, marginTop: 5, paddingHorizontal: 2 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12.5, fontFamily: F.medium },
})
