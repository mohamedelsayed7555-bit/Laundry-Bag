import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Pressable, Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Info } from 'lucide-react-native'
import { useLanguage } from '../contexts/LanguageContext'
import { useBrand, F, SIZE, money } from './brand'
import { PrimaryButton, SecondaryButton } from './auth/ui'

/** The four a customer can recognise without a tape measure. */
export const PRESETS: { l: number; w: number; ar: string; en: string }[] = [
  { l: 1, w: 1.5, ar: 'صغيرة', en: 'Small' },
  { l: 2, w: 3, ar: 'متوسطة', en: 'Medium' },
  { l: 3, w: 4, ar: 'كبيرة', en: 'Large' },
  { l: 4, w: 5, ar: 'كبيرة جداً', en: 'Extra large' },
]

const MAX_SIDE = 30
// _price_items rejects a line over 500, and the line's quantity here is an area
const MAX_QTY = 500

/** Arabic-Indic and Eastern-Arabic keyboards send their own digits; the decimal
 *  separator comes through as a comma in several locales. */
function normalise(v: string) {
  let out = ''
  for (const ch of v) {
    const c = ch.codePointAt(0)!
    if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660)
    else if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0)
    else if (ch === '٫' || ch === ',') out += '.'
    else if ((ch >= '0' && ch <= '9') || ch === '.') out += ch
  }
  // one decimal point, at most two places after it
  const dot = out.indexOf('.')
  if (dot >= 0) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  return out.slice(0, 6)
}

const num = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** trims 2.00 to 2 so the stored size reads the way it was typed */
const fmt = (n: number) => String(Math.round(n * 100) / 100)

export type SizePick = { size: string; area: number; count: number }

/** Parses "2×3" back into its two sides so an existing line can be reopened. */
export function parseSize(size?: string | null): { l: string; w: string } {
  const m = /^([0-9.]+)\s*[x×*]\s*([0-9.]+)$/.exec((size ?? '').trim())
  return m ? { l: m[1], w: m[2] } : { l: '', w: '' }
}

/**
 * A rug is priced by the square metre, so "add one" means nothing: the app has
 * to know how big it is first. Most people cannot give that off the top of their
 * head, which is what the four preset sizes are for — they fill the two fields
 * rather than replacing them, so the number stays visible and editable.
 */
