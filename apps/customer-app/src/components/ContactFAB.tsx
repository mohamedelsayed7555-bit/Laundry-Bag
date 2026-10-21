import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, withDelay, runOnJS, Easing } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect, Circle } from 'react-native-svg'
import { Headset, Phone, MapPin, X } from 'lucide-react-native'
import { usePathname } from 'expo-router'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import { useBrand, ForwardChevron, F, SIZE, HIT } from './brand'

type ContactInfo = {
  whatsapp?: string
  phone?: string
  facebook?: string
  instagram?: string
  tiktok?: string
  address?: string
  google_maps?: string
}

// Brand marks (lucide has no WhatsApp / TikTok logos).
function WhatsAppLogo({ size = 21 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.9a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.1 8.1 0 1 1 12 20.1Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </Svg>
  )
}
function FacebookLogo() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path fill="#fff" d="M14.2 8.3h2.3V5h-2.8c-3 0-4 1.9-4 4.3v1.9H7.5v3.2h2.2V21h3.3v-6.6h2.6l.4-3.2h-3V9.6c0-.8.4-1.3 1.2-1.3Z" />
    </Svg>
  )
}
function InstagramLogo() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2}>
      <Rect x={4} y={4} width={16} height={16} rx={5} />
      <Circle cx={12} cy={12} r={3.6} />
      <Circle cx={17} cy={7} r={0.9} fill="#fff" stroke="none" />
    </Svg>
  )
}
function TikTokLogo() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path fill="#fff" d="M16.4 3c.3 2.3 1.6 3.7 3.9 3.9v3.1c-1.4.1-2.7-.3-3.9-1.1v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.2a2.5 2.5 0 1 0 1.6 2.3V3h3.1Z" />
    </Svg>
  )
}

