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
import { Edit3, MapPin, Crown, Fingerprint, LogOut, Sun, Moon, Globe, FileText, ShieldCheck, Star, Trophy, Award } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBrand, Card, FlowLines, ForwardChevron, F, SIZE, type Brand } from '../../src/components/brand'
import { PrimaryButton, SecondaryButton } from '../../src/components/auth/ui'
import { openLegalPage } from '../../src/lib/legal'

export default function ProfileScreen() {
  const { profile, signOut, biometricEnabled, biometricAvailable, toggleBiometric } = useAuth()
  const { isDark, mode, setMode } = useTheme()
  const { t, locale, setLanguage } = useLanguage()
  const { showAlert, AlertComponent } = useCustomAlert()
  const b = useBrand()
  const insets = useSafeAreaInsets()
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
      { text: t('logout'), onPress: async () => { await signOut(); router.replace('/') } },
    ] })
  }

  const subBadge = activeSub ? (locale === 'en' && activeSub.plans?.name ? (t(`plan:${activeSub.plans.name}` as any) !== `plan:${activeSub.plans.name}` ? t(`plan:${activeSub.plans.name}` as any) : activeSub.plans.name) : activeSub.plans?.name) : undefined

  return (
    <>
    <ScrollView style={[s.container, { backgroundColor: b.page }]} contentContainerStyle={[s.contentContainer, { paddingTop: insets.top + 14 }]} showsVerticalScrollIndicator={false}>
      <FlowLines height={300} />
      <Animated.Text entering={FadeInDown.duration(500)} style={[s.pageTitle, { color: b.ink }]}>{t('myAccount')}</Animated.Text>

      {/* Profile hero */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <View style={[s.profileCard, { borderColor: b.tintBorder }]}>
          <LinearGradient colors={b.isDark ? ['rgba(17,36,69,0.92)', 'rgba(15,26,46,0.97)'] : ['#E6F3FD', '#FFFFFF']} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['#38BDF8', '#818CF8', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={[s.avatarImg, { borderColor: b.card }]} />
            ) : (
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={[s.avatarImg, s.avatarFallback, { borderColor: b.card }]}>
                <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
              </LinearGradient>
            )}
          </LinearGradient>
          <Text style={[s.name, { color: b.ink }]}>{profile?.name}</Text>
          <Text style={[s.phone, { color: b.muted }]}>{profile?.phone}</Text>

          <View style={s.badgesRow}>
            <View style={[s.tierBadge, { backgroundColor: tier.bg }]}>
              <Award size={13} color={tier.color} />
              <Text style={[s.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
            {profile?.customer_code && (
              <View style={[s.codeBadge, { backgroundColor: b.tint }]}>
                <Text style={[s.codeText, { color: b.tintText }]}>{profile.customer_code}</Text>
              </View>
            )}
          </View>

          <View style={[s.stats, { borderTopColor: b.isDark ? 'rgba(56,189,248,0.18)' : '#DCEAF7' }]}>
            <View style={s.stat}>
              <Star size={20} color="#FBBF24" />
              <View>
                <Text style={[s.statValue, { color: b.ink }]}>{profile?.points ?? 0}</Text>
                <Text style={[s.statLabel, { color: b.muted }]}>{t('points')}</Text>
              </View>
            </View>
            <View style={[s.statSep, { backgroundColor: b.isDark ? 'rgba(56,189,248,0.18)' : '#DCEAF7' }]} />
            <View style={s.stat}>
              <Trophy size={20} color={tier.color} />
              <View>
                <Text style={[s.statValue, { color: b.ink }]}>{tier.label}</Text>
                <Text style={[s.statLabel, { color: b.muted }]}>{t('level')}</Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Account */}
      <Animated.View entering={FadeInDown.duration(500).delay(200)}>
        <Card pad={false} style={s.group}>
          <MenuItem b={b} icon={<Edit3 size={17} color="#38BDF8" />} label={t('editProfile')} onPress={() => router.push('/edit-profile')} />
          <MenuItem b={b} divider icon={<MapPin size={17} color="#A78BFA" />} label={t('myAddresses')} onPress={() => router.push('/addresses')} />
          <MenuItem b={b} divider icon={<Crown size={17} color="#FBBF24" />} label={t('plansAndSub')} onPress={() => router.push('/plans')} badge={subBadge} />
        </Card>
      </Animated.View>

      {/* Settings */}
      <Animated.View entering={FadeInDown.duration(500).delay(260)}>
        <Card pad={false} style={s.group}>
          <View style={s.menuItem}>
            <View style={[s.menuIconWrap, { backgroundColor: b.iconTile }]}>
              {isDark ? <Moon size={17} color="#FBBF24" /> : <Sun size={17} color="#F59E0B" />}
            </View>
            <Text style={[s.menuText, { color: b.ink }]}>{t('theme')}</Text>
            <View style={[s.themeToggle, { borderColor: b.raisedBorder }]}>
              {(['light', 'system', 'dark'] as const).map(m => {
                const on = mode === m
                const c = on ? '#fff' : b.muted
                return (
                  <TouchableOpacity key={m} style={[s.themeBtn, on && { backgroundColor: b.primary }]} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    {m === 'light' ? <Sun size={14} color={c} /> : m === 'dark' ? <Moon size={14} color={c} /> : <Text style={{ fontSize: 12, color: c, fontFamily: F.bold }}>A</Text>}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <TouchableOpacity style={[s.menuItem, s.divider, { borderTopColor: b.divider }]} onPress={() => setLanguage(locale === 'ar' ? 'en' : 'ar')} accessibilityRole="button">
            <View style={[s.menuIconWrap, { backgroundColor: b.iconTile }]}>
              <Globe size={17} color="#A78BFA" />
            </View>
            <Text style={[s.menuText, { color: b.ink }]}>{t('language')}</Text>
            <View style={[s.langBadge, { backgroundColor: b.tint }]}>
              <Text style={[s.langBadgeText, { color: b.tintText }]}>{locale === 'ar' ? 'العربية' : 'English'}</Text>
            </View>
          </TouchableOpacity>

          {biometricAvailable && (
            <View style={[s.menuItem, s.divider, { borderTopColor: b.divider }]}>
              <View style={[s.menuIconWrap, { backgroundColor: b.iconTile }]}>
                <Fingerprint size={17} color="#38BDF8" />
              </View>
              <Text style={[s.menuText, { color: b.ink }]}>{t('biometricToggle')}</Text>
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
                trackColor={{ false: b.isDark ? '#2A3852' : '#D5DEEA', true: b.primary }}
                thumbColor="#fff"
              />
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Legal */}
      <Animated.View entering={FadeInDown.duration(500).delay(320)}>
        <Card pad={false} style={s.group}>
          <MenuItem b={b} icon={<FileText size={17} color={b.muted} />} label={t('legalTerms')} onPress={() => openLegalPage('terms', locale)} />
          <MenuItem b={b} divider icon={<ShieldCheck size={17} color={b.muted} />} label={t('legalPrivacy')} onPress={() => openLegalPage('privacy', locale)} />
        </Card>
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeInDown.duration(500).delay(380)}>
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: b.dangerTint, borderColor: b.dangerBorder }]} onPress={handleSignOut} activeOpacity={0.7} accessibilityRole="button">
          <LogOut size={17} color={b.dangerText} />
          <Text style={[s.logoutText, { color: b.dangerText }]}>{t('logout')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 100 }} />

      {/* Biometric Modal */}
      <Modal visible={showBioModal} animationType="slide" transparent>
        <View style={s.bioModalOverlay}>
          <View style={[s.bioModalContent, { backgroundColor: b.card, borderColor: b.cardBorder }]}>
            <View style={s.bioModalHeader}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={s.bioIcon}>
                <Fingerprint size={26} color="#fff" />
              </LinearGradient>
              <Text style={[s.bioModalTitle, { color: b.ink }]}>{t('biometricEnable')}</Text>
              <Text style={[s.bioModalHint, { color: b.muted }]}>{t('biometricHint')}</Text>
            </View>
            <Text style={[s.bioFieldLabel, { color: b.ink2 }]}>{t('email')}</Text>
            <TextInput style={[s.bioInput, { backgroundColor: b.field, color: b.ink, borderColor: b.fieldBorder }]} value={bioEmail} onChangeText={setBioEmail} keyboardType="email-address" autoCapitalize="none" textAlign="left" />
            <Text style={[s.bioFieldLabel, { color: b.ink2 }]}>{t('password')}</Text>
            <TextInput style={[s.bioInput, { backgroundColor: b.field, color: b.ink, borderColor: b.fieldBorder }]} value={bioPassword} onChangeText={setBioPassword} secureTextEntry textAlign="left" />
            <View style={s.bioModalActions}>
              <SecondaryButton title={t('cancel')} onPress={() => setShowBioModal(false)} style={{ flex: 1 }} />
              <PrimaryButton
                title={t('activate')}
                loadingTitle={t('activating')}
                loading={bioSaving}
                style={{ flex: 2 }}
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
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    {AlertComponent}
    </>
  )
}

