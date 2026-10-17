// Shared building blocks for the redesigned customer screens: one size scale, one palette, and the
// small components (cards, chips, headers, backgrounds) every screen reuses so they look like one app.
import { useEffect, useMemo, useRef, useState, memo, type ReactNode } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo, I18nManager, useWindowDimensions,
  type StyleProp, type ViewStyle, type TextStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Check } from 'lucide-react-native'
import { useLanguage } from '../contexts/LanguageContext'
import { F, useAuthTheme, Halftone, tapHaptic } from './auth/ui'

export { F, Halftone, tapHaptic }

// One size scale for every control (real-device dp).
export const SIZE = {
  L: 50,      // primary buttons, text inputs
  M: 44,      // secondary buttons, segmented controls, selectable tiles, list rows
  S: 30,      // chips, pills, small inline buttons
  ICON: 36,   // icon-only buttons (back, call, chat…)
  STEP: 30,   // quantity stepper buttons
  rL: 14,
  rM: 12,
  rS: 15,
} as const

export const HIT = { top: 8, bottom: 8, left: 8, right: 8 }

export function useBrand() {
  const th = useAuthTheme()
  return useMemo(() => ({
    ...th,
    page: th.isDark ? '#0A1222' : '#F5F8FC',
    card: th.isDark ? '#0F1A2E' : '#FFFFFF',
    cardBorder: th.isDark ? '#1E2B44' : '#E6ECF4',
    divider: th.isDark ? '#1A2640' : '#EEF2F7',
    raised: th.isDark ? '#121C31' : '#FFFFFF',
    raisedBorder: th.isDark ? '#22304A' : '#E3E9F2',
    tint: th.isDark ? 'rgba(14,165,233,0.14)' : '#E6F3FD',
    tintText: th.isDark ? '#7CC8F5' : '#0369A1',
    tintBorder: th.isDark ? 'rgba(56,189,248,0.3)' : '#CDE6FA',
    gold: '#FCD34D',
    okText: th.isDark ? '#4ADE80' : '#15803D',
    okTint: th.isDark ? 'rgba(34,197,94,0.13)' : '#E9FBF0',
    warnTint: th.isDark ? 'rgba(245,158,11,0.10)' : '#FFF8E8',
    warnText: th.isDark ? '#E7D3A8' : '#7A5410',
    dangerText: '#F87171',
    dangerTint: 'rgba(248,113,113,0.08)',
    dangerBorder: 'rgba(248,113,113,0.35)',
    accentIcon: th.isDark ? '#7CC8F5' : '#0284C7',
    iconTile: th.isDark ? '#16223A' : '#EEF4FF',
  }), [th])
}

export type Brand = ReturnType<typeof useBrand>

export function cardShadow(b: Brand): ViewStyle {
  return b.isDark ? {} : { shadowColor: '#10284F', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }
}

// "132" instead of "132.00"; keeps real decimals ("12.5").
export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

