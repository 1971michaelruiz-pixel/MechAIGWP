/**
 * CustomerSearchScreen — search for an existing customer or create a new one.
 *
 * Navigated to from any screen that needs to associate a vehicle with a customer.
 * On selection or creation the screen calls router.back() and passes the selected
 * customer as a JSON-serialised search param so the calling screen can read it.
 *
 * Usage (from calling screen):
 *   router.push({ pathname: '/customer', params: { vehicleId: '...' } })
 *   // read result from params.selectedCustomer (JSON string) after navigation
 */

import { useState, useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type CustomerSummary = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  email?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomerSearchScreen() {
  const params = useLocalSearchParams<{ vehicleId?: string }>()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // New customer modal state
  const [modalVisible, setModalVisible] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Search (debounced 300 ms) ──────────────────────────────────────────────
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (!text.trim()) {
        setResults([])
        return
      }
      const timer = setTimeout(async () => {
        setSearching(true)
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/customers/search?q=${encodeURIComponent(text.trim())}`,
          )
          if (res.ok) {
            const data: CustomerSummary[] = await res.json()
            setResults(data)
          }
        } finally {
          setSearching(false)
        }
      }, 300)
      setDebounceTimer(timer)
    },
    [debounceTimer],
  )

  // ── Select a customer — navigate back with the result ─────────────────────
  const handleSelect = useCallback(
    (customer: CustomerSummary) => {
      router.back()
      // Pass the selected customer back via search params
      router.setParams({ selectedCustomer: JSON.stringify(customer) })
    },
    [router],
  )

  // ── Create new customer ───────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      const customer: CustomerSummary = await res.json()
      setModalVisible(false)
      handleSelect(customer)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setCreating(false)
    }
  }, [firstName, lastName, phone, email, handleSelect])

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderResult = ({ item }: { item: CustomerSummary }) => (
    <Pressable onPress={() => handleSelect(item)} style={styles.resultRow}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>
          {item.first_name} {item.last_name}
        </Text>
        {item.phone ? <Text style={styles.resultPhone}>{item.phone}</Text> : null}
      </View>
      <Pressable onPress={() => handleSelect(item)} style={styles.selectBtn}>
        <Text style={styles.selectBtnText}>Select</Text>
      </Pressable>
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assign Customer</Text>
      {params.vehicleId ? (
        <Text style={styles.subtitle}>Vehicle ID: {params.vehicleId}</Text>
      ) : null}

      {/* Search input */}
      <TextInput
        value={query}
        onChangeText={handleQueryChange}
        placeholder="Search by name or phone…"
        placeholderTextColor="#57606a"
        style={styles.searchInput}
        autoFocus
        clearButtonMode="while-editing"
      />

      {/* Status */}
      {searching && <ActivityIndicator color="#3b82d4" style={{ marginTop: 12 }} />}
      {!searching && query.trim() !== '' && results.length === 0 && (
        <Text style={styles.emptyText}>No customers found.</Text>
      )}

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderResult}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />

      {/* Add new customer */}
      <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Add new customer</Text>
      </Pressable>

      {/* ── New Customer Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.title}>New Customer</Text>

          <Text style={styles.fieldLabel}>First name *</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="#57606a"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Last name *</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor="#57606a"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 555-1234"
            placeholderTextColor="#57606a"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. john@example.com"
            placeholderTextColor="#57606a"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

          <View style={styles.modalActions}>
            {creating ? (
              <ActivityIndicator color="#3b82d4" />
            ) : (
              <>
                <Pressable
                  onPress={handleCreate}
                  style={[
                    styles.btnPrimary,
                    (!firstName.trim() || !lastName.trim()) && styles.btnDisabled,
                  ]}
                  disabled={!firstName.trim() || !lastName.trim()}
                >
                  <Text style={styles.btnPrimaryText}>Create customer</Text>
                </Pressable>
                <Pressable onPress={() => setModalVisible(false)} style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#57606a',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#57606a',
    marginTop: 12,
    fontStyle: 'italic',
  },
  list: {
    flex: 1,
    marginTop: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2328',
  },
  resultPhone: {
    fontSize: 12,
    color: '#57606a',
    marginTop: 2,
  },
  selectBtn: {
    backgroundColor: '#3b82d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  selectBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  addBtn: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82d4',
  },
  modalContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#57606a',
    fontWeight: '500',
    marginTop: 14,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2328',
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#c05621',
    fontSize: 13,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#3b82d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#1f2328',
    fontWeight: '500',
    fontSize: 15,
  },
})
