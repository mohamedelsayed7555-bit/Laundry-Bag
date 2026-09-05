import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

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

const iconMap: Record<AlertType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  confirm: '❓',
  info: 'ℹ️',
}

export default function CustomAlert({ visible, title, message, type = 'info', buttons, onDismiss }: CustomAlertProps) {
  const { colors } = useTheme()
  const accentMap: Record<AlertType, string> = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    confirm: colors.accent,
    info: colors.primary,
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

  const s = getAlertStyles(colors)
  const resolvedButtons = buttons ?? [{ text: 'حسناً', onPress: onDismiss }]
  const accent = accentMap[type]

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[s.iconCircle, { backgroundColor: accent + '18' }]}>
            <Text style={s.icon}>{iconMap[type]}</Text>
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>

          <View style={[s.btnRow, resolvedButtons.length === 1 && s.btnRowSingle]}>
            {resolvedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel'
              const isDestructive = btn.style === 'destructive'
              const isPrimary = !isCancel && !isDestructive && (resolvedButtons.length === 1 || i === resolvedButtons.length - 1)

              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => {
                    btn.onPress?.()
                    if (!btn.onPress) onDismiss?.()
                  }}
                  style={[
                    s.btn,
                    isPrimary && { backgroundColor: accent },
                    isCancel && s.btnCancel,
                    isDestructive && { backgroundColor: colors.danger },
                    resolvedButtons.length === 1 && s.btnFull,
                  ]}
                >
                  <Text style={[
                    s.btnText,
                    isPrimary && { color: '#fff' },
                    isCancel && { color: colors.navy[300] },
                    isDestructive && { color: '#fff' },
                  ]}>
                    {btn.text}
                  </Text>
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
import { useState, useCallback } from 'react'

type ShowAlertOptions = {
  title: string
  message: string
  type?: AlertType
  buttons?: AlertButton[]
}

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<ShowAlertOptions & { visible: boolean }>({
    visible: false, title: '', message: '',
  })

  const showAlert = useCallback((opts: ShowAlertOptions) => {
    const wrappedButtons = (opts.buttons ?? [{ text: 'حسناً' }]).map(btn => ({
      ...btn,
      onPress: () => {
        btn.onPress?.()
        setAlertState(prev => ({ ...prev, visible: false }))
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

function getAlertStyles(colors: any) { return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: width - 64,
    maxWidth: 340,
    backgroundColor: colors.navy[800],
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.navy[700],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.navy[200],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnRowSingle: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    flex: undefined,
    width: '100%',
  },
  btnCancel: {
    backgroundColor: colors.navy[700],
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
}) }
