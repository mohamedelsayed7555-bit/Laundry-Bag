import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, AppState } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeOrders } from '../../src/hooks/useRealtimeOrders'
import { SkeletonOrderCard } from '../../src/components/Skeleton'
import { Phone, MessageCircle } from 'lucide-react-native'

const statusFlow = ['pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

const statusColors: Record<string, string> = {
  scheduled: '#a855f7', pending: '#f59e0b', assigned: '#3b82f6', picked_up: '#8b5cf6', processing: '#06b6d4',
  ready: '#10b981', delivering: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
}

const statusIcons: Record<string, string> = {
  scheduled: '🕐', pending: '⏳', assigned: '🚗', picked_up: '📦', processing: '🔄',
  ready: '✅', delivering: '🛵', delivered: '🎉', cancelled: '❌',
}

function OrderProgress({ status, trackColor }: { status: string; trackColor: string }) {
  if (status === 'cancelled' || status === 'delivered') return null
  const idx = statusFlow.indexOf(status)
  if (idx < 0) return null
  const progress = ((idx + 1) / statusFlow.length) * 100

  return (
    <View style={prog.container}>
      <View style={[prog.track, { backgroundColor: trackColor }]}>
        <View style={[prog.fill, { width: `${progress}%`, backgroundColor: statusColors[status] ?? '#0ea5e9' }]} />
      </View>
      <Text style={[prog.label, { color: statusColors[status] }]}>
        {idx + 1}/{statusFlow.length}
      </Text>
    </View>
  )
}

const prog = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 10, fontWeight: '700' },
})

