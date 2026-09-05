import { forwardRef, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useTheme } from '../contexts/ThemeContext'

interface AppBottomSheetProps {
  title?: string
  children: React.ReactNode
  snapPoints?: (string | number)[]
  onClose?: () => void
}

const AppBottomSheetComponent = forwardRef<BottomSheet, AppBottomSheetProps>(
  ({ title, children, snapPoints: customSnap, onClose }, ref) => {
    const { colors } = useTheme()
    const s = getSheetStyles(colors)
    const snapPoints = useMemo(() => customSnap ?? ['50%', '75%'], [customSnap])

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      []
    )

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onClose={onClose}
        backgroundStyle={s.background}
        handleIndicatorStyle={s.indicator}
      >
        <BottomSheetView style={s.content}>
          {title && (
            <View style={s.header}>
              <Text style={s.title}>{title}</Text>
              {onClose && (
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Text style={s.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {children}
        </BottomSheetView>
      </BottomSheet>
    )
  }
)

AppBottomSheetComponent.displayName = 'AppBottomSheet'
export default AppBottomSheetComponent

function getSheetStyles(colors: any) { return StyleSheet.create({
  background: {
    backgroundColor: colors.navy[800],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    backgroundColor: colors.navy[500],
    width: 40,
    height: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[700],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.navy[300],
    fontSize: 16,
  },
}) }
