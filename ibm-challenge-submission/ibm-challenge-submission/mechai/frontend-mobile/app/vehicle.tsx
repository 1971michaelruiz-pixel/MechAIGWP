/**
 * VehicleConfirmationScreen — displays the NHTSA-decoded vehicle details and
 * lets the mechanic confirm or edit them before the profile is saved.
 *
 * The decoded vehicle is received via Expo Router search params (serialised as
 * JSON) so this screen can be pushed from any point in the navigation stack.
 *
 * States:
 *   read-only card → Confirm (fires API save) | Edit (opens modal)
 *   edit modal     → Save (fires API save + close) | Cancel
 */

import { useState, useCallback } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type VehicleData = {
  vin: string
  make: string | null
  model: string | null
  year: number | null
  trim?: string | null
  engine?: string | null
  body_style?: string | null
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VehicleConfirmationScreen() {
  const params = useLocalSearchParams<{ vehicle: string }>()
  const router = useRouter()

  // Parse vehicle from route params
  const initial: VehicleData | null = (() => {
    try {
      return params.vehicle ? (JSON.parse(params.vehicle) as VehicleData) : null
    } catch {
      return null
    }
  })()

  const [vehicle, setVehicle] = useState<VehicleData | null>(initial)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [draft, setDraft] = useState<VehicleData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Persist to backend ─────────────────────────────────────────────────────
  const saveVehicle = useCallback(async (v: VehicleData) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }, [])

  // ── Guard: no vehicle passed ───────────────────────────────────────────────
  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No vehicle data received.</Text>
        <Pressable onPress={() => router.back()} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  // ── Saved confirmation ─────────────────────────────────────────────────────
  if (saved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.successText}>✓ Vehicle profile saved</Text>
        <Text style={styles.vinMono}>{vehicle.vin}</Text>
        <Pressable onPress={() => router.back()} style={[styles.btnPrimary, { marginTop: 24 }]}>
          <Text style={styles.btnPrimaryText}>Done</Text>
        </Pressable>
      </View>
    )
  }

  const openEdit = () => {
    setDraft({ ...vehicle })
    setEditModalVisible(true)
  }

  const setDraftField = (key: keyof VehicleData, value: string) =>
    setDraft((prev) => prev ? { ...prev, [key]: value || null } : prev)

  const saveEdit = async () => {
    if (!draft) return
    setVehicle(draft)
    setEditModalVisible(false)
    await saveVehicle(draft)
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Vehicle Profile</Text>
      <Text style={styles.vinMono}>{vehicle.vin}</Text>

      {/* Read-only fields */}
      <View style={styles.card}>
        <Row label="Make" value={vehicle.make} />
        <Row label="Model" value={vehicle.model} />
        <Row label="Year" value={vehicle.year != null ? String(vehicle.year) : null} />
        <Row label="Trim" value={vehicle.trim} />
        <Row label="Engine" value={vehicle.engine} />
        <Row label="Body Style" value={vehicle.body_style} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        {saving ? (
          <ActivityIndicator color="#3b82d4" />
        ) : (
          <>
            <Pressable
              onPress={() => saveVehicle(vehicle)}
              style={styles.btnPrimary}
              accessibilityLabel="Confirm vehicle"
            >
              <Text style={styles.btnPrimaryText}>Confirm</Text>
            </Pressable>
            <Pressable
              onPress={openEdit}
              style={styles.btnSecondary}
              accessibilityLabel="Edit vehicle"
            >
              <Text style={styles.btnSecondaryText}>Edit</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.title}>Edit Vehicle</Text>
          <Text style={styles.vinMono}>{draft?.vin}</Text>

          <EditField label="Make" value={draft?.make ?? ''} onChange={(v) => setDraftField('make', v)} />
          <EditField label="Model" value={draft?.model ?? ''} onChange={(v) => setDraftField('model', v)} />
          <EditField label="Year" value={draft?.year != null ? String(draft.year) : ''} onChange={(v) =>
            setDraft((prev) => prev ? { ...prev, year: v ? parseInt(v, 10) || null : null } : prev)
          } keyboardType="numeric" />
          <EditField label="Trim" value={draft?.trim ?? ''} onChange={(v) => setDraftField('trim', v)} />
          <EditField label="Engine" value={draft?.engine ?? ''} onChange={(v) => setDraftField('engine', v)} />
          <EditField label="Body Style" value={draft?.body_style ?? ''} onChange={(v) => setDraftField('body_style', v)} />

          <View style={styles.actions}>
            <Pressable onPress={saveEdit} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Save &amp; Confirm</Text>
            </Pressable>
            <Pressable onPress={() => setEditModalVisible(false)} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !value && styles.rowEmpty]}>{value ?? '—'}</Text>
    </View>
  )
}

function EditField({
  label,
  value,
  onChange,
  keyboardType = 'default',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  keyboardType?: 'default' | 'numeric'
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={styles.input}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#57606a"
      />
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  modalContainer: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 4,
  },
  vinMono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#57606a',
    marginBottom: 20,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f7f8fa',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rowLabel: {
    fontSize: 13,
    color: '#57606a',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    color: '#1f2328',
    fontWeight: '400',
    flexShrink: 1,
    textAlign: 'right',
  },
  rowEmpty: {
    color: '#57606a',
    fontStyle: 'italic',
  },
  actions: {
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
  errorText: {
    color: '#c05621',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2f855a',
    marginBottom: 8,
  },
  editField: {
    marginBottom: 16,
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
    marginTop: 4,
  },
})