type TabFilter = 'active' | 'completed'
type DateRange = '7' | '14' | '30' | 'all'
export default function OrdersScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()
  const dateRangeLabels: Record<DateRange, string> = { '7': t('last7Days'), '14': t('last14Days'), '30': t('last30Days'), all: t('allTime') }
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabFilter>('active')
  const [dateRange, setDateRange] = useState<DateRange>('14')
  const [showDatePicker, setShowDatePicker] = useState(false)

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
    if (!['delivered', 'cancelled'].includes(o.status)) return false
    if (dateRange === 'all') return true
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(dateRange))
    return new Date(o.created_at) >= daysAgo
  })
  const activeCount = orders.filter(o => activeStatuses.includes(o.status)).length
  const completedCount = orders.filter(o => ['delivered', 'cancelled'].includes(o.status)).length

  const getStatusLabel = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase() + status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any
    return t(key) || status
  }

  const serviceLabel: Record<string, string> = {
    wash: t('wash'), iron: t('ironOnly'), wash_iron: t('washIron'), dry_clean: t('dryClean'), tailor: t('tailor'),
  }

  const renderOrder = ({ item, index }: { item: any; index: number }) => {
    const sColor = statusColors[item.status] ?? '#f59e0b'
    const sIcon = statusIcons[item.status] ?? '⏳'
    const isActive = !['delivered', 'cancelled'].includes(item.status)

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 60)}>
        <TouchableOpacity
          style={[s.orderCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, isActive && { borderColor: colors.navy[600] }]}
          activeOpacity={0.7}
          onPress={() => router.push(`/order/${item.id}`)}
        >
          <View style={s.orderHeader}>
            <View>
              <Text style={[s.orderNumber, { color: colors.text }]}>{item.order_number}</Text>
              <Text style={[s.orderDate, { color: colors.navy[400] }]}>
                {new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: sColor + '18' }]}>
              <Text style={{ fontSize: 12 }}>{sIcon}</Text>
              <Text style={[s.statusText, { color: sColor }]}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>

          <OrderProgress status={item.status} trackColor={colors.navy[700]} />

          <View style={[s.detailsRow, { borderTopColor: colors.navy[700] }]}>
            <View style={s.detailItem}>
              <Text style={[s.detailLabel, { color: colors.navy[400] }]}>{t('serviceType')}</Text>
              <Text style={[s.detailValue, { color: colors.text }]}>{serviceLabel[item.service_type] ?? item.service_type}</Text>
            </View>
            <View style={s.detailItem}>
              <Text style={[s.detailLabel, { color: colors.navy[400] }]}>{t('items')}</Text>
              <Text style={[s.detailValue, { color: colors.text }]}>{item.items_count}</Text>
            </View>
            <View style={s.detailItem}>
              <Text style={[s.detailLabel, { color: colors.navy[400] }]}>{t('total')}</Text>
              <Text style={[s.detailValue, { color: colors.primary, fontWeight: '800' }]}>{item.total?.toFixed(2)} {t('currency')}</Text>
            </View>
          </View>

          {item.status === 'cancelled' && item.cancellation_fee > 0 && (
            <View style={[s.cancelFeeRow, { borderTopColor: colors.navy[700] }]}>
              <Text style={s.cancelFeeText}>💰 {Number(item.cancellation_fee).toFixed(2)} {t('currency')}</Text>
            </View>
          )}

          {item.driver?.name && (
            <View style={[s.driverSection, { borderTopColor: colors.navy[700] }]}>
              <View style={s.driverInfo}>
                <View style={[s.driverAvatar, { backgroundColor: colors.accent + '30' }]}>
                  <Text style={[s.driverAvatarText, { color: colors.accent }]}>{item.driver.name[0]}</Text>
                </View>
                <View>
                  <Text style={[s.driverName, { color: colors.text }]}>{item.driver.name}</Text>
                  {item.driver.phone && <Text style={[s.driverPhone, { color: colors.navy[300] }]}>{item.driver.phone}</Text>}
                </View>
              </View>
              {isActive && (
                <View style={s.contactActions}>
                  <TouchableOpacity style={[s.contactBtn, { backgroundColor: colors.navy[700], borderColor: colors.navy[600] }]} onPress={() => router.push(`/chat/${item.id}`)}>
                    <MessageCircle size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {item.driver.phone && (
                    <TouchableOpacity style={[s.contactBtn, { backgroundColor: colors.navy[700], borderColor: colors.navy[600] }]} onPress={() => Linking.openURL(`tel:${item.driver.phone}`)}>
                      <Phone size={16} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <View style={[s.container, { backgroundColor: colors.navy[900] }]}>
      <Animated.Text entering={FadeInDown.duration(500)} style={[s.title, { color: colors.text }]}>{t('myOrders')}</Animated.Text>

      {/* Tab Filters */}
      <View style={[s.tabRow, { backgroundColor: colors.navy[800], borderColor: colors.navy[700] }]}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'active' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('active')}
        >
          <Text style={[s.tabText, { color: tab === 'active' ? '#fff' : colors.navy[300] }]}>
            {t('inProgress')} {activeCount > 0 ? `(${activeCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'completed' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('completed')}
        >
          <Text style={[s.tabText, { color: tab === 'completed' ? '#fff' : colors.navy[300] }]}>
            {t('completedTab')} {completedCount > 0 ? `(${completedCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'completed' && (
        <View style={{ marginBottom: 12, zIndex: 10 }}>
          <TouchableOpacity
            style={[s.dateFilterBtn, { backgroundColor: colors.navy[800], borderColor: colors.navy[700] }]}
            onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={[s.dateFilterBtnText, { color: colors.navy[200] }]}>📅 {dateRangeLabels[dateRange]}</Text>
            <Text style={{ fontSize: 10, color: colors.navy[400] }}>{showDatePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View style={[s.dateDropdown, { backgroundColor: colors.navy[800], borderColor: colors.navy[700] }]}>
              {(Object.keys(dateRangeLabels) as DateRange[]).map(key => (
                <TouchableOpacity key={key}
                  style={[s.dateDropdownItem, { borderBottomColor: colors.navy[700] }, dateRange === key && { backgroundColor: colors.primary + '20' }]}
                  onPress={() => { setDateRange(key); setShowDatePicker(false) }}>
                  <Text style={[s.dateDropdownText, { color: colors.navy[200] }, dateRange === key && { color: colors.primary }]}>{dateRangeLabels[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ gap: 12 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </View>
      ) : filteredOrders.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={[s.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <Text style={s.emptyIcon}>{tab === 'active' ? '✅' : '📦'}</Text>
          <Text style={[s.emptyText, { color: colors.navy[200] }]}>
            {tab === 'active' ? t('noActiveOrders') : t('noCompletedOrders')}
          </Text>
          {tab === 'active' && orders.length === 0 && (
            <>
              <Text style={[s.emptySubText, { color: colors.navy[400] }]}>{t('orderFirst')}</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/new-order')}>
                <Text style={s.emptyBtnText}>{t('orderNow')}</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  tabRow: {
    flexDirection: 'row', borderRadius: 14, padding: 4,
    marginBottom: 16, borderWidth: 1,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  orderCard: {
    borderRadius: 20, padding: 18,
    borderWidth: 1,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNumber: { fontSize: 16, fontWeight: '800' },
  orderDate: { fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  detailsRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 14,
    borderTopWidth: 1,
  },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 11, marginBottom: 4 },
  detailValue: { fontSize: 13, fontWeight: '600' },

  driverSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 14, borderTopWidth: 1,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { fontSize: 14, fontWeight: '700' },
  driverName: { fontSize: 13, fontWeight: '600' },
  driverPhone: { fontSize: 11 },
  contactActions: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },

  cancelFeeRow: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1,
    backgroundColor: '#ef444415', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  cancelFeeText: { fontSize: 12, color: '#ef4444', fontWeight: '600', textAlign: 'center' },

  emptyCard: {
    borderRadius: 24, padding: 40,
    alignItems: 'center', borderWidth: 1,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubText: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 14, marginTop: 20,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  dateFilterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1,
  },
  dateFilterBtnText: { fontSize: 13, fontWeight: '600' },
  dateDropdown: { borderRadius: 12, marginTop: 6, borderWidth: 1, overflow: 'hidden' },
  dateDropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  dateDropdownText: { fontSize: 13, fontWeight: '600' },
})