// 8:05 م / 8:05 PM with Latin digits everywhere.
export function clock(d: Date, en: boolean) {
  const h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? (en ? 'AM' : 'ص') : (en ? 'PM' : 'م')}`
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "15 أكتوبر" / "15 Oct" (Latin digits).
export function shortDate(d: Date, en: boolean) {
  return `${d.getDate()} ${(en ? MONTHS_EN : MONTHS_AR)[d.getMonth()]}`
}

export function ForwardChevron({ color, size = 16 }: { color: string; size?: number }) {
  return I18nManager.isRTL ? <ChevronLeft size={size} color={color} /> : <ChevronRight size={size} color={color} />
}

export function BackIcon({ color, size = 18 }: { color: string; size?: number }) {
  return I18nManager.isRTL ? <ArrowRight size={size} color={color} /> : <ArrowLeft size={size} color={color} />
}

export function ForwardIcon({ color, size = 16 }: { color: string; size?: number }) {
  return I18nManager.isRTL ? <ArrowLeft size={size} color={color} /> : <ArrowRight size={size} color={color} />
}

export function IconButton({ onPress, children, label, style, tone = 'raised' }: {
  onPress?: () => void
  children: ReactNode
  label: string
  style?: StyleProp<ViewStyle>
  tone?: 'raised' | 'tint' | 'glass'
}) {
  const b = useBrand()
  const bg = tone === 'tint' ? b.iconTile : tone === 'glass' ? 'rgba(255,255,255,0.18)' : b.raised
  const border = tone === 'glass' ? 'rgba(255,255,255,0.3)' : b.raisedBorder
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.iconBtn, { backgroundColor: bg, borderColor: border }, style]}
    >
      {children}
    </TouchableOpacity>
  )
}

export function ScreenHeader({ title, onBack, right, backLabel = 'Back' }: { title: string; onBack?: () => void; right?: ReactNode; backLabel?: string }) {
  const b = useBrand()
  return (
    <View style={s.header}>
      {onBack ? (
        <IconButton onPress={onBack} label={backLabel}>
          <BackIcon color={b.ink} />
        </IconButton>
      ) : null}
      <Text style={[s.headerTitle, { color: b.ink }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  )
}

export function Eyebrow({ text }: { text: string }) {
  return (
    <View style={s.eyebrowRow}>
      <View style={s.eyebrowBar} />
      <Text style={s.eyebrow}>{text}</Text>
    </View>
  )
}

export function SectionTitle({ title, eyebrow, action, onAction, count, style }: {
  title: string
  eyebrow?: string
  action?: string
  onAction?: () => void
  count?: number
  style?: StyleProp<ViewStyle>
}) {
  const b = useBrand()
  return (
    <View style={[s.section, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Eyebrow text={eyebrow} /> : null}
        <View style={s.sectionRow}>
          <Text style={[s.sectionTitle, { color: b.ink }]}>{title}</Text>
          {count ? <View style={s.count}><Text style={s.countText}>{count}</Text></View> : null}
        </View>
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={HIT} accessibilityRole="button" style={[s.sectionAction, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
          <Text style={[s.sectionActionText, { color: b.tintText }]}>{action}</Text>
          <ForwardChevron color={b.tintText} size={13} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export function Chip({ label, active, onPress, icon, style }: { label: string; active?: boolean; onPress?: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const b = useBrand()
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 7, bottom: 7 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[s.chip, active ? { backgroundColor: b.primary, borderColor: b.primary } : { backgroundColor: b.card, borderColor: b.cardBorder }, style]}
    >
      {icon}
      <Text style={[s.chipText, { color: active ? '#fff' : b.muted }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

export function Pill({ label, tone = 'info', icon }: { label: string; tone?: 'info' | 'ok' | 'warn' | 'danger' | 'neutral'; icon?: ReactNode }) {
  const b = useBrand()
  const map = {
    info: [b.tint, b.tintText],
    ok: [b.okTint, b.okText],
    warn: [b.warnTint, b.isDark ? '#FBBF24' : '#B45309'],
    danger: [b.dangerTint, b.dangerText],
    neutral: [b.iconTile, b.muted],
  } as const
  const [bg, fg] = map[tone]
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      {icon}
      <Text style={[s.pillText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function Card({ children, style, pad = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  const b = useBrand()
  return <View style={[s.card, { backgroundColor: b.card, borderColor: b.cardBorder }, pad && { padding: 12 }, cardShadow(b), style]}>{children}</View>
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const b = useBrand()
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: b.divider }, style]} />
}

// A soft, slowly-pulsing glow drawn behind its child to draw the eye to the next step
// in a flow. It only animates while `active`; otherwise it renders the child untouched.
export function PulseHighlight({ active, children, radius = 16, style }: {
  active?: boolean
  children: ReactNode
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const b = useBrand()
  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [active, pulse])
  return (
    <View style={[{ position: 'relative' }, style]}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: radius + 5, backgroundColor: b.primary, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.3] }) }}
        />
      ) : null}
      {children}
    </View>
  )
}

// Segmented progress bar (e.g. 8 order stages). Fills from the start side.
export function Segments({ total, done, current }: { total: number; done: number; current?: boolean }) {
  const b = useBrand()
  return (
    <View style={s.segs}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.seg, { backgroundColor: i < done ? b.primary : b.isDark ? '#22304A' : '#E2EAF3', opacity: current && i === done - 1 ? 0.75 : 1 }]} />
      ))}
    </View>
  )
}

export function Stepper({ qty, onMinus, onPlus, onRemove, disabled }: { qty: number; onMinus: () => void; onPlus: () => void; onRemove?: () => void; disabled?: boolean }) {
  const b = useBrand()
  return (
    <View style={s.stepWrap}>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="Remove" style={[s.stepBtn, { backgroundColor: 'rgba(248,113,113,0.12)' }]}>
          <Text style={[s.stepGlyph, { color: b.dangerText }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
      <View style={[s.stepper, { borderColor: b.raisedBorder, backgroundColor: b.isDark ? '#0A1222' : '#F5F8FC' }]}>
        <TouchableOpacity onPress={onMinus} disabled={disabled} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="Decrease" style={[s.stepBtn, { backgroundColor: b.isDark ? '#16223A' : '#FFFFFF' }]}>
          <Text style={[s.stepGlyph, { color: b.ink2 }]}>−</Text>
        </TouchableOpacity>
        <Text style={[s.stepQty, { color: b.ink }]}>{qty}</Text>
        <TouchableOpacity onPress={onPlus} disabled={disabled} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="Increase" style={[s.stepBtn, { backgroundColor: b.primary }]}>
          <Text style={[s.stepGlyph, { color: '#fff' }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export type Choice = { key: string; label: string; icon: ReactNode }

// 2-column selectable tiles (payment methods). Selected tile: blue border + ✓ badge on its corner.
export function ChoiceGrid({ items, value, onChange }: { items: Choice[]; value: string; onChange: (k: string) => void }) {
  const b = useBrand()
  return (
    <View style={s.grid}>
      {items.map(it => {
        const on = it.key === value
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => { tapHaptic(); onChange(it.key) }}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[s.tile, { borderColor: on ? b.primary : b.cardBorder, backgroundColor: on ? (b.isDark ? 'rgba(14,165,233,0.12)' : '#F0F8FF') : b.card }, cardShadow(b)]}
          >
            <View style={[s.tileIcon, { backgroundColor: on ? b.primary : b.iconTile }]}>{it.icon}</View>
            <Text style={[s.tileText, { color: on && b.isDark ? '#fff' : b.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{it.label}</Text>
            {on ? (
              <View style={[s.tileCheck, { backgroundColor: b.primary, borderColor: b.page }]}>
                <Check size={11} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// Two-option segmented control (e.g. الآن / جدولة, active / completed tabs).
export function Segmented({ items, value, onChange }: { items: { key: string; label: string; icon?: ReactNode; badge?: number }[]; value: string; onChange: (k: string) => void }) {
  const b = useBrand()
  return (
    <View style={[s.segmented, { backgroundColor: b.card, borderColor: b.cardBorder }]}>
      {items.map(it => {
        const on = it.key === value
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => { tapHaptic(); onChange(it.key) }}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.segBtn, on && { backgroundColor: b.primary }]}
          >
            {it.icon}
            <Text style={[s.segText, { color: on ? '#fff' : b.muted }]} numberOfLines={1}>{it.label}</Text>
            {it.badge != null ? (
              <View style={[s.segBadge, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : b.iconTile }]}>
                <Text style={[s.segBadgeText, { color: on ? '#fff' : b.muted }]}>{it.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// Sticky bottom bar: total on one side, the main action on the other.
export function StickyFooter({ label, total, currency, children, bottomInset }: { label: string; total: string; currency: string; children: ReactNode; bottomInset: number }) {
  const b = useBrand()
  return (
    <View style={[s.footer, { paddingBottom: Math.max(bottomInset, 10) + 8, backgroundColor: b.isDark ? 'rgba(10,18,34,0.97)' : 'rgba(255,255,255,0.97)', borderTopColor: b.divider }]}>
      <View>
        <Text style={[s.footLabel, { color: b.muted }]}>{label}</Text>
        <Text style={[s.footTotal, { color: b.ink }]}>{total} <Text style={[s.footCur, { color: b.muted }]}>{currency}</Text></Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {})
  }, [])
  return reduce
}

// Three 320px periods: anchored to the start edge and drifted one period, the visible part never runs
// off the drawing in LTR or RTL (the start edge flips sides in RTL).
const WAVE_W = 960
function wavePath(y0: number, amp: number, phase: number, period = 320, n = 144) {
  let d = ''
  for (let i = 0; i <= n; i++) {
    const x = (WAVE_W * i) / n
    const y = y0 + amp * Math.sin((2 * Math.PI * x) / period + phase) + amp * 0.35 * Math.sin((2 * Math.PI * x) / (period / 2) + phase * 1.7)
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
  }
  return d
}

// Drifts the drawing by one 320px period, forever, so the loop is seamless.
function useDrift(duration: number) {
  const reduce = useReduceMotion()
  const x = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduce])
  return x.interpolate({ inputRange: [0, 1], outputRange: [0, I18nManager.isRTL ? 320 : -320] })
}

// Thin flowing wave lines behind a screen header (orders, profile, plans, edit profile).
export const FlowLines = memo(function FlowLines({ height = 280, top = 30 }: { height?: number; top?: number }) {
  const b = useBrand()
  const tx = useDrift(18000)
  const paths = useMemo(() => Array.from({ length: 14 }, (_, k) => ({
    d: wavePath(top + k * 13, 18 + k * 1.3, k * 0.42),
    o: 0.1 + 0.5 * Math.exp(-(((k - 6) / 4.5) ** 2)),
  })), [top])
  const c1 = b.isDark ? '#38BDF8' : '#0EA5E9'
  const c2 = b.isDark ? '#818CF8' : '#6366F1'
  return (
    <View pointerEvents="none" style={[s.bgLayer, { height }]}>
      <Animated.View style={{ width: WAVE_W, height, transform: [{ translateX: tx }], position: 'absolute', top: 0, start: 0 }}>
        <Svg width={WAVE_W} height={height}>
          <Defs>
            <SvgGradient id="flow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={c1} stopOpacity="0" />
              <Stop offset="0.3" stopColor={c1} />
              <Stop offset="0.7" stopColor={c2} />
              <Stop offset="1" stopColor={c1} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          {paths.map((p, i) => <Path key={i} d={p.d} stroke="url(#flow)" strokeWidth={1.1} fill="none" opacity={b.isDark ? p.o : p.o * 0.85} />)}
        </Svg>
      </Animated.View>
    </View>
  )
})

// Soft translucent wave bands with a glowing crest (bag offer screen).
export const SoftWaves = memo(function SoftWaves({ height = 520, crest = 300 }: { height?: number; crest?: number }) {
  const b = useBrand()
  const tx = useDrift(26000)
  const bands = b.isDark
    ? [['#0EA5E9', 0.2], ['#6366F1', 0.15], ['#22D3EE', 0.12]]
    : [['#7DD3FC', 0.32], ['#A5B4FC', 0.26], ['#BAE6FD', 0.32]]
  return (
    <View pointerEvents="none" style={[s.bgLayer, { height }]}>
      <Animated.View style={{ width: WAVE_W, height, transform: [{ translateX: tx }], position: 'absolute', top: 0, start: 0 }}>
        <Svg width={WAVE_W} height={height}>
          {bands.map(([c, o], i) => (
            <Path key={i} d={`${wavePath(crest + i * 30, 24 + i * 6, i * 1.3)} L${WAVE_W},0 L0,0 Z`} fill={c as string} opacity={o as number} />
          ))}
          <Path d={wavePath(crest, 24, 0)} stroke={b.isDark ? '#7DD3FC' : '#0EA5E9'} strokeWidth={1.4} fill="none" opacity={0.55} />
        </Svg>
      </Animated.View>
    </View>
  )
})

// Halftone dots + soft glow behind a screen header (home, addresses).
export function DotsBackdrop({ height = 220 }: { height?: number }) {
  const b = useBrand()
  const { width } = useWindowDimensions()
  return (
    <View pointerEvents="none" style={[s.bgLayer, { height }]}>
      <LinearGradient
        colors={b.isDark ? ['rgba(14,165,233,0.16)', 'rgba(14,165,233,0)'] : ['rgba(14,165,233,0.10)', 'rgba(14,165,233,0)']}
        style={StyleSheet.absoluteFill}
      />
      <Halftone width={width} height={height} cx={width / 2} cy={0} color={b.dot} />
    </View>
  )
}

export const textStyles = StyleSheet.create({
  title: { fontFamily: F.display, fontSize: 20 },
  h3: { fontFamily: F.display, fontSize: 15 },
  body: { fontFamily: F.regular, fontSize: 13 },
  label: { fontFamily: F.semibold, fontSize: 12.5 },
  small: { fontFamily: F.regular, fontSize: 11.5 },
  money: { fontFamily: F.display, fontSize: 16 },
}) as Record<string, TextStyle>

const s = StyleSheet.create({
  bgLayer: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  iconBtn: { width: SIZE.ICON, height: SIZE.ICON, borderRadius: SIZE.rM, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.ICON },
  headerTitle: { flex: 1, fontFamily: F.display, fontSize: 20 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  eyebrowBar: { width: 14, height: 2, borderRadius: 1, backgroundColor: '#38BDF8' },
  eyebrow: { fontSize: 11, fontFamily: F.bold, color: '#38BDF8' },
  section: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 22, marginBottom: 10, marginHorizontal: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: F.display, fontSize: 17 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 3, height: SIZE.S - 4, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1 },
  sectionActionText: { fontSize: 11.5, fontFamily: F.bold },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: SIZE.S, paddingHorizontal: 12, borderRadius: SIZE.rS, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: F.semibold },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontFamily: F.bold },
  card: { borderRadius: 18, borderWidth: 1 },
  segs: { flex: 1, flexDirection: 'row', gap: 3 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  stepWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 2, borderRadius: 11, borderWidth: 1 },
  stepBtn: { width: SIZE.STEP, height: SIZE.STEP, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 16, fontFamily: F.bold, lineHeight: 20 },
  stepQty: { minWidth: 24, textAlign: 'center', fontSize: 14, fontFamily: F.display },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: SIZE.M + 4, paddingHorizontal: 10, borderRadius: SIZE.rM, borderWidth: 1.5 },
  tileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, fontSize: 13, fontFamily: F.bold },
  tileCheck: { position: 'absolute', top: -8, start: -8, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: SIZE.rM + 2, borderWidth: 1, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M - 6, borderRadius: SIZE.rM - 2 },
  segText: { fontSize: 13, fontFamily: F.bold },
  segBadge: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  segBadgeText: { fontSize: 10.5, fontFamily: F.bold },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1 },
  footLabel: { fontSize: 11, fontFamily: F.medium },
  footTotal: { fontSize: 19, fontFamily: F.display },
  footCur: { fontSize: 11, fontFamily: F.semibold },
})