export default function ContactFAB() {
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const [visible, setVisible] = useState(false)
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const scale = useSharedValue(1)
  const bounce = useSharedValue(0)

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'contact_info')
      .single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object') setContact(data.value as ContactInfo)
      })
  }, [])

  useEffect(() => {
    bounce.value = withDelay(2000, withRepeat(
      withSequence(
        withTiming(-6, { duration: 200 }),
        withTiming(0, { duration: 200 }),
        withTiming(-4, { duration: 150 }),
        withTiming(0, { duration: 150 }),
        withTiming(0, { duration: 3000 }),
      ), -1
    ))
  }, [])

  const pulseIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 10 })
    setTimeout(() => { scale.value = withSpring(1) }, 100)
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: bounce.value }],
  }))

  // The sheet is animated here (modal opens with no animation of its own), so only one
  // animation runs and the sheet never flashes at the wrong position first.
  const open = useSharedValue(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      open.value = 0
      open.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })
    }
  }, [visible])
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.value) * 420 }],
  }))
  const scrimStyle = useAnimatedStyle(() => ({ opacity: open.value }))
  const closeSheet = useCallback(() => {
    open.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(setMounted)(false)
    })
    setVisible(false)
  }, [])

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {})
    closeSheet()
  }

  // On the new-order screen the button sat over the item rows and the quantity
  // controls. Lifting it only moved the collision, so it is hidden there instead —
  // that screen is for building an order, not for asking a question.
  const pathname = usePathname()
  if (pathname?.includes('new-order')) return null

  const fabBottom = 150

  const hasAny = contact && (contact.whatsapp || contact.phone || contact.facebook || contact.instagram || contact.tiktok || contact.address)
  if (!hasAny) return null

  const socials: { key: string; label: string; bg: string[]; logo: React.ReactNode; url: string }[] = []
  if (contact.facebook) socials.push({ key: 'fb', label: isEn ? 'Facebook' : 'فيسبوك', bg: ['#1877F2', '#1877F2'], logo: <FacebookLogo />, url: contact.facebook })
  if (contact.instagram) socials.push({ key: 'ig', label: isEn ? 'Instagram' : 'انستجرام', bg: ['#F58529', '#DD2A7B', '#8134AF'], logo: <InstagramLogo />, url: contact.instagram })
  if (contact.tiktok) socials.push({ key: 'tt', label: isEn ? 'TikTok' : 'تيك توك', bg: ['#111111', '#111111'], logo: <TikTokLogo />, url: contact.tiktok })

  const close = closeSheet

  return (
    <>
      <Animated.View style={[s.fabContainer, { bottom: fabBottom }, animStyle]}>
        <TouchableOpacity
          onPress={() => { pulseIn(); setVisible(true) }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isEn ? 'Contact Us' : 'تواصل معنا'}
          style={s.fabHalo}
        >
          <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
            <Headset size={23} color="#fff" />
          </LinearGradient>
          <View style={[s.onDot, s.fabDot, { borderColor: b.page }]} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={visible || mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <View style={s.overlay}>
          <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrimStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={isEn ? 'Close' : 'إغلاق'} />
          </Animated.View>
          <Animated.View style={[s.sheet, sheetStyle, { backgroundColor: b.card, borderColor: b.cardBorder, paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
            <View style={[s.handle, { backgroundColor: b.cardBorder }]} />

            <View style={s.header}>
              <View>
                <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
                  <Headset size={21} color="#fff" />
                </LinearGradient>
                <View style={[s.onDot, s.logoDot, { borderColor: b.card }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: b.ink }]}>{isEn ? 'Contact Us' : 'تواصل معنا'}</Text>
                <Text style={[s.subtitle, { color: b.muted }]}>{isEn ? "We're here to help anytime" : 'إحنا هنا نساعدك في أي وقت'}</Text>
              </View>
              <TouchableOpacity onPress={close} hitSlop={HIT} style={[s.closeBtn, { backgroundColor: b.iconTile }]} accessibilityRole="button" accessibilityLabel={isEn ? 'Close' : 'إغلاق'}>
                <X size={16} color={b.muted} />
              </TouchableOpacity>
            </View>

            {(contact.whatsapp || contact.phone) && (
              <View style={[s.list, { borderColor: b.cardBorder }]}>
                {contact.whatsapp ? (
                  <TouchableOpacity style={s.item} onPress={() => openLink(`https://wa.me/${contact.whatsapp}`)} activeOpacity={0.7} accessibilityRole="button">
                    <View style={[s.itemIcon, { backgroundColor: '#25D366' }]}><WhatsAppLogo /></View>
                    <View style={s.itemInfo}>
                      <Text style={[s.itemTitle, { color: b.ink }]}>{isEn ? 'WhatsApp' : 'واتساب'}</Text>
                      <Text style={[s.itemSub, { color: b.muted }]}>{contact.whatsapp}</Text>
                    </View>
                    <ForwardChevron color={b.faint} size={17} />
                  </TouchableOpacity>
                ) : null}
                {contact.phone ? (
                  <TouchableOpacity style={[s.item, contact.whatsapp ? { borderTopWidth: 1, borderTopColor: b.divider } : null]} onPress={() => openLink(`tel:${contact.phone}`)} activeOpacity={0.7} accessibilityRole="button">
                    <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.itemIcon}><Phone size={18} color="#fff" /></LinearGradient>
                    <View style={s.itemInfo}>
                      <Text style={[s.itemTitle, { color: b.ink }]}>{isEn ? 'Call us' : 'اتصل بنا'}</Text>
                      <Text style={[s.itemSub, { color: b.muted }]}>{contact.phone}</Text>
                    </View>
                    <ForwardChevron color={b.faint} size={17} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {socials.length > 0 && (
              <>
                <Text style={[s.label, { color: b.muted }]}>{isEn ? 'Follow us' : 'تابعنا'}</Text>
                <View style={s.socialRow}>
                  {socials.map(so => (
                    <TouchableOpacity key={so.key} style={[s.social, { backgroundColor: b.page, borderColor: b.cardBorder }]} onPress={() => openLink(so.url)} activeOpacity={0.7} accessibilityRole="button">
                      <LinearGradient colors={so.bg as [string, string, ...string[]]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.socialIcon}>{so.logo}</LinearGradient>
                      <Text style={[s.socialText, { color: b.ink }]} numberOfLines={1}>{so.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {(contact.address || contact.google_maps) && (
              <TouchableOpacity
                style={[s.addr, { backgroundColor: b.tint }]}
                onPress={contact.google_maps ? () => openLink(contact.google_maps!) : undefined}
                disabled={!contact.google_maps}
                activeOpacity={0.7}
                accessibilityRole={contact.google_maps ? 'button' : undefined}
              >
                <View style={[s.addrIcon, { backgroundColor: b.card }]}><MapPin size={17} color={b.tintText} /></View>
                <Text style={[s.addrText, { color: b.ink }]} numberOfLines={2}>{contact.address || (isEn ? 'Location' : 'الموقع')}</Text>
                {contact.google_maps ? <Text style={[s.addrOpen, { color: b.tintText }]}>{isEn ? 'Open map' : 'افتح الخريطة'}</Text> : null}
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  fabContainer: { position: 'absolute', left: 16, zIndex: 999 },
  fabHalo: {
    width: 60, height: 60, borderRadius: 30, padding: 5, backgroundColor: 'rgba(56,189,248,0.16)',
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  fab: { flex: 1, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  onDot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2.5 },
  fabDot: { top: 5, end: 5 },
  logoDot: { bottom: -2, end: -2 },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(2,6,14,0.6)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  logo: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: F.display },
  subtitle: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 12, paddingHorizontal: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13.5, fontFamily: F.bold },
  itemSub: { fontSize: 11.5, fontFamily: F.regular, writingDirection: 'ltr', alignSelf: 'flex-start' },

  label: { fontSize: 11.5, fontFamily: F.bold, marginTop: 14, marginBottom: 8, marginHorizontal: 2 },
  socialRow: { flexDirection: 'row', gap: 8 },
  social: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1, paddingHorizontal: 6 },
  socialIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  socialText: { fontSize: 12.5, fontFamily: F.bold, flexShrink: 1 },

  addr: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10, marginTop: 12 },
  addrIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addrText: { flex: 1, fontSize: 12.5, fontFamily: F.bold },
  addrOpen: { fontSize: 11.5, fontFamily: F.bold },
})
