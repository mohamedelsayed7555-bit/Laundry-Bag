import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'

type Plan = {
  id: string
  name: string
  description: string
  tier: string
  items_per_month: number
  includes_all_services: boolean
  monthly_price: number
  quarterly_price: number
  biannual_price: number
  annual_price: number
}

type Subscription = {
  id: string
  plan_id: string
  duration: string
  status: string
  items_used: number
  items_limit: number
  start_date: string
  end_date: string
  auto_renew: boolean
  total_paid: number
  plan_name?: string
}

const durations = [
  { key: 'monthly', label: 'شهري', priceKey: 'monthly_price' as const },
  { key: 'quarterly', label: 'ربع سنوي', priceKey: 'quarterly_price' as const, save: '10%' },
  { key: 'biannual', label: 'نصف سنوي', priceKey: 'biannual_price' as const, save: '15%' },
  { key: 'annual', label: 'سنوي', priceKey: 'annual_price' as const, save: '20%' },
]

const tierColors: Record<string, string> = {
  individual: '#3b82f6',
  couple: '#8b5cf6',
  family: '#f59e0b',
  premium: '#ef4444',
}

const paymentMethods = [
  { key: 'cash', label: 'كاش 💵' },
  { key: 'instapay', label: 'إنستاباي 📱' },
  { key: 'wallet', label: 'محفظة 👛' },
]

