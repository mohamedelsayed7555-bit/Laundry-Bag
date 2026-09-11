import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useTheme } from '../src/contexts/ThemeContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'

type Plan = {
  id: string
  name: string
  description: string
  tier: string
  items_per_month: number
  includes_all_services: boolean
  covered_services?: string[]
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
  { key: 'monthly', label: 'شهري', labelEn: 'Monthly', months: 1 },
  { key: 'quarterly', label: 'ربع سنوي', labelEn: 'Quarterly', months: 3 },
  { key: 'biannual', label: 'نصف سنوي', labelEn: 'Biannual', months: 6 },
  { key: 'annual', label: 'سنوي', labelEn: 'Annual', months: 12 },
]

const tierColors: Record<string, string> = {
  individual: '#3b82f6',
  couple: '#8b5cf6',
  family: '#f59e0b',
  premium: '#ef4444',
}

const paymentMethods = [
  { key: 'visa', icon: '💳', label: 'فيزا / ماستركارد', labelEn: 'Visa / Mastercard' },
  { key: 'wallet', icon: '📱', label: 'محفظة إلكترونية', labelEn: 'E-Wallet' },
  { key: 'instapay', icon: '🏦', label: 'إنستاباي', labelEn: 'InstaPay' },
]

export default function PlansScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const planName = (name: string) => locale === 'en' ? (t(`plan:${name}` as any) !== `plan:${name}` ? t(`plan:${name}` as any) : name) : name
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
  const [selectedPayment, setSelectedPayment] = useState('visa')
  const [walletPhone, setWalletPhone] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('all')
  const scrollRef = useRef<ScrollView>(null)
  const settingsY = useRef(0)

  useEffect(() => {
    loadData()
  }, [profile])

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  function calcPrice(monthlyPrice: number, durationKey: string) {
    const dur = durationsMeta.find(d => d.key === durationKey)!
    if (durationKey === 'monthly') return monthlyPrice
    const rate = discountRates[durationKey as keyof typeof discountRates] ?? 0
    return Math.round(monthlyPrice * dur.months * (1 - rate / 100))
  }

  async function loadData() {
    const results = await Promise.all([
      supabase.from('settings').select('key, value').in('key', ['discount_quarterly', 'discount_biannual', 'discount_annual']),
      supabase.from('plans')
        .select('id, name, description, tier, items_per_month, includes_all_services, covered_services, monthly_price, quarterly_price, biannual_price, annual_price, is_active')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true }),
      profile ? supabase.from('subscriptions').select('*, plans(name)')
        .eq('user_id', profile.id).in('status', ['active', 'pending'])
        .order('created_at', { ascending: false }) : null,
    ])

    const settingsData = results[0]?.data
    if (settingsData) {
      const rates = { ...discountRates }
      settingsData.forEach(s => {
        if (s.key === 'discount_quarterly') rates.quarterly = Number(s.value) || 10
        if (s.key === 'discount_biannual') rates.biannual = Number(s.value) || 15
        if (s.key === 'discount_annual') rates.annual = Number(s.value) || 20
      })
      setDiscountRates(rates)
    }

    setPlans((results[1]?.data ?? []) as Plan[])

    const subData = results[2]?.data
    if (subData) {
      const active = subData.find((s: any) => s.status === 'active')
      const pending = subData.find((s: any) => s.status === 'pending')
      if (active) setActiveSub({ ...active, plan_name: (active as any).plans?.name } as any)
      else setActiveSub(null)
      if (pending) setPendingSub({ ...pending, plan_name: (pending as any).plans?.name } as any)
      else setPendingSub(null)
    }
    setLoading(false)
  }

  async function handleCancelSub() {
    if (!activeSub) return
    showAlert({
      title: t('cancelSubscription') || 'إلغاء الاشتراك',
      message: locale === 'en'
        ? `Are you sure you want to cancel "${planName(activeSub.plan_name ?? '')}"?\n\n⚠️ Paid amount (${activeSub.total_paid} EGP) is non-refundable.`
        : `هل أنت متأكد من إلغاء اشتراك "${activeSub.plan_name}"?\n\n⚠️ لن يتم استرداد المبلغ المدفوع (${activeSub.total_paid} ج.م)`,
      type: 'confirm',
      buttons: [
        { text: locale === 'en' ? 'Cancel' : 'تراجع', style: 'cancel' },
        {
          text: locale === 'en' ? 'Yes, cancel subscription' : 'نعم، إلغاء الاشتراك',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false }).eq('id', activeSub.id)
            showAlert({ title: locale === 'en' ? 'Done' : 'تم', message: locale === 'en' ? 'Subscription cancelled. No refund.' : 'تم إلغاء اشتراكك. لن يتم استرداد المبلغ المدفوع.', type: 'info', buttons: [{ text: t('ok'), onPress: () => loadData() }] })
          },
        },
      ],
    })
  }

  async function handleSubscribe(plan: Plan) {
    if (!profile) return
    if (pendingSub) {
      showAlert({ title: locale === 'en' ? 'Notice' : 'تنبيه', message: locale === 'en' ? 'You already have a pending subscription' : 'لديك طلب اشتراك قيد المراجعة بالفعل', type: 'warning' })
      return
    }
    if (activeSub && activeSub.plan_id === plan.id) {
      showAlert({ title: locale === 'en' ? 'Notice' : 'تنبيه', message: locale === 'en' ? 'You are already subscribed to this plan' : 'أنت مشترك في هذه الباقة بالفعل', type: 'warning' })
      return
    }
    if (activeSub) {
      showAlert({
        title: locale === 'en' ? 'Upgrade plan' : 'ترقية الباقة',
        message: locale === 'en'
          ? `You are subscribed to "${planName(activeSub.plan_name ?? '')}". ⚠️ Paid amount (${activeSub.total_paid} EGP) is non-refundable.\n\nUpgrade to "${planName(plan.name)}"?`
          : `أنت مشترك حالياً في "${activeSub.plan_name}".\n\n⚠️ المبلغ المدفوع للباقة الحالية (${activeSub.total_paid} ج.م) لن يُسترد.\n\nهل تريد الترقية إلى "${plan.name}"؟`,
        type: 'confirm',
        buttons: [
          { text: locale === 'en' ? 'Cancel' : 'تراجع', style: 'cancel' },
          {
            text: locale === 'en' ? 'Yes, upgrade' : 'نعم، ترقية',
            onPress: async () => {
              await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false }).eq('id', activeSub.id)
              setActiveSub(null)
              doSubscribe(plan)
            },
          },
        ],
      })
      return
    }
    scrollRef.current?.scrollTo({ y: settingsY.current, animated: true })
    setTimeout(() => doSubscribe(plan), 500)
  }

  async function doSubscribe(plan: Plan) {
    if (selectedPayment === 'wallet' && !walletPhone.match(/^01[0-9]{9}$/)) {
      showAlert({ title: locale === 'en' ? 'Notice' : 'تنبيه', message: locale === 'en' ? 'Enter a valid wallet phone number (01xxxxxxxxx)' : 'أدخل رقم موبايل المحفظة بشكل صحيح (01xxxxxxxxx)', type: 'warning' })
      return
    }
    const dur = durationsMeta.find(d => d.key === selectedDuration)!
    const price = calcPrice(plan.monthly_price, selectedDuration)
    const durLabel = locale === 'en' ? dur.labelEn : dur.label

    showAlert({
      title: `${locale === 'en' ? 'Subscribe' : 'اشتراك'} ${planName(plan.name)}`,
      message: locale === 'en'
        ? `Duration: ${durLabel}\nPrice: ${price} EGP\n${plan.items_per_month} items/month\nPayment: ${paymentMethods.find(p => p.key === selectedPayment)?.labelEn}\nAuto-renew: ${autoRenew ? 'Yes' : 'No'}\n\n${selectedPayment === 'instapay' ? 'Your request will be reviewed after payment confirmation' : 'Your subscription will be activated automatically after payment'}`
        : `المدة: ${durLabel}\nالسعر: ${price} ج.م\n${plan.items_per_month} قطعة/شهر\nطريقة الدفع: ${paymentMethods.find(p => p.key === selectedPayment)?.label}\nتجديد تلقائي: ${autoRenew ? 'نعم' : 'لا'}\n\n${selectedPayment === 'instapay' ? 'سيتم مراجعة طلبك وتفعيله من الإدارة بعد تأكيد الدفع' : 'سيتم تفعيل اشتراكك تلقائياً بعد نجاح الدفع'}`,
      type: 'confirm',
      buttons: [
        { text: locale === 'en' ? 'Cancel' : 'إلغاء', style: 'cancel' },
        {
          text: locale === 'en' ? 'Send subscription request' : 'إرسال طلب اشتراك',
          onPress: async () => {
            setSubscribing(true)

            const { data: newSub, error } = await supabase.from('subscriptions').insert({
              user_id: profile!.id,
              plan_id: plan.id,
              duration: selectedDuration,
              status: 'pending',
              items_used: 0,
              items_limit: plan.items_per_month * durationObj.months,
              auto_renew: autoRenew,
              payment_method: selectedPayment,
              total_paid: price,
            }).select('id').single()

            if (error) {
              setSubscribing(false)
              showAlert({ title: locale === 'en' ? 'Error' : 'خطأ', message: locale === 'en' ? 'An error occurred' : 'حدث خطأ أثناء إرسال الطلب', type: 'error' })
              return
            }

            if (selectedPayment === 'visa' || selectedPayment === 'wallet') {
              const { data: payData, error: payError } = await supabase.functions.invoke('paymob-pay', {
                body: {
                  subscription_id: newSub.id,
                  payment_method: selectedPayment === 'visa' ? 'card' : 'wallet',
                  wallet_phone: selectedPayment === 'wallet' ? walletPhone : profile!.phone,
                },
              })
              setSubscribing(false)
              if (payError || payData?.error) {
                showAlert({ title: locale === 'en' ? 'Error' : 'خطأ', message: payData?.error || (locale === 'en' ? 'Payment failed' : 'فشل في بدء الدفع'), type: 'error' })
              } else if (payData?.iframe_url) {
                router.push({ pathname: '/payment', params: { url: payData.iframe_url } })
              }
            } else {
              setSubscribing(false)
              showAlert({ title: locale === 'en' ? 'Done' : 'تم', message: locale === 'en' ? 'Subscription request sent! It will be activated after admin confirms your payment.' : 'تم إرسال طلب الاشتراك! سيتم تفعيله بعد تأكيد الدفع من الإدارة.', type: 'success', buttons: [{ text: t('ok'), onPress: () => loadData() }] })
            }
          },
        },
      ],
    })
  }

  const durationObj = durationsMeta.find(d => d.key === selectedDuration)!
  const durLabel = locale === 'en' ? durationObj.labelEn : durationObj.label

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
    <ScrollView ref={scrollRef} style={[s.container, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.backText, { color: colors.primary }]}>→ {locale === 'en' ? 'Back' : 'رجوع'}</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>{t('subscriptionPlans')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {pendingSub && (
        <View style={[s.pendingSubCard, { borderColor: '#f59e0b40' }]}>
          <Text style={s.pendingSubBadge}>⏳ {locale === 'en' ? 'Pending subscription request' : 'طلب اشتراك قيد المراجعة'}</Text>
          <Text style={[s.pendingSubName, { color: colors.text }]}>{planName(pendingSub.plan_name ?? '')}</Text>
          <Text style={[s.pendingSubHint, { color: colors.navy[300] }]}>{locale === 'en' ? 'Will be activated after admin review and payment confirmation' : 'سيتم تفعيل اشتراكك بعد مراجعة الإدارة وتأكيد الدفع'}</Text>
        </View>
      )}

      {activeSub && (() => {
        const remaining = Math.max(0, activeSub.items_limit - activeSub.items_used)
        const exhausted = activeSub.items_used >= activeSub.items_limit
        const usagePercent = Math.min(100, (activeSub.items_used / activeSub.items_limit) * 100)
        return (
        <View style={[s.activeSubCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
          <View style={s.activeSubHeader}>
            <Text style={[s.activeSubBadge, { color: colors.primary }]}>{locale === 'en' ? 'Active subscription ✓' : 'اشتراك نشط ✓'}</Text>
          </View>
          <Text style={[s.activeSubName, { color: colors.text }]}>{planName(activeSub.plan_name ?? '')}</Text>

          {exhausted && (
            <View style={[s.exhaustedBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
              <Text style={[s.exhaustedText, { color: colors.danger }]}>
                {locale === 'en' ? '⚠️ Your plan items are used up! New orders will be at regular prices.' : '⚠️ رصيد باقتك خلص! الطلبات الجديدة هتكون بأسعار عادية.'}
              </Text>
            </View>
          )}

          <View style={s.progressRow}>
            <Text style={[s.progressLabel, { color: colors.navy[200] }]}>{locale === 'en' ? 'Items used' : 'القطع المستخدمة'}</Text>
            <Text style={[s.progressValue, { color: exhausted ? colors.danger : colors.text }]}>{activeSub.items_used} / {activeSub.items_limit}</Text>
          </View>
          <View style={s.progressRow}>
            <Text style={[s.progressLabel, { color: colors.navy[200] }]}>{locale === 'en' ? 'Remaining' : 'المتبقي'}</Text>
            <Text style={[s.progressValue, { color: exhausted ? colors.danger : colors.success }]}>{remaining} {locale === 'en' ? 'items' : 'قطعة'}</Text>
          </View>
          <View style={[s.progressBar, { backgroundColor: colors.navy[700] }]}>
            <View style={[s.progressFill, { backgroundColor: exhausted ? colors.danger : colors.primary, width: `${usagePercent}%` }]} />
          </View>
          <View style={s.subDetailRow}>
            <Text style={[s.subDetailLabel, { color: colors.navy[300] }]}>{locale === 'en' ? 'Expires' : 'ينتهي في'}</Text>
            <Text style={[s.subDetailValue, { color: colors.text }]}>{activeSub.end_date}</Text>
          </View>
          <TouchableOpacity style={s.subDetailRow} onPress={async () => {
            const newVal = !activeSub.auto_renew
            await supabase.from('subscriptions').update({ auto_renew: newVal }).eq('id', activeSub.id)
            setActiveSub({ ...activeSub, auto_renew: newVal })
          }}>
            <Text style={[s.subDetailLabel, { color: colors.navy[300] }]}>{locale === 'en' ? 'Auto-renew' : 'تجديد تلقائي'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.subDetailValue, { color: colors.text }]}>{activeSub.auto_renew ? (locale === 'en' ? 'On' : 'مفعّل') : (locale === 'en' ? 'Off' : 'متوقف')}</Text>
              <View style={[s.toggleTrackSmall, { backgroundColor: colors.navy[600] }, activeSub.auto_renew && { backgroundColor: colors.primary }]}>
                <View style={[s.toggleThumbSmall, activeSub.auto_renew && s.toggleThumbActiveSmall]} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.cancelSubBtn, { backgroundColor: colors.dangerGlow, borderColor: colors.danger + '30' }]} onPress={handleCancelSub}>
            <Text style={[s.cancelSubBtnText, { color: colors.danger }]}>{locale === 'en' ? 'Cancel subscription' : 'إلغاء الاشتراك'}</Text>
          </TouchableOpacity>
        </View>
        )
      })()}

      {/* ── Service Filter ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={s.filterRow}>
        {[
          { key: 'all', icon: '📋', label: 'الكل', labelEn: 'All' },
          { key: 'clothes', icon: '👔', label: 'ملابس', labelEn: 'Clothes' },
          { key: 'carpet', icon: '🧹', label: 'سجاد وبطاطين', labelEn: 'Carpets' },
          { key: 'tailor', icon: '✂️', label: 'تفصيل', labelEn: 'Tailoring' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, serviceFilter === f.key && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
            onPress={() => setServiceFilter(f.key)}
          >
            <Text style={s.filterIcon}>{f.icon}</Text>
            <Text style={[s.filterLabel, { color: colors.navy[300] }, serviceFilter === f.key && { color: colors.primary }]}>
              {locale === 'en' ? f.labelEn : f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Plans List ── */}
      <Text style={[s.sectionTitle, { color: colors.text }]}>{activeSub ? (locale === 'en' ? 'Upgrade or add plan' : 'ترقية أو إضافة باقة') : (locale === 'en' ? 'Available plans' : 'الباقات المتاحة')}</Text>

      {plans.filter(plan => {
        if (serviceFilter === 'all') return true
        if (plan.includes_all_services) return true
        const cs = plan.covered_services ?? []
        if (serviceFilter === 'clothes') return cs.some(s => ['wash', 'iron', 'wash_iron', 'dry_clean'].includes(s))
        if (serviceFilter === 'carpet') return cs.includes('carpet')
        if (serviceFilter === 'tailor') return cs.includes('tailor')
        return true
      }).map(plan => {
        const price = calcPrice(plan.monthly_price, selectedDuration)
        const tierColor = tierColors[plan.tier] ?? colors.primary
        const isCurrentPlan = activeSub?.plan_id === plan.id

        return (
          <View key={plan.id} style={[s.planCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, isCurrentPlan && { borderColor: colors.primary }]}>
            {isCurrentPlan && (
              <View style={[s.currentBadge, { backgroundColor: colors.primary }]}><Text style={s.currentBadgeText}>{locale === 'en' ? 'Current plan' : 'باقتك الحالية'}</Text></View>
            )}
            <View style={[s.planTierDot, { backgroundColor: tierColor }]} />
            <Text style={[s.planName, { color: colors.text }]}>{planName(plan.name)}</Text>
            <Text style={[s.planDesc, { color: colors.navy[300] }]}>{plan.description}</Text>

            <View style={s.planPriceRow}>
              <Text style={[s.planPrice, { color: colors.primary }]}>{price}</Text>
              <Text style={[s.planCurrency, { color: colors.navy[300] }]}> {t('currency')} / {durLabel}</Text>
            </View>

            <View style={s.planFeatures}>
              <Text style={[s.featureText, { color: colors.navy[100] }]}>📦 {plan.items_per_month} {locale === 'en' ? 'items/month' : 'قطعة شهرياً'}</Text>
              {plan.includes_all_services
                ? <Text style={[s.featureText, { color: colors.navy[100] }]}>✨ {locale === 'en' ? 'All services included' : 'جميع الخدمات متاحة'}</Text>
                : plan.covered_services && plan.covered_services.length > 0
                  ? <Text style={[s.featureText, { color: colors.navy[100] }]}>✅ {plan.covered_services.map((s: string) => ({ wash: 'غسيل', iron: 'كوي', wash_iron: 'غسيل وكوي', dry_clean: 'تنظيف جاف', tailor: 'تفصيل', carpet: 'سجاد' }[s] ?? s)).join(' • ')}</Text>
                  : null}
              {plan.tier === 'premium' && <Text style={[s.featureText, { color: colors.navy[100] }]}>⚡ {locale === 'en' ? 'Priority delivery' : 'أولوية في التوصيل'}</Text>}
            </View>

            <TouchableOpacity
              style={[s.subscribeBtn, { backgroundColor: colors.primary }, isCurrentPlan && { backgroundColor: colors.navy[600] }]}
              onPress={() => handleSubscribe(plan)}
              disabled={isCurrentPlan || subscribing}
            >
              <Text style={s.subscribeBtnText}>
                {isCurrentPlan ? (locale === 'en' ? 'Subscribed ✓' : 'مشترك ✓') : subscribing ? (locale === 'en' ? 'Loading...' : 'جاري...') : activeSub ? (locale === 'en' ? 'Upgrade' : 'ترقية') : (locale === 'en' ? 'Subscribe now' : 'اشترك الآن')}
              </Text>
            </TouchableOpacity>
          </View>
        )
      })}

      {/* ── Subscription Settings ── */}
      <View onLayout={e => { settingsY.current = e.nativeEvent.layout.y }} style={[s.settingsSection, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
        <Text style={[s.settingsSectionTitle, { color: colors.text }]}>⚙️ {locale === 'en' ? 'Subscription settings' : 'إعدادات الاشتراك'}</Text>

        {/* Duration */}
        <Text style={[s.settingsLabel, { color: colors.navy[300] }]}>{locale === 'en' ? 'Duration' : 'مدة الاشتراك'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={s.durRow}>
          {durationsMeta.map(d => {
            const rate = d.key !== 'monthly' ? discountRates[d.key as keyof typeof discountRates] : 0
            return (
              <TouchableOpacity
                key={d.key}
                style={[s.durChip, { backgroundColor: colors.navy[800], borderColor: colors.navy[600] }, selectedDuration === d.key && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                onPress={() => setSelectedDuration(d.key)}
              >
                <Text style={[s.durLabel, { color: colors.navy[200] }, selectedDuration === d.key && { color: colors.primary }]}>{locale === 'en' ? d.labelEn : d.label}</Text>
                {rate > 0 && <Text style={[s.durSave, { color: colors.success }]}>{locale === 'en' ? `Save ${rate}%` : `وفّر ${rate}%`}</Text>}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Payment */}
        <Text style={[s.settingsLabel, { color: colors.navy[300] }]}>{locale === 'en' ? 'Payment method' : 'طريقة الدفع'}</Text>
        <View style={s.paymentList}>
          {paymentMethods.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.paymentCard, { backgroundColor: colors.navy[800], borderColor: colors.navy[600] }, selectedPayment === p.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
              onPress={() => setSelectedPayment(p.key)}
            >
              <Text style={s.paymentIcon}>{p.icon}</Text>
              <Text style={[s.paymentLabel, { color: colors.navy[200] }, selectedPayment === p.key && { color: colors.text }]}>{locale === 'en' ? p.labelEn : p.label}</Text>
              {selectedPayment === p.key && (
                <View style={[s.paymentCheck, { backgroundColor: colors.primary }]}><Text style={s.paymentCheckText}>✓</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedPayment === 'wallet' && (
          <View style={[s.walletPhoneCard, { backgroundColor: colors.navy[800], borderColor: colors.primary + '30' }]}>
            <Text style={[s.walletPhoneLabel, { color: colors.text }]}>📱 {locale === 'en' ? 'Wallet phone number' : 'رقم موبايل المحفظة'}</Text>
            <TextInput
              style={[s.walletPhoneInput, { color: colors.text, borderColor: colors.navy[600], backgroundColor: colors.navy[700] }]}
              placeholder="01xxxxxxxxx"
              placeholderTextColor={colors.navy[400]}
              value={walletPhone}
              onChangeText={setWalletPhone}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>
        )}

        {/* Auto-renew */}
        <TouchableOpacity style={s.autoRenewInline} onPress={() => setAutoRenew(!autoRenew)} activeOpacity={0.7}>
          <View style={s.autoRenewInfo}>
            <Text style={[s.autoRenewLabel, { color: colors.text }]}>{locale === 'en' ? 'Auto-renew' : 'تجديد تلقائي'}</Text>
            <Text style={[s.autoRenewHint, { color: colors.navy[400] }]}>{locale === 'en' ? 'Renews when it ends' : 'تتجدد لما تخلص'}</Text>
          </View>
          <View style={[s.toggleTrack, { backgroundColor: colors.navy[600] }, autoRenew && { backgroundColor: colors.primary }]}>
            <View style={[s.toggleThumb, autoRenew && s.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },

  pendingSubCard: {
    backgroundColor: '#f59e0b15', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1.5,
  },
  pendingSubBadge: { color: '#f59e0b', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  pendingSubName: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  pendingSubHint: { fontSize: 12 },

  activeSubCard: {
    borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1.5,
  },
  activeSubHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  activeSubBadge: { fontSize: 12, fontWeight: '700' },
  activeSubName: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12 },
  progressValue: { fontSize: 12, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 4 },
  subDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subDetailLabel: { fontSize: 12 },
  subDetailValue: { fontSize: 12, fontWeight: '600' },

  filterRow: { gap: 8, paddingVertical: 4 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5,
  },
  filterIcon: { fontSize: 16 },
  filterLabel: { fontSize: 13, fontWeight: '600' },

  settingsSection: {
    borderRadius: 20, padding: 20, marginTop: 8, marginBottom: 8, borderWidth: 1,
  },
  settingsSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  settingsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  autoRenewInline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },

  durScroll: { marginBottom: 20 },
  durRow: { gap: 8 },
  durChip: {
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  durLabel: { fontSize: 13, fontWeight: '600' },
  durSave: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  planCard: {
    borderRadius: 20, padding: 22, marginBottom: 16,
    borderWidth: 1.5, position: 'relative',
  },
  currentBadge: {
    position: 'absolute', top: -10, left: 20,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 3,
  },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  planTierDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  planName: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  planDesc: { fontSize: 13, marginBottom: 16 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: 'bold' },
  planCurrency: { fontSize: 14 },
  planFeatures: { gap: 8, marginBottom: 20 },
  featureText: { fontSize: 13 },
  subscribeBtn: {
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  paymentList: { gap: 10, marginBottom: 16 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 12,
  },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  paymentCheck: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  paymentCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  walletPhoneCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  walletPhoneLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  walletPhoneInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, textAlign: 'center', fontWeight: '700', letterSpacing: 2 },
  autoRenewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1,
  },
  autoRenewInfo: { flex: 1 },
  autoRenewLabel: { fontSize: 14, fontWeight: '700' },
  autoRenewHint: { fontSize: 11, marginTop: 2 },
  toggleTrack: {
    width: 48, height: 28, borderRadius: 14,
    justifyContent: 'center', padding: 2,
  },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  toggleTrackSmall: {
    width: 36, height: 20, borderRadius: 10,
    justifyContent: 'center', padding: 2,
  },
  toggleThumbSmall: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
  },
  toggleThumbActiveSmall: { alignSelf: 'flex-end' },
  exhaustedBanner: {
    borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1,
  },
  exhaustedText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cancelSubBtn: {
    borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', marginTop: 10,
  },
  cancelSubBtnText: { fontSize: 14, fontWeight: '700' },
})
