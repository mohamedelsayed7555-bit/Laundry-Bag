import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, AppState, Image, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeOrders } from '../../src/hooks/useRealtimeOrders'
import { SkeletonOrderCard } from '../../src/components/Skeleton'
import {
  Phone, MessageCircle, Clock, Hourglass, Car, MapPin, Package, RefreshCw, CircleCheck, Bike, CircleX, Coins,
} from 'lucide-react-native'
import { useBrand, Card, Divider, Segments, Segmented, Chip, Pill, IconButton, FlowLines, F, money, shortDate, type Brand } from '../../src/components/brand'
import { PrimaryButton } from '../../src/components/auth/ui'

const statusFlow = ['pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

const statusIcons: Record<string, typeof Clock> = {
  scheduled: Clock, pending: Hourglass, assigned: Car, arrived: MapPin, picked_up: Package, processing: RefreshCw,
  ready: CircleCheck, delivering: Bike, delivered: CircleCheck, cancelled: CircleX, refunded: Coins,
}

const serviceImages: Record<string, any> = {
  wash: require('../../assets/services/wash.webp'),
  dry_clean: require('../../assets/services/dry.webp'),
  iron: require('../../assets/services/iron.webp'),
  wash_iron: require('../../assets/services/washiron.webp'),
  housekeeping: require('../../assets/services/home.webp'),
  carpet: require('../../assets/services/carpet.webp'),
  accessories: require('../../assets/services/shop.webp'),
}

type Tone = 'info' | 'ok' | 'warn' | 'danger'
function statusTone(status: string): Tone {
  if (status === 'delivered') return 'ok'
  if (status === 'cancelled') return 'danger'
  if (status === 'refunded') return 'warn'
  return 'info'
}
function toneColor(b: Brand, tone: Tone) {
  if (tone === 'ok') return b.okText
  if (tone === 'danger') return b.dangerText
  if (tone === 'warn') return b.isDark ? '#FBBF24' : '#B45309'
  return b.tintText
}

function OrderProgress({ status, b }: { status: string; b: Brand }) {
  if (status === 'cancelled' || status === 'delivered') return null
  const idx = statusFlow.indexOf(status)
  if (idx < 0) return null

  return (
    <View style={prog.container}>
      <Segments total={statusFlow.length} done={idx + 1} />
      <Text style={[prog.label, { color: b.accentIcon }]}>
        {idx + 1}/{statusFlow.length}
      </Text>
    </View>
  )
}

const prog = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12 },
  label: { fontSize: 11, fontFamily: F.display },
})