export default function SizeSheet({
  visible, itemName, unitPrice, initial, onAdd, onDismiss,
}: {
  visible: boolean
  itemName: string
  unitPrice: number
  initial?: { size?: string; count?: number } | null
  onAdd: (pick: SizePick) => void
  onDismiss: () => void
}) {
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'

  const [len, setLen] = useState('')
  const [wid, setWid] = useState('')
  const [count, setCount] = useState(1)

  // reopening an existing line puts its own numbers back in the fields
  useEffect(() => {
    if (!visible) return
    const p = parseSize(initial?.size)
    setLen(p.l)
    setWid(p.w)
    setCount(Math.max(1, initial?.count ?? 1))
  }, [visible, initial?.size, initial?.count])

  const l = num(len)
  const w = num(wid)
  const valid = l > 0 && w > 0 && l <= MAX_SIDE && w <= MAX_SIDE
  // charged by the whole metre, rounded up — the trade's own convention, and it
  // keeps the quantity an integer the way every other line in the order is
  const area = valid ? Math.max(1, Math.ceil(l * w)) : 0
  const qty = area * count
  const over = qty > MAX_QTY
  const maxCount = area > 0 ? Math.max(1, Math.floor(MAX_QTY / area)) : 1

  const activePreset = useMemo(
    () => PRESETS.findIndex(p => p.l === l && p.w === w),
    [l, w],
  )

  const sideText = isEn ? 'm' : 'م'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={s.flex} behavior="padding">
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />

          <View style={[s.card, { backgroundColor: b.card, borderColor: b.cardBorder, paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
            <View style={[s.handle, { backgroundColor: b.cardBorder }]} />

            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[s.title, { color: b.ink }]} numberOfLines={2}>{itemName}</Text>
              <Text style={[s.subtitle, { color: b.muted }]}>
                {money(unitPrice)} {t('currency')} · {isEn ? 'per square metre' : 'للمتر المربع'}
              </Text>

              <Text style={[s.label, { color: b.ink2 }]}>
                {isEn ? "Don't know the size? Pick the closest:" : 'مش عارف المقاس؟ اختار الأقرب:'}
              </Text>
              <View style={s.presetGrid}>
                {PRESETS.map((p, i) => {
                  const on = i === activePreset
                  return (
                    <TouchableOpacity
                      key={p.ar}
                      onPress={() => { setLen(fmt(p.l)); setWid(fmt(p.w)) }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[
                        s.preset,
                        { backgroundColor: b.field, borderColor: b.fieldBorder },
                        on && { backgroundColor: b.primary, borderColor: b.primary },
                      ]}
                    >
                      <Text style={[s.presetName, { color: on ? '#fff' : b.ink }]} numberOfLines={1}>
                        {isEn ? p.en : p.ar}
                      </Text>
                      <Text style={[s.presetDim, { color: on ? 'rgba(255,255,255,0.9)' : b.muted }]} numberOfLines={1}>
                        {fmt(p.l)}×{fmt(p.w)} {sideText}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[s.label, { color: b.ink2 }]}>
                {isEn ? 'Or enter the size yourself:' : 'أو اكتب المقاس بنفسك:'}
              </Text>
              <View style={s.dimRow}>
                <View style={s.dimField}>
                  <Text style={[s.dimLabel, { color: b.muted }]}>{isEn ? 'Length' : 'الطول'}</Text>
                  <View style={[s.input, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
                    <TextInput
                      style={[s.inputText, { color: b.ink }]}
                      value={len}
                      onChangeText={v => setLen(normalise(v))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={b.faint}
                      maxLength={6}
                      textAlign="center"
                      accessibilityLabel={isEn ? 'Length in metres' : 'الطول بالمتر'}
                    />
                    <Text style={[s.inputUnit, { color: b.muted }]}>{sideText}</Text>
                  </View>
                </View>

                <Text style={[s.times, { color: b.faint }]}>×</Text>

                <View style={s.dimField}>
                  <Text style={[s.dimLabel, { color: b.muted }]}>{isEn ? 'Width' : 'العرض'}</Text>
                  <View style={[s.input, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
                    <TextInput
                      style={[s.inputText, { color: b.ink }]}
                      value={wid}
                      onChangeText={v => setWid(normalise(v))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={b.faint}
                      maxLength={6}
                      textAlign="center"
                      accessibilityLabel={isEn ? 'Width in metres' : 'العرض بالمتر'}
                    />
                    <Text style={[s.inputUnit, { color: b.muted }]}>{sideText}</Text>
                  </View>
                </View>
              </View>

              <View style={[s.countRow, { borderColor: b.divider }]}>
                <Text style={[s.countLabel, { color: b.ink2 }]} numberOfLines={2}>
                  {isEn ? 'How many this size' : 'عدد القطع بنفس المقاس'}
                </Text>
                <View style={[s.counter, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
                  <TouchableOpacity
                    onPress={() => setCount(c => Math.max(1, c - 1))}
                    disabled={count <= 1}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="−"
                    style={s.counterBtn}
                  >
                    <Text style={[s.counterSign, { color: count <= 1 ? b.faint : b.ink }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[s.counterNum, { color: b.ink }]}>{count}</Text>
                  <TouchableOpacity
                    onPress={() => setCount(c => Math.min(maxCount, c + 1))}
                    disabled={!valid || count >= maxCount}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="+"
                    style={s.counterBtn}
                  >
                    <Text style={[s.counterSign, { color: !valid || count >= maxCount ? b.faint : b.ink }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[s.summary, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.summaryArea, { color: b.ink }]} numberOfLines={1}>
                    {valid
                      ? count > 1
                        ? `${area} ${isEn ? 'm² each' : 'م² للقطعة'} · ${qty} ${isEn ? 'm² total' : 'م² إجمالي'}`
                        : `${area} ${isEn ? 'm²' : 'م²'}`
                      : isEn ? 'Enter the size' : 'اكتب المقاس'}
                  </Text>
                  <Text style={[s.summaryHint, { color: b.muted }]}>
                    {isEn ? 'Estimated price' : 'سعر تقديري'}
                  </Text>
                </View>
                <Text style={[s.summaryPrice, { color: b.tintText }]} numberOfLines={1}>
                  {valid ? `${money(unitPrice * qty)} ${t('currency')}` : '—'}
                </Text>
              </View>

              {over ? (
                <Text style={[s.warn, { color: b.dangerText }]}>
                  {isEn
                    ? `That comes to ${qty} m², more than one order can carry. Split it over two orders.`
                    : `ده بيطلع ${qty} م²، أكبر من اللي الطلب الواحد يشيله. قسّمه على طلبين.`}
                </Text>
              ) : null}

              <View style={[s.note, { borderColor: b.divider }]}>
                <Info size={14} color={b.muted} />
                <Text style={[s.noteText, { color: b.muted }]}>
                  {isEn
                    ? 'The price is an estimate — the piece is measured on pickup and the final price is confirmed then.'
                    : 'السعر تقديري — القطعة بتتقاس عند الاستلام والسعر النهائي بيتأكد ساعتها.'}
                </Text>
              </View>

              <View style={s.actions}>
                <SecondaryButton title={isEn ? 'Cancel' : 'إلغاء'} onPress={onDismiss} style={{ flex: 1 }} />
                <PrimaryButton
                  title={initial?.size ? (isEn ? 'Save' : 'حفظ') : (isEn ? 'Add to order' : 'أضف للطلب')}
                  disabled={!valid || over}
                  onPress={() => onAdd({ size: `${fmt(l)}×${fmt(w)}`, area, count })}
                  style={{ flex: 2 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,14,0.62)', justifyContent: 'flex-end' },
  card: { maxHeight: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, paddingHorizontal: 18, borderWidth: 1, borderBottomWidth: 0 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontFamily: F.display, textAlign: 'center' },
  subtitle: { fontSize: 12.5, fontFamily: F.medium, textAlign: 'center', marginTop: 3 },
  label: { fontSize: 12.5, fontFamily: F.bold, marginTop: 16, marginHorizontal: 2 },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  preset: { flexGrow: 1, flexBasis: '46%', minHeight: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 7, gap: 1 },
  presetName: { fontSize: 13, fontFamily: F.bold },
  presetDim: { fontSize: 11, fontFamily: F.medium },

  dimRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  dimField: { flex: 1, minWidth: 0 },
  dimLabel: { fontSize: 11.5, fontFamily: F.medium, marginBottom: 4, marginHorizontal: 2 },
  input: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1, paddingHorizontal: 10 },
  inputText: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: F.display, padding: 0 },
  inputUnit: { fontSize: 12, fontFamily: F.medium },
  times: { fontSize: 16, fontFamily: F.bold, paddingBottom: 13 },

  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  countLabel: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: F.semibold },
  counter: { flexDirection: 'row', alignItems: 'center', height: SIZE.S, borderRadius: SIZE.rM, borderWidth: 1, paddingHorizontal: 4 },
  counterBtn: { width: 32, height: '100%', alignItems: 'center', justifyContent: 'center' },
  counterSign: { fontSize: 18, fontFamily: F.bold, lineHeight: 22 },
  counterNum: { minWidth: 26, fontSize: 15, fontFamily: F.display, textAlign: 'center' },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  summaryArea: { fontSize: 14, fontFamily: F.bold },
  summaryHint: { fontSize: 11, fontFamily: F.medium, marginTop: 1 },
  summaryPrice: { fontSize: 17, fontFamily: F.display, flexShrink: 0 },

  warn: { fontSize: 12, fontFamily: F.medium, marginTop: 10, marginHorizontal: 2, lineHeight: 18 },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  noteText: { flex: 1, minWidth: 0, fontSize: 11.5, fontFamily: F.regular, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 2 },
})
