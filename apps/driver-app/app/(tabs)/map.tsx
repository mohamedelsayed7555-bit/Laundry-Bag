import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../src/theme'

export default function MapScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>الخريطة</Text>
      <View style={s.mapPlaceholder}>
        <Text style={s.mapIcon}>🗺️</Text>
        <Text style={s.mapText}>سيتم عرض مواقع التوصيل هنا</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  mapPlaceholder: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.navy[700],
  },
  mapIcon: { fontSize: 48, marginBottom: 12 },
  mapText: { fontSize: 14, color: colors.navy[300] },
})
