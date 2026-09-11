import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Platform } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, withDelay } from 'react-native-reanimated'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'

type ContactInfo = {
  whatsapp?: string
  phone?: string
  facebook?: string
  instagram?: string
  tiktok?: string
  address?: string
  google_maps?: string
}

export default function ContactFAB() {
  const { colors } = useTheme()
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

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {})
    setVisible(false)
  }

  const hasAny = contact && (contact.whatsapp || contact.phone || contact.facebook || contact.instagram || contact.tiktok || contact.address)
  if (!hasAny) return null

  const items: { icon: string; label: string; onPress: () => void }[] = []
  if (contact.whatsapp) items.push({ icon: '💬', label: isEn ? 'WhatsApp' : 'واتساب', onPress: () => openLink(`https://wa.me/${contact.whatsapp}`) })
  if (contact.phone) items.push({ icon: '📞', label: isEn ? 'Call us' : 'اتصل بنا', onPress: () => openLink(`tel:${contact.phone}`) })
  if (contact.facebook) items.push({ icon: '📘', label: isEn ? 'Facebook' : 'فيسبوك', onPress: () => openLink(contact.facebook!) })
  if (contact.instagram) items.push({ icon: '📸', label: isEn ? 'Instagram' : 'انستجرام', onPress: () => openLink(contact.instagram!) })
  if (contact.tiktok) items.push({ icon: '🎵', label: isEn ? 'TikTok' : 'تيك توك', onPress: () => openLink(contact.tiktok!) })
  if (contact.google_maps) items.push({ icon: '🗺️', label: isEn ? 'Location' : 'الموقع', onPress: () => openLink(contact.google_maps!) })

  return (
    <>
      <Animated.View style={[s.fabContainer, animStyle]}>
        <TouchableOpacity
          onPress={() => { pulseIn(); setVisible(true) }}
          activeOpacity={0.8}
          style={[s.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        >
          <Text style={s.fabIcon}>💬</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[s.sheet, { backgroundColor: colors.navy[800], borderColor: colors.navy[700] }]}>
            <View style={s.header}>
              <Text style={[s.title, { color: colors.text }]}>{isEn ? 'Contact Us' : 'تواصل معنا'}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} style={[s.closeBtn, { backgroundColor: colors.navy[700] }]}>
                <Text style={[s.closeBtnText, { color: colors.navy[300] }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {contact.address && (
              <View style={[s.addressRow, { backgroundColor: colors.navy[700] + '60' }]}>
                <Text style={[s.addressText, { color: colors.navy[200] }]}>📍 {contact.address}</Text>
              </View>
            )}

            <View style={s.grid}>
              {items.map((item, i) => (
                <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.7}
                  style={[s.gridItem, { backgroundColor: colors.navy[700], borderColor: colors.navy[600] }]}>
                  <Text style={s.gridIcon}>{item.icon}</Text>
                  <Text style={[s.gridLabel, { color: colors.navy[200] }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    zIndex: 999,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: { fontSize: 26 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  sheet: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  addressRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  addressText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  gridIcon: { fontSize: 28 },
  gridLabel: { fontSize: 12, fontWeight: '600' },
})
