import { StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MechAI</Text>
      <Text style={styles.subtitle}>
        AI-powered automotive diagnostics. Scaffold is running — feature
        screens will be added in subsequent sub-tasks.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1f2328',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#57606a',
    textAlign: 'center',
  },
})
