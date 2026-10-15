import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Dimensions, FlatList, Animated, Switch } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { User, Users, Home, Crown, Package, Sparkles, Check, Zap, CircleCheck, TriangleAlert, Hourglass, CreditCard, Wallet, Landmark, Smartphone, Settings2, RefreshCw } from 'lucide-react-native'
import { useBrand, Card, Chip, Pill, ChoiceGrid, IconButton, BackIcon, FlowLines, money, F, SIZE, type Choice } from '../src/components/brand'
import { PrimaryButton } from '../src/components/auth/ui'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { SkeletonPage } from '../src/components/Skeleton'
import { serverErrorMessage } from '../src/lib/serverErrors'

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
  payment_method?: string
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
  const { t, locale } = useLanguage()
  const planName = (name: string) => locale === 'en' ? (t(`plan:${name}` as any) !== `plan:${name}` ? t(`plan:${name}` as any) : name) : name
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const [plans, setPlans] = useState<Plan[]>([])
  const [activeSubs, setActiveSubs] = useState<(Subscription & { plan_name?: string })[]>([])
  const [pendingSubs, setPendingSubs] = useState<(Subscription & { plan_name?: string })[]>([])
  const [activeSubIdx, setActiveSubIdx] = useState(0)
  const scrollArrowAnim = useRef(new Animated.Value(0)).current
  const [loading, setLoading] = useState(true)
  const filterScrollRef = useRef<ScrollView>(null)
  const durScrollRef = useRef<ScrollView>(null)
  const [selectedDuration, setSelectedDuration] = useState('monthly')
  const [subscribing, setSubscribing] = useState(false)
  const [discountRates, setDiscountRates] = useState({ quarterly: 10, biannual: 15, annual: 20 })
  const [autoRenew, setAutoRenew] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState('visa')
  const [walletPhone, setWalletPhone] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('all')
  const [instapayNumber, setInstapayNumber] = useState('')
  const [selectedPlanForSubscribe, setSelectedPlanForSubscribe] = useState<Plan | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const settingsY = useRef(0)

  useEffect(() => {
    loadData()
  }, [profile])

  useEffect(() => {
    if (activeSubs.length > 1) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scrollArrowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(scrollArrowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    }
  }, [activeSubs.length])

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
      supabase.from('settings').select('key, value').in('key', ['discount_quarterly', 'discount_biannual', 'discount_annual', 'instapay_number']),
      supabase.from('plans')
        .select('id, name, description, tier, items_per_month, includes_all_services, covered_services, monthly_price, quarterly_price, biannual_price, annual_price, is_active')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true }),
      profile ? supabase.from('subscriptions').select('*, plans(name, covered_services, includes_all_services)')
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
        if (s.key === 'instapay_number') setInstapayNumber(String(s.value))
      })
      setDiscountRates(rates)
    }

    setPlans((results[1]?.data ?? []) as Plan[])

    const subData = results[2]?.data
    if (subData) {
      setActiveSubs(subData.filter((s: any) => s.status === 'active').map((s: any) => ({ ...s, plan_name: s.plans?.name })))
      setPendingSubs(subData.filter((s: any) => s.status === 'pending').map((s: any) => ({ ...s, plan_name: s.plans?.name })))
    } else {
      setActiveSubs([])
      setPendingSubs([])
    }
    setLoading(false)
  }

  async function handleCancelSub(sub: Subscription & { plan_name?: string }) {
    showAlert({
      title: t('cancelSubscription') || 'إلغاء الاشتراك',
      message: locale === 'en'
        ? `Are you sure you want to cancel "${planName(sub.plan_name ?? '')}"?\n\n⚠️ Paid amount (${sub.total_paid} EGP) is non-refundable.`
        : `هل أنت متأكد من إلغاء اشتراك "${sub.plan_name}"?\n\n⚠️ لن يتم استرداد المبلغ المدفوع (${sub.total_paid} ج.م)`,
      type: 'confirm',
      buttons: [
        { text: locale === 'en' ? 'Cancel' : 'تراجع', style: 'cancel' },
        {
          text: locale === 'en' ? 'Yes, cancel subscription' : 'نعم، إلغاء الاشتراك',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('subscriptions').update({ status: 'cancelled', auto_renew: false }).eq('id', sub.id)
            showAlert({ title: locale === 'en' ? 'Done' : 'تم', message: locale === 'en' ? 'Subscription cancelled. No refund.' : 'تم إلغاء اشتراكك. لن يتم استرداد المبلغ المدفوع.', type: 'info', buttons: [{ text: t('ok'), onPress: () => loadData() }] })
          },
        },
      ],
    })
  }

  async function handleSubscribe(plan: Plan) {
    if (!profile) return
    const pendingForPlan = pendingSubs.find(s => s.plan_id === plan.id)
    if (pendingForPlan) {
      showAlert({ title: locale === 'en' ? 'Notice' : 'تنبيه', message: locale === 'en' ? 'You already have a pending request for this plan' : 'لديك طلب اشتراك قيد المراجعة لهذه الباقة بالفعل', type: 'warning' })
      return
    }
    const activeForPlan = activeSubs.find(s => s.plan_id === plan.id)
    if (activeForPlan) {
      showAlert({ title: locale === 'en' ? 'Notice' : 'تنبيه', message: locale === 'en' ? 'You are already subscribed to this plan' : 'أنت مشترك في هذه الباقة بالفعل', type: 'warning' })
      return
    }
    setSelectedPlanForSubscribe(plan)
    scrollRef.current?.scrollTo({ y: settingsY.current, animated: true })
  }

  async function doSubscribe(plan: Plan, replacesSubId?: string) {
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
        ? `Duration: ${durLabel}\nPrice: ${price} EGP\n${plan.items_per_month} items/month\nPayment: ${paymentMethods.find(p => p.key === selectedPayment)?.labelEn}\nAuto-renew: ${autoRenew ? 'Yes' : 'No'}\n\n${selectedPayment === 'instapay' ? `Send ${price} EGP to InstaPay number:\n${instapayNumber}\n\nYour subscription will be activated after admin confirms payment.` : 'Your subscription will be activated automatically after payment'}`
        : `المدة: ${durLabel}\nالسعر: ${price} ج.م\n${plan.items_per_month} قطعة/شهر\nطريقة الدفع: ${paymentMethods.find(p => p.key === selectedPayment)?.label}\nتجديد تلقائي: ${autoRenew ? 'نعم' : 'لا'}\n\n${selectedPayment === 'instapay' ? `حوّل ${price} ج.م على رقم إنستاباي:\n${instapayNumber}\n\nسيتم تفعيل اشتراكك بعد تأكيد الدفع من الإدارة.` : 'سيتم تفعيل اشتراكك تلقائياً بعد نجاح الدفع'}`,
      type: 'confirm',
      buttons: [
        { text: locale === 'en' ? 'Cancel' : 'إلغاء', style: 'cancel' },
        {
          text: locale === 'en' ? 'Send subscription request' : 'إرسال طلب اشتراك',
          onPress: async () => {
            setSubscribing(true)

            // The server computes the plan price and item limit from the plan and current discounts.
            const { data: newSub, error } = await supabase.rpc('request_subscription', {
              p_plan_id: plan.id,
              p_duration: selectedDuration,
              p_payment_method: selectedPayment,
              p_auto_renew: autoRenew,
              // Upgrade: the server ends this plan only after the new one is activated (payment confirmed).
              ...(replacesSubId ? { p_replaces: replacesSubId } : {}),
            })

            if (error || !newSub) {
              setSubscribing(false)
              showAlert({ title: locale === 'en' ? 'Error' : 'خطأ', message: serverErrorMessage(error?.message, locale === 'en'), type: 'error' })
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
                router.push({ pathname: '/payment', params: { url: payData.iframe_url, kind: 'subscription' } })
              }
            } else {
              setSubscribing(false)
              showAlert({ title: locale === 'en' ? 'Done' : 'تم', message: selectedPayment === 'instapay' ? (locale === 'en' ? `Subscription request sent!\n\nPlease send ${price} EGP to InstaPay number:\n${instapayNumber}\n\nYour subscription will be activated after payment confirmation.` : `تم إرسال طلب الاشتراك!\n\nحوّل ${price} ج.م على رقم إنستاباي:\n${instapayNumber}\n\nسيتم تفعيل اشتراكك بعد تأكيد الدفع من الإدارة.`) : (locale === 'en' ? 'Subscription request sent! It will be activated after admin confirms your payment.' : 'تم إرسال طلب الاشتراك! سيتم تفعيله بعد تأكيد الدفع من الإدارة.'), type: 'success', buttons: [{ text: t('ok'), onPress: () => loadData() }] })
            }
          },
        },
      ],
    })
  }

  const durationObj = durationsMeta.find(d => d.key === selectedDuration)!
  const durLabel = locale === 'en' ? durationObj.labelEn : durationObj.label

  if (loading) {
    return <SkeletonPage />
  }

  const isEn = locale === 'en'
  const tierIcon = (tier: string, color: string) => {
    if (tier === 'couple') return <Users size={20} color={color} />
    if (tier === 'family') return <Home size={20} color={color} />
    if (tier === 'premium') return <Crown size={20} color={color} />
    return <User size={20} color={color} />
  }
  const payItems: Choice[] = paymentMethods.map(pm => {
    const c = selectedPayment === pm.key ? '#fff' : b.accentIcon
    return {
      key: pm.key,
      label: isEn ? pm.labelEn : pm.label,
      icon: pm.key === 'visa' ? <CreditCard size={15} color={c} /> : pm.key === 'wallet' ? <Wallet size={15} color={c} /> : <Landmark size={15} color={c} />,
    }
  })
  const serviceLabels: Record<string, string> = isEn
    ? { wash: 'Wash', iron: 'Iron', wash_iron: 'Wash & Iron', dry_clean: 'Dry Clean', housekeeping: 'House Keeping', carpet: 'Carpets' }
    : { wash: 'غسيل', iron: 'كوي', wash_iron: 'غسيل وكوي', dry_clean: 'تنظيف جاف', housekeeping: 'تنظيف منازل', carpet: 'سجاد' }

  return (
    <>
    <ScrollView ref={scrollRef} style={[s.container, { backgroundColor: b.page }]} contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} colors={[b.primary]} />}>
      <FlowLines height={280} />
      <View style={s.headerRow}>
        <IconButton onPress={() => router.back()} label={t('back')}>
          <BackIcon color={b.ink} />
        </IconButton>
        <Text style={[s.title, { color: b.ink }]} numberOfLines={1}>{t('subscriptionPlans')}</Text>
      </View>

      {pendingSubs.map(ps => (
        <View key={ps.id} style={[s.pendingSubCard, { backgroundColor: b.warnTint, borderColor: b.isDark ? 'rgba(245,158,11,0.3)' : '#F7DFA6' }]}>
          <View style={s.pendingHead}>
            <Hourglass size={15} color={b.isDark ? '#FBBF24' : '#B45309'} />
            <Text style={[s.pendingSubBadge, { color: b.isDark ? '#FBBF24' : '#B45309' }]}>{isEn ? 'Pending subscription request' : 'طلب اشتراك قيد المراجعة'}</Text>
          </View>
          <Text style={[s.pendingSubName, { color: b.ink }]}>{planName(ps.plan_name ?? '')}</Text>
          <Text style={[s.pendingSubHint, { color: b.warnText }]}>{isEn ? 'Will be activated after admin review and payment confirmation' : 'سيتم تفعيل اشتراكك بعد مراجعة الإدارة وتأكيد الدفع'}</Text>
          <View style={s.pendingActions}>
            {(ps.payment_method === 'visa' || ps.payment_method === 'wallet') && (
              <TouchableOpacity
                style={[s.smallBtn, { borderColor: b.tintBorder, backgroundColor: b.tint }]}
                disabled={subscribing}
                onPress={async () => {
                  setSubscribing(true)
                  const { data: payData, error: payError } = await supabase.functions.invoke('paymob-pay', {
                    body: {
                      subscription_id: ps.id,
                      payment_method: ps.payment_method === 'visa' ? 'card' : 'wallet',
                      wallet_phone: ps.payment_method === 'wallet' ? profile!.phone : profile!.phone,
                    },
                  })
                  setSubscribing(false)
                  if (payError || payData?.error) {
                    showAlert({ title: isEn ? 'Error' : 'خطأ', message: payData?.error || (isEn ? 'Payment failed' : 'فشل في بدء الدفع'), type: 'error' })
                  } else if (payData?.iframe_url) {
                    router.push({ pathname: '/payment', params: { url: payData.iframe_url, kind: 'subscription' } })
                  }
                }}
              >
                <Text style={[s.smallBtnText, { color: b.tintText }]}>{isEn ? 'Retry payment' : 'إعادة الدفع'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.smallBtn, { borderColor: b.dangerBorder, backgroundColor: b.dangerTint }]}
              onPress={() => {
                showAlert({
                  title: isEn ? 'Cancel request' : 'إلغاء الطلب',
                  message: isEn ? `Cancel your pending request for "${planName(ps.plan_name ?? '')}"?` : `هل تريد إلغاء طلب الاشتراك في "${ps.plan_name}"؟`,
                  type: 'confirm',
                  buttons: [
                    { text: isEn ? 'No' : 'لا', style: 'cancel' },
                    {
                      text: isEn ? 'Yes, cancel' : 'نعم، إلغاء',
                      style: 'destructive',
                      onPress: async () => {
                        await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', ps.id)
                        setPendingSubs(prev => prev.filter(p => p.id !== ps.id))
                        showAlert({ title: isEn ? 'Done' : 'تم', message: isEn ? 'Request cancelled' : 'تم إلغاء الطلب', type: 'success' })
                      },
                    },
                  ],
                })
              }}
            >
              <Text style={[s.smallBtnText, { color: b.dangerText }]}>{isEn ? 'Cancel request' : 'إلغاء الطلب'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {activeSubs.length > 0 && (() => {
        const cardWidth = Dimensions.get('window').width - 32
        const renderSubCard = (sub: typeof activeSubs[0]) => {
          const remaining = Math.max(0, sub.items_limit - sub.items_used)
          const exhausted = sub.items_used >= sub.items_limit
          const usagePercent = Math.min(100, (sub.items_used / sub.items_limit) * 100)
          return (
          <View style={[s.activeSubCard, { borderColor: b.tintBorder, width: cardWidth }]}>
            <LinearGradient colors={b.isDark ? ['rgba(17,36,69,0.92)', 'rgba(15,26,46,0.97)'] : ['#E6F3FD', '#FFFFFF']} style={StyleSheet.absoluteFill} />
            <View style={s.activeSubHeader}>
              <Text style={[s.activeSubName, { color: b.ink }]} numberOfLines={1}>{planName(sub.plan_name ?? '')}</Text>
              <Pill tone="ok" label={isEn ? 'Active subscription' : 'اشتراك نشط'} icon={<CircleCheck size={12} color={b.okText} />} />
            </View>

            {exhausted && (
              <View style={[s.exhaustedBanner, { backgroundColor: b.dangerTint, borderColor: b.dangerBorder }]}>
                <TriangleAlert size={15} color={b.dangerText} />
                <Text style={[s.exhaustedText, { color: b.dangerText }]}>
                  {isEn ? 'Your plan items are used up! New orders will be at regular prices.' : 'رصيد باقتك خلص! الطلبات الجديدة هتكون بأسعار عادية.'}
                </Text>
              </View>
            )}

            <View style={s.progressRow}>
              <Text style={[s.progressLabel, { color: b.muted }]}>{isEn ? 'Items used' : 'القطع المستخدمة'}</Text>
              <Text style={[s.progressValue, { color: exhausted ? b.dangerText : b.ink }]}>{sub.items_used} / {sub.items_limit}</Text>
            </View>
            <View style={[s.progressBar, { backgroundColor: b.isDark ? '#1E2B44' : '#DCEAF7' }]}>
              <View style={[s.progressFill, { backgroundColor: exhausted ? b.dangerText : b.primary, width: `${usagePercent}%` }]} />
            </View>
            <View style={s.progressRow}>
              <Text style={[s.progressLabel, { color: b.muted }]}>{isEn ? 'Remaining' : 'المتبقي'}</Text>
              <Text style={[s.progressValue, { color: exhausted ? b.dangerText : b.okText }]}>{remaining} {isEn ? 'items' : 'قطعة'}</Text>
            </View>
            <View style={[s.subDivider, { backgroundColor: b.isDark ? 'rgba(56,189,248,0.18)' : '#DCEAF7' }]} />
            <View style={s.subDetailRow}>
              <Text style={[s.subDetailLabel, { color: b.muted }]}>{isEn ? 'Expires' : 'ينتهي في'}</Text>
              <Text style={[s.subDetailValue, { color: b.ink }]}>{sub.end_date}</Text>
            </View>
            <View style={s.subDetailRow}>
              <Text style={[s.subDetailLabel, { color: b.muted }]}>{isEn ? 'Auto-renew' : 'تجديد تلقائي'}</Text>
              <Switch
                value={!!sub.auto_renew}
                onValueChange={async () => {
                  const newVal = !sub.auto_renew
                  await supabase.from('subscriptions').update({ auto_renew: newVal }).eq('id', sub.id)
                  setActiveSubs(prev => prev.map(s => s.id === sub.id ? { ...s, auto_renew: newVal } : s))
                }}
                trackColor={{ false: b.isDark ? '#2A3852' : '#D5DEEA', true: b.primary }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={[s.cancelSubBtn, { backgroundColor: b.dangerTint, borderColor: b.dangerBorder }]} onPress={() => handleCancelSub(sub)} accessibilityRole="button">
              <Text style={[s.cancelSubBtnText, { color: b.dangerText }]}>{isEn ? 'Cancel subscription' : 'إلغاء الاشتراك'}</Text>
            </TouchableOpacity>
          </View>
          )
        }

        if (activeSubs.length === 1) return <View style={{ marginBottom: 18 }}>{renderSubCard(activeSubs[0])}</View>

        return (
          <View style={{ marginBottom: 18 }}>
            <FlatList
              data={activeSubs}
              horizontal
              nestedScrollEnabled={true}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id}
              snapToInterval={cardWidth + 12}
              decelerationRate="fast"
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => renderSubCard(item)}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12))
                setActiveSubIdx(idx)
              }}
              scrollEventThrottle={16}
            />
            {activeSubIdx < activeSubs.length - 1 && (
              <Animated.View style={[s.scrollArrow, isEn ? { right: 2 } : { left: 2 }, {
                opacity: scrollArrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateX: scrollArrowAnim.interpolate({ inputRange: [0, 1], outputRange: isEn ? [0, 6] : [0, -6] }) }],
              }]}>
                <Text style={[s.scrollArrowText, { color: b.primary }]}>{isEn ? '›' : '‹'}</Text>
              </Animated.View>
            )}
            <View style={s.dotsRow}>
              {activeSubs.map((_, i) => (
                <View key={i} style={[s.dot, { backgroundColor: i === activeSubIdx ? b.primary : (b.isDark ? '#2A3852' : '#D5DEEA') }, i === activeSubIdx && { width: 18 }]} />
              ))}
            </View>
          </View>
        )
      })()}

      {/* ── Service Filter ── */}
      <ScrollView horizontal nestedScrollEnabled={true} showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, flexGrow: 0 }} contentContainerStyle={s.filterRow}
        ref={filterScrollRef}
      >
        {[
          { key: 'all', label: 'الكل', labelEn: 'All' },
          { key: 'clothes', label: 'ملابس', labelEn: 'Clothes' },
          { key: 'carpet', label: 'سجاد وبطاطين', labelEn: 'Carpets' },
          { key: 'housekeeping', label: 'تنظيف منازل', labelEn: 'House Keeping' },
        ].map(f => (
          <Chip key={f.key} label={isEn ? f.labelEn : f.label} active={serviceFilter === f.key} onPress={() => setServiceFilter(f.key)} />
        ))}
      </ScrollView>

      {/* ── Duration (drives the prices below) ── */}
      <Text style={[s.sectionTitle, { color: b.ink }]}>{isEn ? 'Duration' : 'مدة الاشتراك'}</Text>
      <ScrollView horizontal nestedScrollEnabled={true} showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={s.durRow}
        ref={durScrollRef}
      >
        {durationsMeta.map(d => {
          const rate = d.key !== 'monthly' ? discountRates[d.key as keyof typeof discountRates] : 0
          const on = selectedDuration === d.key
          return (
            <TouchableOpacity
              key={d.key}
              style={[s.durChip, { backgroundColor: b.card, borderColor: b.cardBorder }, on && { borderColor: b.primary, backgroundColor: b.tint }]}
              onPress={() => setSelectedDuration(d.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.durLabel, { color: on ? b.tintText : b.ink2 }]}>{isEn ? d.labelEn : d.label}</Text>
              {rate > 0 && <Text style={[s.durSave, { color: b.okText }]}>{isEn ? `Save ${rate}%` : `وفّر ${rate}%`}</Text>}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Plans List ── */}
      <Text style={[s.sectionTitle, { color: b.ink }]}>{activeSubs.length > 0 ? (isEn ? 'Upgrade or add plan' : 'ترقية أو إضافة باقة') : (isEn ? 'Available plans' : 'الباقات المتاحة')}</Text>

      {plans.filter(plan => {
        if (serviceFilter === 'all') return true
        if (plan.includes_all_services) return true
        const cs = plan.covered_services ?? []
        if (serviceFilter === 'clothes') return cs.some(s => ['wash', 'iron', 'wash_iron', 'dry_clean'].includes(s))
        if (serviceFilter === 'carpet') return cs.includes('carpet')
        if (serviceFilter === 'housekeeping') return cs.includes('housekeeping')
        return true
      }).map(plan => {
        const price = calcPrice(plan.monthly_price, selectedDuration)
        const fullPrice = plan.monthly_price * durationObj.months
        const tierColor = tierColors[plan.tier] ?? b.primary
        const isCurrentPlan = activeSubs.some(s => s.plan_id === plan.id)
        const pCovered = plan.covered_services ?? []
        const sameTypeSub = activeSubs.find(s => {
          if (s.plan_id === plan.id) return false
          const sPlan = (s as any).plans ?? {}
          if (sPlan.includes_all_services || plan.includes_all_services) return true
          const sCovered = sPlan.covered_services ?? []
          return pCovered.length > 0 && sCovered.some((sv: string) => pCovered.includes(sv))
        })
        const selected = selectedPlanForSubscribe?.id === plan.id

        return (
          <Card key={plan.id} style={[s.planCard, (isCurrentPlan || selected) && { borderColor: b.primary, borderWidth: 1.5 }]}>
            <View style={s.planHead}>
              <View style={[s.tierIcon, { backgroundColor: tierColor + '1F' }]}>{tierIcon(plan.tier, tierColor)}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.planName, { color: b.ink }]} numberOfLines={1}>{planName(plan.name)}</Text>
                {plan.description ? (
                  <Text style={[s.planDesc, { color: b.muted }]} numberOfLines={2}>{isEn ? (t(`desc:${plan.description}` as any) !== `desc:${plan.description}` ? t(`desc:${plan.description}` as any) : plan.description) : plan.description}</Text>
                ) : null}
              </View>
              {isCurrentPlan && <Pill tone="info" label={isEn ? 'Current plan' : 'باقتك الحالية'} />}
            </View>

            <View style={s.planPriceRow}>
              <Text style={[s.planPrice, { color: b.ink }]}>{money(price)}</Text>
              <Text style={[s.planCurrency, { color: b.muted }]}>{t('currency')} / {durLabel}</Text>
              {fullPrice > price && <Text style={[s.planStrike, { color: b.faint }]}>{money(fullPrice)}</Text>}
            </View>

            <View style={s.planFeatures}>
              <View style={[s.feature, { backgroundColor: b.iconTile }]}>
                <Package size={13} color={b.accentIcon} />
                <Text style={[s.featureText, { color: b.ink2 }]}>{plan.items_per_month} {isEn ? 'items/month' : 'قطعة شهرياً'}</Text>
              </View>
              {plan.includes_all_services ? (
                <View style={[s.feature, { backgroundColor: b.iconTile }]}>
                  <Sparkles size={13} color={b.accentIcon} />
                  <Text style={[s.featureText, { color: b.ink2 }]}>{isEn ? 'All services included' : 'جميع الخدمات متاحة'}</Text>
                </View>
              ) : pCovered.map(sv => (
                <View key={sv} style={[s.feature, { backgroundColor: b.iconTile }]}>
                  <Check size={13} color={b.accentIcon} />
                  <Text style={[s.featureText, { color: b.ink2 }]}>{serviceLabels[sv] ?? sv}</Text>
                </View>
              ))}
              {plan.tier === 'premium' && (
                <View style={[s.feature, { backgroundColor: b.iconTile }]}>
                  <Zap size={13} color={b.accentIcon} />
                  <Text style={[s.featureText, { color: b.ink2 }]}>{isEn ? 'Priority delivery' : 'أولوية في التوصيل'}</Text>
                </View>
              )}
            </View>

            {isCurrentPlan ? (
              <View style={[s.subscribedBtn, { backgroundColor: b.okTint }]}>
                <CircleCheck size={16} color={b.okText} />
                <Text style={[s.subscribedText, { color: b.okText }]}>{isEn ? 'Subscribed' : 'مشترك'}</Text>
              </View>
            ) : (
              <PrimaryButton
                title={sameTypeSub ? (isEn ? 'Upgrade' : 'ترقية') : (isEn ? 'Subscribe now' : 'اشترك الآن')}
                loadingTitle={isEn ? 'Loading...' : 'جاري...'}
                loading={subscribing}
                onPress={() => handleSubscribe(plan)}
              />
            )}
          </Card>
        )
      })}

      {/* ── Subscription Settings ── */}
      <View onLayout={e => { settingsY.current = e.nativeEvent.layout.y }}>
        <Card style={s.settingsSection}>
          <View style={s.settingsHead}>
            <View style={[s.settingsIcon, { backgroundColor: b.tint }]}><Settings2 size={15} color={b.tintText} /></View>
            <Text style={[s.settingsSectionTitle, { color: b.ink }]}>{isEn ? 'Subscription settings' : 'إعدادات الاشتراك'}</Text>
          </View>

          <Text style={[s.settingsLabel, { color: b.muted }]}>{isEn ? 'Payment method' : 'طريقة الدفع'}</Text>
          <ChoiceGrid items={payItems} value={selectedPayment} onChange={setSelectedPayment} />

          {selectedPayment === 'wallet' && (
            <View style={{ marginTop: 12 }}>
              <Text style={[s.settingsLabel, { color: b.muted }]}>{isEn ? 'Wallet phone number' : 'رقم موبايل المحفظة'}</Text>
              <View style={[s.field, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
                <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Smartphone size={15} color={b.accentIcon} /></View>
                <TextInput
                  style={[s.fieldInput, { color: b.ink }]}
                  placeholder="01xxxxxxxxx"
                  placeholderTextColor={b.faint}
                  value={walletPhone}
                  onChangeText={setWalletPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  textAlign="left"
                />
              </View>
            </View>
          )}

          <View style={[s.autoRenewInline, { borderTopColor: b.divider }]}>
            <View style={[s.settingsIcon, { backgroundColor: b.iconTile }]}><RefreshCw size={15} color={b.accentIcon} /></View>
            <View style={s.autoRenewInfo}>
              <Text style={[s.autoRenewLabel, { color: b.ink }]}>{isEn ? 'Auto-renew' : 'تجديد تلقائي'}</Text>
              <Text style={[s.autoRenewHint, { color: b.faint }]}>{isEn ? 'Renews when it ends' : 'تتجدد لما تخلص'}</Text>
            </View>
            <Switch
              value={autoRenew}
              onValueChange={setAutoRenew}
              trackColor={{ false: b.isDark ? '#2A3852' : '#D5DEEA', true: b.primary }}
              thumbColor="#fff"
            />
          </View>

          {selectedPlanForSubscribe && (
            <View style={{ marginTop: 14 }}>
              <Text style={[s.selectedHint, { color: b.muted }]}>
                {isEn ? `Selected plan: ${planName(selectedPlanForSubscribe.name)}` : `الباقة المختارة: ${selectedPlanForSubscribe.name}`}
              </Text>
              <PrimaryButton
                title={isEn ? 'Confirm subscription' : 'تأكيد الاشتراك'}
                loadingTitle={isEn ? 'Loading...' : 'جاري...'}
                loading={subscribing}
                onPress={() => {
                  const pCovered = selectedPlanForSubscribe.covered_services ?? []
                  const overlappingSub = activeSubs.find(s => {
                    if (s.plan_id === selectedPlanForSubscribe.id) return false
                    const sPlan = (s as any).plans ?? {}
                    if (sPlan.includes_all_services || selectedPlanForSubscribe.includes_all_services) return true
                    const sCovered = sPlan.covered_services ?? []
                    return pCovered.length > 0 && sCovered.some((sv: string) => pCovered.includes(sv))
                  })
                  if (overlappingSub) {
                    showAlert({
                      title: isEn ? 'Upgrade plan' : 'ترقية الباقة',
                      message: isEn
                        ? `You are subscribed to "${planName(overlappingSub.plan_name ?? '')}". ⚠️ Paid amount (${overlappingSub.total_paid} EGP) is non-refundable.\n\nUpgrade to "${planName(selectedPlanForSubscribe.name)}"?`
                        : `أنت مشترك حالياً في "${overlappingSub.plan_name}".\n\n⚠️ المبلغ المدفوع للباقة الحالية (${overlappingSub.total_paid} ج.م) لن يُسترد.\n\nهل تريد الترقية إلى "${selectedPlanForSubscribe.name}"؟`,
                      type: 'confirm',
                      buttons: [
                        { text: isEn ? 'Cancel' : 'تراجع', style: 'cancel' },
                        {
                          text: isEn ? 'Yes, upgrade' : 'نعم، ترقية',
                          onPress: () => {
                            doSubscribe(selectedPlanForSubscribe, overlappingSub.id)
                          },
                        },
                      ],
                    })
                  } else {
                    doSubscribe(selectedPlanForSubscribe)
                  }
                }}
              />
            </View>
          )}
        </Card>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { flex: 1, fontSize: 18, fontFamily: F.display },
  sectionTitle: { fontSize: 15, fontFamily: F.bold, marginBottom: 10 },

  pendingSubCard: { borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1 },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pendingSubBadge: { fontSize: 12.5, fontFamily: F.bold },
  pendingSubName: { fontSize: 17, fontFamily: F.display, marginBottom: 4 },
  pendingSubHint: { fontSize: 12, fontFamily: F.regular },
  pendingActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { flex: 1, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontFamily: F.bold },

  activeSubCard: { borderRadius: 20, padding: 16, borderWidth: 1, overflow: 'hidden' },
  activeSubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  activeSubName: { flex: 1, fontSize: 19, fontFamily: F.display },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontFamily: F.regular },
  progressValue: { fontSize: 12.5, fontFamily: F.bold },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  subDivider: { height: 1, marginVertical: 8 },
  subDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  subDetailLabel: { fontSize: 12.5, fontFamily: F.regular },
  subDetailValue: { fontSize: 12.5, fontFamily: F.semibold },

  filterRow: { gap: 8, paddingVertical: 2 },

  durRow: { gap: 8 },
  durChip: { minHeight: SIZE.M + 4, borderRadius: SIZE.rM, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, alignItems: 'center' },
  durLabel: { fontSize: 13, fontFamily: F.bold },
  durSave: { fontSize: 10.5, fontFamily: F.bold, marginTop: 1 },

  planCard: { marginBottom: 12, padding: 14 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 16, fontFamily: F.display },
  planDesc: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 12, marginBottom: 10 },
  planPrice: { fontSize: 28, fontFamily: F.display },
  planCurrency: { fontSize: 12.5, fontFamily: F.medium },
  planStrike: { fontSize: 13, fontFamily: F.medium, textDecorationLine: 'line-through', marginStart: 4 },
  planFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 5, height: SIZE.S - 2, paddingHorizontal: 10, borderRadius: 14 },
  featureText: { fontSize: 11.5, fontFamily: F.semibold },
  subscribedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.L, borderRadius: SIZE.rL },
  subscribedText: { fontSize: 14, fontFamily: F.bold },

  settingsSection: { marginTop: 6, padding: 14 },
  settingsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  settingsIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settingsSectionTitle: { fontSize: 15, fontFamily: F.bold },
  settingsLabel: { fontSize: 12, fontFamily: F.semibold, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, height: SIZE.L, borderRadius: SIZE.rL, borderWidth: 1, paddingHorizontal: 8 },
  fieldIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 15, fontFamily: F.semibold, letterSpacing: 1, paddingVertical: 0 },
  autoRenewInline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  autoRenewInfo: { flex: 1 },
  autoRenewLabel: { fontSize: 13.5, fontFamily: F.bold },
  autoRenewHint: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  selectedHint: { fontSize: 12, fontFamily: F.medium, textAlign: 'center', marginBottom: 8 },

  exhaustedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1 },
  exhaustedText: { flex: 1, fontSize: 12.5, fontFamily: F.semibold },
  cancelSubBtn: { borderWidth: 1, borderRadius: SIZE.rM, height: SIZE.M, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelSubBtnText: { fontSize: 13.5, fontFamily: F.bold },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  scrollArrow: { position: 'absolute', top: 80, zIndex: 10 },
  scrollArrowText: { fontSize: 28, fontWeight: '900' },
})