type TabFilter = 'active' | 'completed'
type DateRange = '7' | '14' | '30' | 'all'
export default function OrdersScreen() {
  const { profile } = useAuth()
  const b = useBrand()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const dateRangeLabels: Record<DateRange, string> = { '7': t('last7Days'), '14': t('last14Days'), '30': t('last30Days'), all: t('allTime') }
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabFilter>('active')
  const [dateRange, setDateRange] = useState<DateRange>('14')

  const router = useRouter()
  const loadOrders = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, service_type, items_count, total, delivery_fee, cancellation_fee, notes, payment_status, subscription_id, created_at, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { loadOrders() }, [loadOrders])
  useRealtimeOrders(profile?.id, loadOrders)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadOrders()
    })
    return () => sub.remove()
  }, [loadOrders])

  const onRefresh = () => { setRefreshing(true); loadOrders() }

  const activeStatuses = ['scheduled', 'pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering']
  const filteredOrders = orders.filter(o => {
    if (tab === 'active') return activeStatuses.includes(o.status)
    if (!['delivered', 'cancelled', 'refunded'].includes(o.status)) return false
    if (dateRange === 'all') return true
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(dateRange))
    return new Date(o.created_at) >= daysAgo
  })
  const activeCount = orders.filter(o => activeStatuses.includes(o.status)).length
  const completedCount = orders.filter(o => ['delivered', 'cancelled', 'refunded'].includes(o.status)).length

  const getStatusLabel = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase() + status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any
    return t(key) || status
  }

  const serviceLabel: Record<string, string> = {
    wash: t('wash'), iron: t('ironOnly'), wash_iron: t('washIron'), dry_clean: t('dryClean'), housekeeping: t('housekeeping'),
  }

  const renderOrder = ({ item, index }: { item: any; index: number }) => {
    const isActive = !['delivered', 'cancelled', 'refunded'].includes(item.status)
    const tone = statusTone(item.status)
    const StatusIcon = statusIcons[item.status] ?? Hourglass
    const num = String(item.order_number ?? '').replace(/^#/, '')
    const meta = [
      serviceLabel[item.service_type] ?? item.service_type,
      `${item.items_count ?? 0} ${t('pieces')}`,
      shortDate(new Date(item.created_at), isEn),
    ].filter(Boolean).join(' · ')

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 60)} style={s.cardWrap}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/order/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`#${num}`}
        >
          <Card pad={false}>
            <View style={s.topRow}>
              <Image source={serviceImages[item.service_type] ?? serviceImages.wash} style={s.thumb} />
              <View style={s.topMeta}>
                <Text style={[s.orderNumber, { color: b.ink }]} numberOfLines={1}>#{num}</Text>
                <Text style={[s.metaLine, { color: b.muted }]} numberOfLines={1}>{meta}</Text>
              </View>
              <Pill label={getStatusLabel(item.status)} tone={tone} icon={<StatusIcon size={12} color={toneColor(b, tone)} />} />
            </View>

            <OrderProgress status={item.status} b={b} />

            {item.status === 'cancelled' && item.cancellation_fee > 0 && (
              <View style={[s.cancelFeeRow, { backgroundColor: b.dangerTint }]}>
                <Coins size={14} color={b.dangerText} />
                <Text style={[s.cancelFeeText, { color: b.dangerText }]}>{money(item.cancellation_fee)} {t('currency')}</Text>
              </View>
            )}

            <Divider />
            <View style={s.bottomRow}>
              {item.driver?.name ? (
                <View style={s.driverInfo}>
                  <View style={[s.driverAvatar, { backgroundColor: b.isDark ? 'rgba(139,92,246,0.18)' : '#EDE9FE' }]}>
                    <Text style={[s.driverAvatarText, { color: b.isDark ? '#A78BFA' : '#7C3AED' }]}>{item.driver.name[0]}</Text>
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={[s.driverName, { color: b.ink2 }]} numberOfLines={1}>{item.driver.name}</Text>
                    {item.driver.phone && <Text style={[s.driverPhone, { color: b.muted }]} numberOfLines={1}>{item.driver.phone}</Text>}
                  </View>
                </View>
              ) : <View style={{ flex: 1 }} />}
              {item.driver?.name && isActive && (
                <View style={s.contactActions}>
                  <IconButton onPress={() => router.push(`/chat/${item.id}`)} label={t('chatWithDriver').replace(/^\S+\s/, '')}>
                    <MessageCircle size={17} color={b.accentIcon} />
                  </IconButton>
                  {item.driver.phone && (
                    <IconButton onPress={() => Linking.openURL(`tel:${item.driver.phone}`)} label={isEn ? 'Call driver' : 'اتصل بالسائق'}>
                      <Phone size={17} color={b.accentIcon} />
                    </IconButton>
                  )}
                </View>
              )}
              <Text style={[s.price, { color: b.primary }]} numberOfLines={1}>
                {money(item.total)} <Text style={[s.currency, { color: b.muted }]}>{t('currency')}</Text>
              </Text>
            </View>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const header = (
    <View style={s.header}>
      <FlowLines height={260} />
      <Animated.Text entering={FadeInDown.duration(500)} style={[s.title, { color: b.ink }]}>{t('myOrders')}</Animated.Text>

      <Segmented
        value={tab}
        onChange={k => setTab(k as TabFilter)}
        items={[
          { key: 'active', label: t('inProgress'), badge: activeCount > 0 ? activeCount : undefined },
          { key: 'completed', label: t('completedTab'), badge: completedCount > 0 ? completedCount : undefined },
        ]}
      />

      {tab === 'completed' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsScroll}>
          {(Object.keys(dateRangeLabels) as DateRange[]).map(key => (
            <Chip key={key} label={dateRangeLabels[key]} active={dateRange === key} onPress={() => setDateRange(key)} />
          ))}
        </ScrollView>
      )}
    </View>
  )

  const EmptyIcon = tab === 'active' ? CircleCheck : Package

  const empty = loading ? (
    <View style={[s.cardWrap, { gap: 12 }]}>
      <SkeletonOrderCard />
      <SkeletonOrderCard />
      <SkeletonOrderCard />
    </View>
  ) : (
    <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.cardWrap}>
      <Card style={s.emptyCard}>
        <View style={[s.emptyIcon, { backgroundColor: b.iconTile }]}>
          <EmptyIcon size={30} color={b.accentIcon} />
        </View>
        <Text style={[s.emptyText, { color: b.ink }]}>
          {tab === 'active' ? t('noActiveOrders') : t('noCompletedOrders')}
        </Text>
        {tab === 'active' && orders.length === 0 && (
          <>
            <Text style={[s.emptySubText, { color: b.muted }]}>{t('orderFirst')}</Text>
            <PrimaryButton title={t('orderNow')} onPress={() => router.push('/(tabs)/new-order')} style={s.emptyBtn} />
          </>
        )}
      </Card>
    </Animated.View>
  )

  const showList = !loading && filteredOrders.length > 0

  return (
    <View style={[s.container, { backgroundColor: b.page }]}>
      <FlatList
        data={showList ? filteredOrders : []}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
        refreshControl={showList ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} /> : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 2 },
  title: { fontSize: 20, fontFamily: F.display, marginBottom: 12 },
  chipsScroll: { marginTop: 10, marginHorizontal: -16 },
  chips: { gap: 6, paddingHorizontal: 16 },
  cardWrap: { paddingHorizontal: 16 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  thumb: { width: 40, height: 40, borderRadius: 12 },
  topMeta: { flex: 1, minWidth: 0 },
  orderNumber: { fontSize: 15, fontFamily: F.display },
  metaLine: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  driverInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  driverAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { fontSize: 13, fontFamily: F.bold },
  driverName: { fontSize: 12.5, fontFamily: F.semibold },
  driverPhone: { fontSize: 11, fontFamily: F.regular, writingDirection: 'ltr', alignSelf: 'flex-start' },
  contactActions: { flexDirection: 'row', gap: 6 },
  price: { fontSize: 16, fontFamily: F.display, marginStart: 4 },
  currency: { fontSize: 10.5, fontFamily: F.semibold },

  cancelFeeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 12, marginBottom: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  cancelFeeText: { fontSize: 12, fontFamily: F.semibold },

  emptyCard: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, marginTop: 4 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyText: { fontSize: 15, fontFamily: F.display, textAlign: 'center' },
  emptySubText: { fontSize: 13, fontFamily: F.regular, marginTop: 6, textAlign: 'center' },
  emptyBtn: { marginTop: 18, alignSelf: 'stretch' },
})
