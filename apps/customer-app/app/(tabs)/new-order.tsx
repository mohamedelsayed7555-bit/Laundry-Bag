import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const services = [
  { key: 'wash', icon: '👔', label: 'غسيل' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف' },
  { key: 'iron', icon: '👕', label: 'كي فقط' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي' },
]

const paymentMethods = [
  { key: 'cash', icon: '💵', label: 'كاش' },
  { key: 'instapay', icon: '📱', label: 'إنستاباي' },
  { key: 'wallet', icon: '👛', label: 'محفظة' },
]

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const [serviceType, setServiceType] = useState('wash')
  const [itemsCount, setItemsCount] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [prices, setPrices] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('prices').select('*').eq('is_active', true).then(({ data }) => setPrices(data ?? []))
  }, [])

  const estimatedPrice = () => {
    const matching = prices.filter(p => p.service_type === serviceType)
    if (matching.length === 0) return 0
    const avg = matching.reduce((s, p) => s + p.price, 0) / matching.length
    return avg * itemsCount
  }

  async function handleSubmit() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('orders').insert({
      customer_id: profile.id,
      service_type: serviceType,
      items_count: itemsCount,
      total: estimatedPrice(),
      payment_method: paymentMethod,
      notes: notes || null,
      status: 'pending',
      payment_status: 'pending',
    })
    setSaving(false)
    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء الطلب')
    } else {
      Alert.alert('تم', 'تم إنشاء طلبك بنجاح! سيتم تعيين سائق قريباً', [
        { text: 'حسناً', onPress: () => router.replace('/(tabs)/orders') },
      ])
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>طلب جديد</Text>

      <Text style={s.sectionTitle}>نوع الخدمة</Text>
      <View style={s.grid}>
        {services.map(svc => (
          <TouchableOpacity key={svc.key} onPress={() => setServiceType(svc.key)}
            style={[s.optionCard, serviceType === svc.key && s.optionSelected]}>
            <Text style={s.optionIcon}>{svc.icon}</Text>
            <Text style={[s.optionLabel, serviceType === svc.key && s.optionLabelSelected]}>{svc.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>عدد القطع</Text>
      <View style={s.counterRow}>
        <TouchableOpacity style={s.counterBtn} onPress={() => setItemsCount(Math.max(1, itemsCount - 1))}>
          <Text style={s.counterText}>−</Text>
        </TouchableOpacity>
        <Text style={s.counterValue}>{itemsCount}</Text>
        <TouchableOpacity style={s.counterBtn} onPress={() => setItemsCount(itemsCount + 1)}>
          <Text style={s.counterText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>طريقة الدفع</Text>
      <View style={s.grid}>
        {paymentMethods.map(pm => (
          <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
            style={[s.optionCard, paymentMethod === pm.key && s.optionSelected]}>
            <Text style={s.optionIcon}>{pm.icon}</Text>
            <Text style={[s.optionLabel, paymentMethod === pm.key && s.optionLabelSelected]}>{pm.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>ملاحظات (اختياري)</Text>
      <TextInput style={s.notesInput} value={notes} onChangeText={setNotes}
        placeholder="أي تعليمات خاصة..." placeholderTextColor={colors.navy[400]}
        multiline numberOfLines={3} textAlignVertical="top" textAlign="right" />

      <View style={s.totalCard}>
        <Text style={s.totalLabel}>التكلفة التقديرية</Text>
        <Text style={s.totalValue}>{estimatedPrice().toFixed(2)} ج.م</Text>
      </View>

      <TouchableOpacity style={[s.submitBtn, saving && s.submitDisabled]} onPress={handleSubmit} disabled={saving}>
        <Text style={s.submitText}>{saving ? 'جاري الإرسال...' : 'تأكيد الطلب'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    width: '47%', backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.navy[700],
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  optionIcon: { fontSize: 28 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200] },
  optionLabelSelected: { color: colors.primary },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  counterBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy[800],
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  counterText: { fontSize: 24, color: '#fff', fontWeight: '600' },
  counterValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', minWidth: 48, textAlign: 'center' },
  notesInput: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: colors.navy[700], minHeight: 80,
  },
  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  totalLabel: { fontSize: 16, color: colors.navy[200] },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 20,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 18, fontWeight: '700', color: '#fff' },
})