function MenuItem({ icon, label, onPress, badge, b, divider }: { icon: React.ReactNode; label: string; onPress?: () => void; badge?: string; b: Brand; divider?: boolean }) {
  return (
    <TouchableOpacity style={[s.menuItem, divider && [s.divider, { borderTopColor: b.divider }]]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <View style={[s.menuIconWrap, { backgroundColor: b.iconTile }]}>{icon}</View>
      <Text style={[s.menuText, { color: b.ink }]}>{label}</Text>
      {badge ? (
        <View style={[s.menuBadge, { backgroundColor: b.tint }]}><Text style={[s.menuBadgeText, { color: b.tintText }]}>{badge}</Text></View>
      ) : null}
      <ForwardChevron color={b.faint} size={17} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  pageTitle: { fontSize: 20, fontFamily: F.display, marginBottom: 14 },

  profileCard: { alignItems: 'center', borderRadius: 22, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 12, borderWidth: 1, overflow: 'hidden' },
  avatarRing: { width: 88, height: 88, borderRadius: 44, padding: 3, marginBottom: 10 },
  avatarImg: { width: '100%', height: '100%', borderRadius: 41, borderWidth: 3 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, color: '#fff', fontFamily: F.display },
  name: { fontSize: 20, fontFamily: F.display },
  phone: { fontSize: 13, fontFamily: F.regular, marginTop: 2, writingDirection: 'ltr' },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: SIZE.S - 4, paddingHorizontal: 10, borderRadius: 13 },
  tierText: { fontFamily: F.bold, fontSize: 12 },
  codeBadge: { height: SIZE.S - 4, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  codeText: { fontFamily: F.display, fontSize: 12, letterSpacing: 0.5 },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statSep: { width: 1, alignSelf: 'stretch' },
  statValue: { fontSize: 16, fontFamily: F.display, lineHeight: 22 },
  statLabel: { fontSize: 11, fontFamily: F.regular },

  group: { marginTop: 12, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: SIZE.M + 6, paddingHorizontal: 12 },
  divider: { borderTopWidth: 1 },
  menuIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1, fontSize: 14, fontFamily: F.semibold },
  menuBadge: { paddingHorizontal: 9, height: 22, justifyContent: 'center', borderRadius: 11 },
  menuBadgeText: { fontSize: 11, fontFamily: F.bold },

  themeToggle: { flexDirection: 'row', gap: 2, borderWidth: 1, borderRadius: 11, padding: 2 },
  themeBtn: { width: 32, height: 26, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  langBadge: { paddingHorizontal: 10, height: 24, justifyContent: 'center', borderRadius: 12 },
  langBadgeText: { fontSize: 11.5, fontFamily: F.bold },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: SIZE.rM, height: SIZE.M, marginTop: 16 },
  logoutText: { fontSize: 14, fontFamily: F.bold },

  bioModalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,14,0.66)', justifyContent: 'center', padding: 24 },
  bioModalContent: { borderRadius: 24, padding: 20, borderWidth: 1 },
  bioModalHeader: { alignItems: 'center', marginBottom: 16 },
  bioIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bioModalTitle: { fontSize: 17, fontFamily: F.display, marginTop: 10 },
  bioModalHint: { fontSize: 12.5, fontFamily: F.regular, textAlign: 'center', marginTop: 4 },
  bioFieldLabel: { fontSize: 12, fontFamily: F.semibold, marginBottom: 6, marginHorizontal: 2 },
  bioInput: { borderRadius: 13, height: SIZE.L, paddingHorizontal: 14, fontSize: 14, marginBottom: 12, borderWidth: 1, fontFamily: F.medium },
  bioModalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
})
