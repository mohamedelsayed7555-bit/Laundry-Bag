import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CircleCheck, CircleX, TriangleAlert, CircleHelp, Info, type LucideIcon } from 'lucide-react-native'
import { useBrand, F, SIZE } from './brand'

const { width } = Dimensions.get('window')

type AlertButton = {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

type AlertType = 'success' | 'error' | 'warning' | 'confirm' | 'info'

interface CustomAlertProps {
  visible: boolean
  title: string
  message: string
  type?: AlertType
  buttons?: AlertButton[]
  onDismiss?: () => void
}

const ICONS: Record<AlertType, LucideIcon> = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  confirm: CircleHelp,
  info: Info,
}

export default function CustomAlert({ visible, title, message, type = 'info', buttons, onDismiss }: CustomAlertProps) {
  const b = useBrand()
  const tone: Record<AlertType, { fg: string; bg: string }> = {
    success: { fg: b.okText, bg: b.okTint },
    error: { fg: b.dangerText, bg: b.dangerTint },
    warning: { fg: b.isDark ? '#FBBF24' : '#B45309', bg: b.warnTint },
    confirm: { fg: b.tintText, bg: b.tint },
    info: { fg: b.tintText, bg: b.tint },
  }
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
    }
  }, [visible])

  const resolvedButtons = buttons ?? [{ text: 'حسناً', onPress: onDismiss }]
  const t = tone[type]
  const Icon = ICONS[type]

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { backgroundColor: b.card, borderColor: b.cardBorder, transform: [{ scale: scaleAnim }] }]}>
          <View style={[s.iconCircle, { backgroundColor: t.bg }]}>
            <Icon size={30} color={t.fg} />
          </View>

          <Text style={[s.title, { color: b.ink }]}>{title}</Text>
          {message ? <Text style={[s.message, { color: b.muted }]}>{message}</Text> : null}

          <View style={s.btnRow}>
            {resolvedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel'
              const isDestructive = btn.style === 'destructive'
              const isPrimary = !isCancel && !isDestructive && (resolvedButtons.length === 1 || i === resolvedButtons.length - 1)
              const onPress = () => {
                btn.onPress?.()
                if (!btn.onPress) onDismiss?.()
              }

              // Primary and destructive share the filled look; only the colour changes.
              if (isPrimary || isDestructive) {
                return (
                  <TouchableOpacity key={i} activeOpacity={0.85} onPress={onPress} style={s.btnWrap} accessibilityRole="button">
                    <LinearGradient
                      colors={isDestructive ? ['#F87171', '#DC2626'] : ['#38BDF8', '#0284C7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.btn}
                    >
                      <Text style={[s.btnText, { color: '#fff' }]} numberOfLines={1}>{btn.text}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )
              }

              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={onPress}
                  accessibilityRole="button"
                  style={[s.btnWrap, s.btn, s.btnQuiet, { backgroundColor: b.card, borderColor: b.cardBorder }]}
                >
                  <Text style={[s.btnText, { color: b.ink }]} numberOfLines={1}>{btn.text}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// Hook for imperative usage
type ShowAlertOptions = {
  title: string
  message: string
  type?: AlertType
  buttons?: AlertButton[]
  onConfirm?: () => void
}

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<ShowAlertOptions & { visible: boolean }>({
    visible: false, title: '', message: '',
  })

  const showAlert = useCallback((opts: ShowAlertOptions) => {
    const wrappedButtons = (opts.buttons ?? [{ text: 'حسناً' }]).map(btn => ({
      ...btn,
      onPress: async () => {
        setAlertState(prev => ({ ...prev, visible: false }))
        await btn.onPress?.()
      },
    }))
    setAlertState({ ...opts, buttons: wrappedButtons, visible: true })
  }, [])

  const dismissAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }))
  }, [])

  const AlertComponent = (
    <CustomAlert
      visible={alertState.visible}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      buttons={alertState.buttons}
      onDismiss={dismissAlert}
    />
  )

  return { showAlert, AlertComponent }
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,14,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: width - 56,
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#020A19',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 18,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontFamily: F.display, textAlign: 'center' },
  message: { fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 22, marginTop: 5 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
  btnWrap: { flex: 1, borderRadius: SIZE.rL, overflow: 'hidden' },
  btn: { height: SIZE.L - 2, borderRadius: SIZE.rL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnQuiet: { borderWidth: 1.5 },
  btnText: { fontSize: 14, fontFamily: F.bold },
})
