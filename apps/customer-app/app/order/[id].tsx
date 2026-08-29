import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import { CANCELLABLE_STATUSES } from '../../src/shared/types'

const statusConfig: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending:    { label: 'في الانتظار',     color: '#f59e0b', icon: '⏳', step: 0 },
  assigned:   { label: 'تم تعيين سائق',   color: '#3b82f6', icon: '🚗', step: 1 },
  picked_up:  { label: 'تم الاستلام',     color: '#8b5cf6', icon: '📦', step: 2 },
  processing: { label: 'جاري المعالجة',   color: '#06b6d4', icon: '🔄', step: 3 },
  ready:      { label: 'جاهز للتوصيل',   color: '#10b981', icon: '✅', step: 4 },
  delivering: { label: 'جاري التوصيل',   color: '#8b5cf6', icon: '🛵', step: 5 },
  delivered:  { label: 'تم التوصيل',     color: '#10b981', icon: '🎉', step: 6 },
  cancelled:  { label: 'ملغي',           color: '#ef4444', icon: '❌', step: -1 },
}

const serviceLabel: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف',
}

const steps = ['pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadOrder()
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => loadOrder())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('id', id)
      .single()
    setOrder(data)
    setLoading(false)
  }

  async function handleCancel() {
    Alert.alert('إلغاء الطلب', 'هل أنت متأكد من إلغاء هذا الطلب؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم، إلغاء', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('orders').update({
            status: 'cancelled',
            cancellation_reason: 'إلغاء بواسطة العميل',
            cancelled_at: new Date().toISOString(),
          }).eq('id', id)
          if (error) Alert.alert('خطأ', 'حدث خطأ أثناء الإلغاء')
          else loadOrder()
        }
      },
    ])
  }

  async function handleRate() {
    if (ratingService === 0) { Alert.alert('خطأ', 'اختر تقييم الخدمة'); return }
    setSubmitting(true)
    const { error } = await supabase.from('orders').update({
      rating_service: ratingService,
      rating_driver: ratingDriver || null,
      rating_note: ratingNote || null,
      rated_at: new Date().toISOString(),
    }).eq('id', id)
    setSubmitting(false)
    if (error) Alert.alert('خطأ', 'حدث خطأ')
    else { setShowRating(false); loadOrder() }
  }

  if (loading) return <View style={s.container}><Text style={s.loadingText}>جاري التحميل...</Text></View>
  if (!order) return <View style={s.container}><Text style={s.loadingText}>الطلب غير موجود</Text></View>

  const status = statusConfig[order.status] ?? statusConfig.pending
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const canRate = order.status === 'delivered' && !order.rated_at

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>→ رجوع</Text>
      </TouchableOpacity>

      <View style={s.headerCard}>
        <Text style={s.orderNumber}>{order.order_number}</Text>
        <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
          <Text style={{ fontSize: 16 }}>{status.icon}</Text>
          <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {order.status !== 'cancelled' && (
        <View style={s.timelineCard}>
          <Text style={s.sectionTitle}>تتبع الطلب</Text>
          {steps.map((stepKey, i) => {
            const stepStatus = statusConfig[stepKey]
            const currentStep = statusConfig[order.status]?.step ?? 0
            const isDone = currentStep >= stepStatus.step
            const isCurrent = order.status === stepKey
            return (
              <View key={stepKey} style={s.timelineRow}>
                <View style={s.timelineLeft}>
                  <View style={[s.dot, isDone && s.dotDone, isCurrent && s.dotCurrent]} />
                  {i < steps.length - 1 && <View style={[s.line, isDone && s.lineDone]} />}
                </View>
                <Text style={[s.timelineLabel, isDone && s.timelineLabelDone, isCurrent && s.timelineLabelCurrent]}>
                  {stepStatus.icon} {stepStatus.label}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      <View style={s.detailsCard}>
        <Text style={s.sectionTitle}>تفاصيل الطلب</Text>
        <DetailRow label="الخدمة" value={serviceLabel[order.service_type] ?? order.service_type} />
        <DetailRow label="عدد القطع" value={String(order.items_count)} />
        <DetailRow label="المبلغ" value={`${order.total?.toFixed(2)} ج.م`} highlight />
        <DetailRow label="طريقة الدفع" value={order.payment_method === 'cash' ? 'كاش' : order.payment_method === 'instapay' ? 'إنستاباي' : 'محفظة'} />
        <DetailRow label="حالة الدفع" value={order.payment_status === 'confirmed' ? 'مؤكد' : order.payment_status === 'refunded' ? 'مسترد' : 'معلق'} />
        <DetailRow label="التاريخ" value={new Date(order.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
        {order.notes && <DetailRow label="ملاحظات" value={order.notes} />}
      </View>

      {order.driver && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>السائق</Text>
          <DetailRow label="الاسم" value={order.driver.name} />
          {order.driver.phone && <DetailRow label="التليفون" value={order.driver.phone} />}
          <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/chat/${order.id}`)}>
            <Text style={s.chatBtnText}>💬 محادثة مع السائق</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.rated_at && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>التقييم</Text>
          <DetailRow label="تقييم الخدمة" value={'⭐'.repeat(order.rating_service)} />
          {order.rating_driver && <DetailRow label="تقييم السائق" value={'⭐'.repeat(order.rating_driver)} />}
          {order.rating_note && <DetailRow label="ملاحظات" value={order.rating_note} />}
        </View>
      )}

      {canRate && !showRating && (
        <TouchableOpacity style={s.rateBtn} onPress={() => setShowRating(true)}>
          <Text style={s.rateBtnText}>⭐ قيّم الطلب</Text>
        </TouchableOpacity>
      )}

      {showRating && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>تقييم الطلب</Text>

          <Text style={s.ratingLabel}>تقييم الخدمة</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRatingService(n)}>
                <Text style={[s.star, n <= ratingService && s.starActive]}>{n <= ratingService ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {order.driver && (
            <>
              <Text style={s.ratingLabel}>تقييم السائق</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setRatingDriver(n)}>
                    <Text style={[s.star, n <= ratingDriver && s.starActive]}>{n <= ratingDriver ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput
            style={s.ratingInput}
            placeholder="ملاحظاتك (اختياري)..."
            placeholderTextColor={colors.navy[400]}
            value={ratingNote}
            onChangeText={setRatingNote}
            multiline
            textAlign="right"
          />

          <View style={s.ratingActions}>
            <TouchableOpacity style={s.cancelRateBtn} onPress={() => setShowRating(false)}>
              <Text style={s.cancelRateText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.submitRateBtn, submitting && { opacity: 0.6 }]} onPress={handleRate} disabled={submitting}>
              <Text style={s.submitRateText}>{submitting ? 'جاري الإرسال...' : 'إرسال التقييم'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canCancel && (
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelText}>إلغاء الطلب</Text>
        </TouchableOpacity>
      )}

      {!canCancel && order.status !== 'cancelled' && order.status !== 'delivered' && (
        <View style={s.noCancelCard}>
          <Text style={s.noCancelText}>⚠️ لا يمكن إلغاء الطلب في حالة "{status.label}"</Text>
          <Text style={s.noCancelSub}>يمكن الإلغاء فقط قبل بدء المعالجة. تواصل مع السائق عبر المحادثة لأي استفسار.</Text>
        </View>
      )}
    </ScrollView>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, highlight && { color: colors.primary, fontWeight: '700' as const }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  loadingText: { color: colors.navy[300], textAlign: 'center', marginTop: 100, fontSize: 16 },
  backBtn: { marginBottom: 16 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },

  headerCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  orderNumber: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusLabel: { fontSize: 14, fontWeight: '700' },

  timelineCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
  timelineLeft: { alignItems: 'center', width: 24, marginLeft: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.navy[600], borderWidth: 2, borderColor: colors.navy[500] },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent, width: 16, height: 16, borderRadius: 8 },
  line: { width: 2, flex: 1, backgroundColor: colors.navy[600], marginVertical: 2 },
  lineDone: { backgroundColor: colors.primary },
  timelineLabel: { fontSize: 13, color: colors.navy[400], marginRight: 12, paddingTop: 0 },
  timelineLabelDone: { color: colors.navy[100] },
  timelineLabelCurrent: { color: '#fff', fontWeight: '700' },

  detailsCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.navy[700] },
  detailLabel: { fontSize: 13, color: colors.navy[300] },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '500', maxWidth: '60%', textAlign: 'left' },

  rateBtn: {
    backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  rateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  ratingLabel: { fontSize: 14, color: colors.navy[100], marginBottom: 8, marginTop: 8 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  star: { fontSize: 28, color: colors.navy[400] },
  starActive: { color: '#f59e0b' },
  ratingInput: {
    backgroundColor: colors.navy[700], borderRadius: 12, padding: 12,
    color: '#fff', fontSize: 14, minHeight: 60, marginTop: 8,
  },
  ratingActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelRateBtn: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 12, padding: 12, alignItems: 'center' },
  cancelRateText: { color: colors.navy[200], fontSize: 14, fontWeight: '600' },
  submitRateBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: 12, padding: 12, alignItems: 'center' },
  submitRateText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  chatBtn: {
    backgroundColor: colors.primary + '15', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 12,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  chatBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  cancelBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 16,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  cancelText: { color: colors.danger, fontSize: 16, fontWeight: '700' },

  noCancelCard: {
    backgroundColor: colors.warning + '12', borderRadius: 14, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: colors.warning + '30',
  },
  noCancelText: { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 6 },
  noCancelSub: { fontSize: 12, color: colors.navy[300], lineHeight: 18 },
})
