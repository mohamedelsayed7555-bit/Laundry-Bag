import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../src/theme'

export default function MessagesScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>الرسائل</Text>
      <View style={s.emptyCard}>
        <Text style={s.emptyIcon}>💬</Text>
        <Text style={s.emptyText}>لا توجد رسائل</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.navy[300] },
})
