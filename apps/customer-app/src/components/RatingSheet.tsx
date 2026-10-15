import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useLanguage } from '../contexts/LanguageContext'
import { useBrand, F, SIZE } from './brand'
import { PrimaryButton, SecondaryButton } from './auth/ui'

function Stars({ value, onChange, color }: { value: number; onChange: (n: number) => void; color: string }) {
  return (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = n <= value
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`${n}`}
          >
            <Svg width={32} height={32} viewBox="0 0 24 24">
              <Path
                d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"
                fill={on ? '#FBBF24' : 'none'}
                stroke={on ? '#F59E0B' : color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/** Shared rating sheet — used from the home screen and the order details screen. */
export default function RatingSheet({
  visible, orderNumber, showDriver, service, driver, note, submitting,
  onService, onDriver, onNote, onSubmit, onDismiss,
}: {
  visible: boolean
  orderNumber?: string | null
  showDriver?: boolean
  service: number
  driver: number
  note: string
  submitting?: boolean
  onService: (n: number) => void
  onDriver: (n: number) => void
  onNote: (v: string) => void
  onSubmit: () => void
  onDismiss: () => void
}) {
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const num = String(orderNumber ?? '').replace(/^#+/, '')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: b.card, borderColor: b.cardBorder, paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
          <View style={[s.handle, { backgroundColor: b.cardBorder }]} />
          <Text style={[s.title, { color: b.ink }]}>{t('rateOrderTitle')}</Text>
          {num ? <Text style={[s.subtitle, { color: b.muted }]}>{t('orderHash')}{num}</Text> : null}

          <Text style={[s.label, { color: b.ink2 }]}>{t('serviceRating')}</Text>
          <Stars value={service} onChange={onService} color={b.faint} />

          {showDriver && (
            <>
              <Text style={[s.label, { color: b.ink2 }]}>{t('driverRating')}</Text>
              <Stars value={driver} onChange={onDriver} color={b.faint} />
            </>
          )}

          <Text style={[s.label, { color: b.ink2 }]}>{t('notesLabel')}</Text>
          <TextInput
            style={[s.input, { backgroundColor: b.field, color: b.ink, borderColor: b.fieldBorder }]}
            placeholder={t('ratingNotes')}
            placeholderTextColor={b.faint}
            value={note}
            onChangeText={onNote}
            multiline
            textAlign={isEn ? 'left' : 'right'}
          />

          <View style={s.actions}>
            <SecondaryButton title={t('later')} onPress={onDismiss} style={{ flex: 1 }} />
            <PrimaryButton
              title={t('submitRating')}
              loadingTitle={t('submittingRating')}
              loading={submitting}
              disabled={service === 0}
              onPress={onSubmit}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,14,0.62)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, paddingHorizontal: 18, borderWidth: 1, borderBottomWidth: 0 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 19, fontFamily: F.display, textAlign: 'center' },
  subtitle: { fontSize: 12.5, fontFamily: F.regular, textAlign: 'center', marginTop: 2 },
  label: { fontSize: 12.5, fontFamily: F.bold, marginTop: 14, marginHorizontal: 2 },
  starsRow: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'center' },
  input: { borderRadius: SIZE.rL, padding: 12, fontSize: 13.5, fontFamily: F.regular, minHeight: 62, marginTop: 8, borderWidth: 1, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
})