export default function PlansScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [plans, setPlans] = useState<Plan[]>([])
  const [activeSub, setActiveSub] = useState<Subscription | null>(null)
  const [pendingSub, setPendingSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDuration, setSelectedDuration] = useState('monthly')
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    loadData()
  }, [profile])

  async function loadData() {
    const { data: plansData } = await supabase
      .from('plans')
      .select('id, name, items_limit, monthly_price, features, is_active')
      .eq('is_active', true)
      .order('monthly_price', { ascending: true })
    setPlans((plansData ?? []) as Plan[])

    if (profile) {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, plans(name)')
        .eq('user_id', profile.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
      if (subData) {
        const active = subData.find((s: any) => s.status === 'active')
        const pending = subData.find((s: any) => s.status === 'pending')
        if (active) setActiveSub({ ...active, plan_name: (active as any).plans?.name } as any)
        else setActiveSub(null)
        if (pending) setPendingSub({ ...pending, plan_name: (pending as any).plans?.name } as any)
        else setPendingSub(null)
      }
    }
    setLoading(false)
  }

  async function handleSubscribe(plan: Plan) {
    if (!profile) return
    if (activeSub) {
      showAlert({ title: 'تنبيه', message: 'لديك اشتراك نشط بالفعل', type: 'warning' })
      return
    }
    if (pendingSub) {
      showAlert({ title: 'تنبيه', message: 'لديك طلب اشتراك قيد المراجعة بالفعل', type: 'warning' })
      return
    }
    doSubscribe(plan)
  }

  async function doSubscribe(plan: Plan) {
    const dur = durations.find(d => d.key === selectedDuration)!
    const price = plan[dur.priceKey]

    showAlert({
      title: `اشتراك ${plan.name}`,
      message: `المدة: ${dur.label}\nالسعر: ${price} ج.م\n${plan.items_per_month} قطعة/شهر\n\nسيتم مراجعة طلبك وتفعيله من الإدارة بعد الدفع`,
      type: 'confirm',
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال طلب اشتراك',
          onPress: async () => {
            setSubscribing(true)

            const { error } = await supabase.from('subscriptions').insert({
              user_id: profile!.id,
              plan_id: plan.id,
              duration: selectedDuration,
              status: 'pending',
              items_used: 0,
              items_limit: plan.items_per_month,
              auto_renew: true,
              payment_method: 'cash',
              total_paid: price,
            })
            setSubscribing(false)
            if (error) {
              showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء إرسال الطلب', type: 'error' })
            } else {
              showAlert({ title: 'تم', message: 'تم إرسال طلب الاشتراك! سيتم تفعيله بعد مراجعة الإدارة والدفع', type: 'success', buttons: [{ text: 'حسناً', onPress: () => loadData() }] })
            }
          },
        },
      ],
    })
  }

  const durationObj = durations.find(d => d.key === selectedDuration)!

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={s.title}>الباقات</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Pending Subscription */}
      {pendingSub && (
        <View style={s.pendingSubCard}>
          <Text style={s.pendingSubBadge}>⏳ طلب اشتراك قيد المراجعة</Text>
          <Text style={s.pendingSubName}>{pendingSub.plan_name}</Text>
          <Text style={s.pendingSubHint}>سيتم تفعيل اشتراكك بعد مراجعة الإدارة وتأكيد الدفع</Text>
        </View>
      )}

      {/* Active Subscription */}
      {activeSub && (
        <View style={s.activeSubCard}>
          <View style={s.activeSubHeader}>
            <Text style={s.activeSubBadge}>اشتراك نشط ✓</Text>
          </View>
          <Text style={s.activeSubName}>{activeSub.plan_name}</Text>
          <View style={s.progressRow}>
            <Text style={s.progressLabel}>القطع المستخدمة</Text>
            <Text style={s.progressValue}>{activeSub.items_used} / {activeSub.items_limit}</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${Math.min(100, (activeSub.items_used / activeSub.items_limit) * 100)}%` }]} />
          </View>
          <View style={s.subDetailRow}>
            <Text style={s.subDetailLabel}>ينتهي في</Text>
            <Text style={s.subDetailValue}>{activeSub.end_date}</Text>
          </View>
          <View style={s.subDetailRow}>
            <Text style={s.subDetailLabel}>تجديد تلقائي</Text>
            <Text style={s.subDetailValue}>{activeSub.auto_renew ? 'نعم' : 'لا'}</Text>
          </View>
        </View>
      )}

      {/* Duration Selector - only show if no active subscription */}
      {!activeSub && (
        <>
          <Text style={s.sectionTitle}>اختر مدة الاشتراك</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.durScroll} contentContainerStyle={s.durRow}>
            {durations.map(d => (
              <TouchableOpacity
                key={d.key}
                style={[s.durChip, selectedDuration === d.key && s.durChipActive]}
                onPress={() => setSelectedDuration(d.key)}
              >
                <Text style={[s.durLabel, selectedDuration === d.key && s.durLabelActive]}>{d.label}</Text>
                {d.save && <Text style={s.durSave}>وفّر {d.save}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Plans - only show if no active subscription */}
      {!activeSub && plans.map(plan => {
        const price = plan[durationObj.priceKey]
        const tierColor = tierColors[plan.tier] ?? colors.primary
        const isCurrentPlan = activeSub?.plan_id === plan.id

        return (
          <View key={plan.id} style={[s.planCard, isCurrentPlan && { borderColor: colors.primary }]}>
            {isCurrentPlan && (
              <View style={s.currentBadge}><Text style={s.currentBadgeText}>باقتك الحالية</Text></View>
            )}
            <View style={[s.planTierDot, { backgroundColor: tierColor }]} />
            <Text style={s.planName}>{plan.name}</Text>
            <Text style={s.planDesc}>{plan.description}</Text>

            <View style={s.planPriceRow}>
              <Text style={s.planPrice}>{price}</Text>
              <Text style={s.planCurrency}> ج.م / {durationObj.label}</Text>
            </View>

            <View style={s.planFeatures}>
              <Text style={s.featureText}>📦 {plan.items_per_month} قطعة شهرياً</Text>
              {plan.includes_all_services && <Text style={s.featureText}>✨ جميع الخدمات متاحة</Text>}
              {plan.tier === 'premium' && <Text style={s.featureText}>⚡ أولوية في التوصيل</Text>}
            </View>

            <TouchableOpacity
              style={[s.subscribeBtn, isCurrentPlan && s.subscribeBtnDisabled]}
              onPress={() => handleSubscribe(plan)}
              disabled={isCurrentPlan || subscribing}
            >
              <Text style={s.subscribeBtnText}>
                {isCurrentPlan ? 'مشترك ✓' : subscribing ? 'جاري...' : 'اشترك الآن'}
              </Text>
            </TouchableOpacity>
          </View>
        )
      })}

      {activeSub && (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Text style={{ color: colors.navy[400], fontSize: 13, textAlign: 'center' }}>لديك اشتراك نشط. لتغيير الباقة تواصل مع الإدارة.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 8 },

  // Pending subscription
  pendingSubCard: {
    backgroundColor: '#f59e0b15', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#f59e0b40',
  },
  pendingSubBadge: { color: '#f59e0b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  pendingSubName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  pendingSubHint: { fontSize: 12, color: colors.navy[300] },

  // Active subscription
  activeSubCard: {
    backgroundColor: colors.primary + '15', borderRadius: 20, padding: 20, marginBottom: 24,
    borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  activeSubHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  activeSubBadge: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  activeSubName: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: colors.navy[200] },
  progressValue: { fontSize: 12, color: '#fff', fontWeight: '700' },
  progressBar: { height: 8, backgroundColor: colors.navy[700], borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  subDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subDetailLabel: { fontSize: 12, color: colors.navy[300] },
  subDetailValue: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Duration selector
  durScroll: { marginBottom: 20 },
  durRow: { gap: 8 },
  durChip: {
    backgroundColor: colors.navy[800], borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.navy[700], alignItems: 'center',
  },
  durChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  durLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200] },
  durLabelActive: { color: colors.primary },
  durSave: { fontSize: 10, color: colors.success, fontWeight: '700', marginTop: 2 },

  // Plan card
  planCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 22, marginBottom: 16,
    borderWidth: 1.5, borderColor: colors.navy[700], position: 'relative',
  },
  currentBadge: {
    position: 'absolute', top: -10, left: 20,
    backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 3,
  },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  planTierDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  planName: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  planDesc: { fontSize: 13, color: colors.navy[300], marginBottom: 16 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  planCurrency: { fontSize: 14, color: colors.navy[300] },
  planFeatures: { gap: 8, marginBottom: 20 },
  featureText: { fontSize: 13, color: colors.navy[100] },
  subscribeBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center',
  },
  subscribeBtnDisabled: { backgroundColor: colors.navy[600] },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
