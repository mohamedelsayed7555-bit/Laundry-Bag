import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
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

const durationsMeta = [
  { key: 'monthly', label: 'شهري', months: 1 },
  { key: 'quarterly', label: 'ربع سنوي', months: 3 },
  { key: 'biannual', label: 'نصف سنوي', months: 6 },
  { key: 'annual', label: 'سنوي', months: 12 },
]

const tierColors: Record<string, string> = {
  individual: '#3b82f6',
  couple: '#8b5cf6',
  family: '#f59e0b',
  premium: '#ef4444',
}

const paymentMethods = [
  { key: 'cash', icon: '💵', label: 'كاش' },
  { key: 'visa', icon: '💳', label: 'فيزا / ماستركارد' },
  { key: 'wallet', icon: '📱', label: 'محفظة إلكترونية' },
  { key: 'instapay', icon: '🏦', label: 'إنستاباي' },
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
  const [discountRates, setDiscountRates] = useState({ quarterly: 10, biannual: 15, annual: 20 })
  const [autoRenew, setAutoRenew] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState('cash')

  useEffect(() => {
    loadData()
  }, [profile])

  function calcPrice(monthlyPrice: number, durationKey: string) {
    const dur = durationsMeta.find(d => d.key === durationKey)!
    if (durationKey === 'monthly') return monthlyPrice
    const rate = discountRates[durationKey as keyof typeof discountRates] ?? 0
    return Math.round(monthlyPrice * dur.months * (1 - rate / 100))
  }

  async function loadData() {
    const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', ['discount_quarterly', 'discount_biannual', 'discount_annual'])
    if (settingsData) {
      const rates = { ...discountRates }
      settingsData.forEach(s => {
        if (s.key === 'discount_quarterly') rates.quarterly = Number(s.value) || 10
        if (s.key === 'discount_biannual') rates.biannual = Number(s.value) || 15
        if (s.key === 'discount_annual') rates.annual = Number(s.value) || 20
      })
      setDiscountRates(rates)
    }

    const { data: plansData } = await supabase
      .from('plans')
      .select('id, name, description, tier, items_per_month, includes_all_services, monthly_price, quarterly_price, biannual_price, annual_price, is_active')
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
    const dur = durationsMeta.find(d => d.key === selectedDuration)!
    const price = calcPrice(plan.monthly_price, selectedDuration)

    showAlert({
      title: `اشتراك ${plan.name}`,
      message: `المدة: ${dur.label}\nالسعر: ${price} ج.م\n${plan.items_per_month} قطعة/شهر\nطريقة الدفع: ${paymentMethods.find(p => p.key === selectedPayment)?.label}\nتجديد تلقائي: ${autoRenew ? 'نعم' : 'لا'}\n\nسيتم مراجعة طلبك وتفعيله من الإدارة بعد الدفع`,
      type: 'confirm',
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال طلب اشتراك',
          onPress: async () => {
            setSubscribing(true)

            const { data: newSub, error } = await supabase.from('subscriptions').insert({
              user_id: profile!.id,
              plan_id: plan.id,
              duration: selectedDuration,
              status: 'pending',
              items_used: 0,
              items_limit: plan.items_per_month,
              auto_renew: autoRenew,
              payment_method: selectedPayment,
              total_paid: price,
            }).select('id').single()

            if (error) {
              setSubscribing(false)
              showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء إرسال الطلب', type: 'error' })
              return
            }

            if (selectedPayment === 'visa' || selectedPayment === 'wallet') {
              const { data: payData, error: payError } = await supabase.functions.invoke('paymob-pay', {
                body: {
                  subscription_id: newSub.id,
                  payment_method: selectedPayment === 'visa' ? 'card' : 'wallet',
                  wallet_phone: profile!.phone,
                },
              })
              setSubscribing(false)
              if (payError || payData?.error) {
                showAlert({ title: 'خطأ', message: payData?.error || 'فشل في بدء الدفع', type: 'error' })
              } else if (payData?.iframe_url) {
                Linking.openURL(payData.iframe_url)
                showAlert({ title: 'الدفع', message: 'تم فتح صفحة الدفع. بعد الدفع الناجح سيتم تفعيل اشتراكك تلقائياً', type: 'info', buttons: [{ text: 'حسناً', onPress: () => loadData() }] })
              }
            } else {
              setSubscribing(false)
              showAlert({ title: 'تم', message: 'تم إرسال طلب الاشتراك! سيتم تفعيله بعد مراجعة الإدارة والدفع', type: 'success', buttons: [{ text: 'حسناً', onPress: () => loadData() }] })
            }
          },
        },
      ],
    })
  }

  const durationObj = durationsMeta.find(d => d.key === selectedDuration)!

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
          <TouchableOpacity style={s.subDetailRow} onPress={async () => {
            const newVal = !activeSub.auto_renew
            await supabase.from('subscriptions').update({ auto_renew: newVal }).eq('id', activeSub.id)
            setActiveSub({ ...activeSub, auto_renew: newVal })
          }}>
            <Text style={s.subDetailLabel}>تجديد تلقائي</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.subDetailValue}>{activeSub.auto_renew ? 'مفعّل' : 'متوقف'}</Text>
              <View style={[s.toggleTrackSmall, activeSub.auto_renew && s.toggleTrackActive]}>
                <View style={[s.toggleThumbSmall, activeSub.auto_renew && s.toggleThumbActiveSmall]} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Duration Selector - only show if no active subscription */}
      {!activeSub && (
        <>
          <Text style={s.sectionTitle}>اختر مدة الاشتراك</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.durScroll} contentContainerStyle={s.durRow}>
            {durationsMeta.map(d => {
              const rate = d.key !== 'monthly' ? discountRates[d.key as keyof typeof discountRates] : 0
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[s.durChip, selectedDuration === d.key && s.durChipActive]}
                  onPress={() => setSelectedDuration(d.key)}
                >
                  <Text style={[s.durLabel, selectedDuration === d.key && s.durLabelActive]}>{d.label}</Text>
                  {rate > 0 && <Text style={s.durSave}>وفّر {rate}%</Text>}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </>
      )}

      {/* Payment method selector */}
      {!activeSub && (
        <>
          <Text style={s.sectionTitle}>طريقة الدفع</Text>
          <View style={s.paymentList}>
            {paymentMethods.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[s.paymentCard, selectedPayment === p.key && s.paymentCardActive]}
                onPress={() => setSelectedPayment(p.key)}
              >
                <Text style={s.paymentIcon}>{p.icon}</Text>
                <Text style={[s.paymentLabel, selectedPayment === p.key && s.paymentLabelActive]}>{p.label}</Text>
                {selectedPayment === p.key && (
                  <View style={s.paymentCheck}><Text style={s.paymentCheckText}>✓</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Auto-renew toggle */}
      {!activeSub && (
        <TouchableOpacity style={s.autoRenewRow} onPress={() => setAutoRenew(!autoRenew)} activeOpacity={0.7}>
          <View style={s.autoRenewInfo}>
            <Text style={s.autoRenewLabel}>تجديد تلقائي</Text>
            <Text style={s.autoRenewHint}>الباقة تتجدد تلقائي لما تخلص</Text>
          </View>
          <View style={[s.toggleTrack, autoRenew && s.toggleTrackActive]}>
            <View style={[s.toggleThumb, autoRenew && s.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      )}

      {/* Plans - only show if no active subscription */}
      {!activeSub && plans.map(plan => {
        const price = calcPrice(plan.monthly_price, selectedDuration)
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

  paymentList: { gap: 10, marginBottom: 16 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: colors.navy[700], gap: 12,
  },
  paymentCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 14, fontWeight: '600', color: colors.navy[200], flex: 1 },
  paymentLabelActive: { color: '#fff' },
  paymentCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  paymentCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  autoRenewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  autoRenewInfo: { flex: 1 },
  autoRenewLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  autoRenewHint: { fontSize: 11, color: colors.navy[300], marginTop: 2 },
  toggleTrack: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: colors.navy[600],
    justifyContent: 'center', padding: 2,
  },
  toggleTrackActive: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  toggleTrackSmall: {
    width: 36, height: 20, borderRadius: 10, backgroundColor: colors.navy[600],
    justifyContent: 'center', padding: 2,
  },
  toggleThumbSmall: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
  },
  toggleThumbActiveSmall: { alignSelf: 'flex-end' },
})
