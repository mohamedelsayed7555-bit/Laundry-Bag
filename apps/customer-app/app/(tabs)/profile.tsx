import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Switch, TextInput, Modal } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { ChevronLeft, Edit3, MapPin, Crown, Fingerprint, LogOut, Sun, Moon, Globe } from 'lucide-react-native'

export default function ProfileScreen() {
  const { profile, signOut, biometricEnabled, biometricAvailable, toggleBiometric } = useAuth()
  const { colors, isDark, mode, setMode } = useTheme()
  const { t, locale, setLanguage } = useLanguage()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [activeSub, setActiveSub] = useState<any>(null)
  const [showBioModal, setShowBioModal] = useState(false)
  const [bioEmail, setBioEmail] = useState('')
  const [bioPassword, setBioPassword] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('subscriptions')
      .select('*, plans(name)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .single()
      .then(({ data }) => setActiveSub(data))
  }, [profile])
  const router = useRouter()

  const tierConfig: Record<string, { label: string; color: string; bg: string }> = {
    bronze: { label: t('tierBronze'), color: '#cd7f32', bg: 'rgba(205,127,50,0.12)' },
    silver: { label: t('tierSilver'), color: '#c0c0c0', bg: 'rgba(192,192,192,0.12)' },
    gold: { label: t('tierGold'), color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    platinum: { label: t('tierPlatinum'), color: '#e5e4e2', bg: 'rgba(229,228,226,0.12)' },
  }

  const tier = tierConfig[profile?.tier ?? 'bronze'] ?? tierConfig.bronze

  const handleSignOut = () => {
    showAlert({ title: t('logout'), message: t('logoutConfirm'), type: 'confirm', buttons: [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: async () => { await signOut(); router.replace('/') } },
    ] })
  }

  return (
    <>
    <ScrollView style={[s.container, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.duration(500)} style={[s.pageTitle, { color: colors.text }]}>{t('myAccount')}</Animated.Text>

      {/* Profile Card */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <LinearGradient
          colors={[colors.cardBg, colors.navy[700]]}
          style={[s.profileCard, { borderColor: colors.navy[600] }]}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={[s.avatarImg, { borderColor: colors.accentLight }]} />
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.accent, borderColor: colors.accentLight }]}>
              <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
            </View>
          )}
          <Text style={[s.name, { color: colors.text }]}>{profile?.name}</Text>
          <Text style={[s.phone, { color: colors.navy[200] }]}>{profile?.phone}</Text>

          <View style={s.badgesRow}>
            {profile?.customer_code && (
              <View style={[s.codeBadge, { backgroundColor: colors.primaryGlow, borderColor: colors.primary + '30' }]}>
                <Text style={[s.codeText, { color: colors.primary }]}>{profile.customer_code}</Text>
              </View>
            )}
            <View style={[s.tierBadge, { backgroundColor: tier.bg }]}>
              <Text style={[s.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <View style={[s.statIconWrap, { backgroundColor: colors.accentGlow }]}>
            <Text style={{ fontSize: 18 }}>⭐</Text>
          </View>
          <Text style={[s.statValue, { color: colors.text }]}>{profile?.points ?? 0}</Text>
          <Text style={[s.statLabel, { color: colors.navy[300] }]}>{t('points')}</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <View style={[s.statIconWrap, { backgroundColor: tier.bg }]}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
          </View>
          <Text style={[s.statValue, { color: colors.text }]}>{tier.label}</Text>
          <Text style={[s.statLabel, { color: colors.navy[300] }]}>{t('level')}</Text>
        </View>
      </Animated.View>

      {/* Menu */}
      <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.menuSection}>
        <MenuItem colors={colors} icon={<Edit3 size={20} color={colors.primary} />} label={t('editProfile')} onPress={() => router.push('/edit-profile')} />
        <MenuItem colors={colors} icon={<MapPin size={20} color={colors.accent} />} label={t('myAddresses')} onPress={() => router.push('/addresses')} />
        <MenuItem
          colors={colors}
          icon={<Crown size={20} color={colors.gold} />}
          label={t('plansAndSub')}
          onPress={() => router.push('/plans')}
          badge={activeSub ? (locale === 'en' && activeSub.plans?.name ? (t(`plan:${activeSub.plans.name}` as any) !== `plan:${activeSub.plans.name}` ? t(`plan:${activeSub.plans.name}` as any) : activeSub.plans.name) : activeSub.plans?.name) : undefined}
        />

        {/* Theme Toggle */}
        <View style={[s.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <View style={[s.menuIconWrap, { backgroundColor: colors.navy[700] }]}>
            {isDark ? <Moon size={20} color="#fbbf24" /> : <Sun size={20} color="#f59e0b" />}
          </View>
          <Text style={[s.menuText, { color: colors.text }]}>{t('theme')}</Text>
          <View style={s.themeToggle}>
            <TouchableOpacity
              style={[s.themeBtn, mode === 'light' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setMode('light')}
            >
              <Sun size={14} color={mode === 'light' ? colors.primary : colors.navy[400]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.themeBtn, mode === 'system' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setMode('system')}
            >
              <Text style={{ fontSize: 12, color: mode === 'system' ? colors.primary : colors.navy[400], fontWeight: '600' }}>A</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.themeBtn, mode === 'dark' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setMode('dark')}
            >
              <Moon size={14} color={mode === 'dark' ? colors.primary : colors.navy[400]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Toggle */}
        <TouchableOpacity
          style={[s.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}
          onPress={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
        >
          <View style={[s.menuIconWrap, { backgroundColor: colors.navy[700] }]}>
            <Globe size={20} color={colors.accent} />
          </View>
          <Text style={[s.menuText, { color: colors.text }]}>{t('language')}</Text>
          <View style={[s.langBadge, { backgroundColor: colors.primaryGlow }]}>
            <Text style={[s.langBadgeText, { color: colors.primary }]}>{locale === 'ar' ? 'العربية' : 'English'}</Text>
          </View>
        </TouchableOpacity>

        {biometricAvailable && (
          <View style={[s.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
            <View style={[s.menuIconWrap, { backgroundColor: colors.primaryGlow }]}>
              <Fingerprint size={20} color={colors.primary} />
            </View>
            <Text style={[s.menuText, { color: colors.text }]}>{t('biometricToggle')}</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={async (val) => {
                if (val) {
                  setBioEmail(profile?.email ?? '')
                  setBioPassword('')
                  setShowBioModal(true)
                } else {
                  await toggleBiometric(false)
                  showAlert({ title: t('success'), message: t('biometricDisabled'), type: 'success' })
                }
              }}
              trackColor={{ false: colors.navy[600], true: colors.primary + '60' }}
              thumbColor={biometricEnabled ? colors.primary : colors.navy[400]}
            />
          </View>
        )}
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeInDown.duration(500).delay(400)}>
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: colors.dangerGlow, borderColor: colors.danger + '30' }]} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOut size={18} color={colors.danger} />
          <Text style={[s.logoutText, { color: colors.danger }]}>{t('logout')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 100 }} />

      {/* Biometric Modal */}
      <Modal visible={showBioModal} animationType="slide" transparent>
        <View style={s.bioModalOverlay}>
          <View style={[s.bioModalContent, { backgroundColor: colors.cardBg, borderColor: colors.navy[600] }]}>
            <View style={s.bioModalHeader}>
              <Text style={{ fontSize: 32 }}>🔐</Text>
              <Text style={[s.bioModalTitle, { color: colors.text }]}>{t('biometricEnable')}</Text>
              <Text style={[s.bioModalHint, { color: colors.navy[300] }]}>{t('biometricHint')}</Text>
            </View>
            <Text style={[s.bioFieldLabel, { color: colors.navy[200] }]}>{t('email')}</Text>
            <TextInput style={[s.bioInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} value={bioEmail} onChangeText={setBioEmail} keyboardType="email-address" autoCapitalize="none" textAlign="left" />
            <Text style={[s.bioFieldLabel, { color: colors.navy[200] }]}>{t('password')}</Text>
            <TextInput style={[s.bioInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} value={bioPassword} onChangeText={setBioPassword} secureTextEntry textAlign="left" />
            <View style={s.bioModalActions}>
              <TouchableOpacity style={[s.bioModalCancel, { borderColor: colors.navy[500] }]} onPress={() => setShowBioModal(false)}>
                <Text style={[s.bioModalCancelText, { color: colors.navy[200] }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bioModalSave, { backgroundColor: colors.primary }, bioSaving && { opacity: 0.6 }]}
                disabled={bioSaving}
                onPress={async () => {
                  if (!bioEmail || !bioPassword) { showAlert({ title: t('warning'), message: t('enterEmailPassword'), type: 'warning' }); return }
                  setBioSaving(true)
                  const ok = await toggleBiometric(true, bioEmail, bioPassword)
                  setBioSaving(false)
                  if (ok) {
                    setShowBioModal(false)
                    showAlert({ title: t('success'), message: t('biometricEnabled'), type: 'success' })
                  } else {
                    showAlert({ title: t('error'), message: t('biometricFailed'), type: 'error' })
                  }
                }}
              >
                <Text style={s.bioModalSaveText}>{bioSaving ? t('activating') : t('activate')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    {AlertComponent}
    </>
  )
}

function MenuItem({ icon, label, onPress, badge, colors }: { icon: React.ReactNode; label: string; onPress?: () => void; badge?: string; colors: any }) {
  return (
    <TouchableOpacity style={[s.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.menuIconWrap, { backgroundColor: colors.navy[700] }]}>{icon}</View>
      <Text style={[s.menuText, { color: colors.text }]}>{label}</Text>
      {badge ? (
        <View style={[s.menuBadge, { backgroundColor: colors.primaryGlow }]}><Text style={[s.menuBadgeText, { color: colors.primary }]}>{badge}</Text></View>
      ) : (
        <ChevronLeft size={18} color={colors.navy[400]} />
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingTop: 56, paddingBottom: 100 },
  pageTitle: { fontSize: 24, fontWeight: '800', marginBottom: 24 },

  profileCard: {
    alignItems: 'center', borderRadius: 24,
    padding: 28, borderWidth: 1, marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    borderWidth: 3,
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  avatarImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 14, borderWidth: 3 },
  name: { fontSize: 22, fontWeight: '800' },
  phone: { fontSize: 14, marginTop: 4 },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  codeBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  codeText: { fontWeight: '700', fontSize: 12 },
  tierBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  tierText: { fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 18, padding: 18,
    alignItems: 'center', borderWidth: 1, gap: 6,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11 },

  menuSection: { gap: 8, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14, borderWidth: 1, gap: 12,
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600' },
  menuBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  menuBadgeText: { fontSize: 11, fontWeight: '700' },

  themeToggle: { flexDirection: 'row', gap: 4 },
  themeBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  langBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  langBadgeText: { fontSize: 11, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderWidth: 1,
    borderRadius: 16, padding: 16,
  },
  logoutText: { fontSize: 16, fontWeight: '700' },

  bioModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  bioModalContent: { borderRadius: 24, padding: 24, borderWidth: 1 },
  bioModalHeader: { alignItems: 'center', marginBottom: 20 },
  bioModalTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  bioModalHint: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  bioFieldLabel: { fontSize: 12, marginBottom: 4, textAlign: 'right' },
  bioInput: { borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12, borderWidth: 1 },
  bioModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  bioModalCancel: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalCancelText: { fontWeight: '600' },
  bioModalSave: { flex: 2, borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalSaveText: { color: '#fff', fontWeight: '700' },
})
