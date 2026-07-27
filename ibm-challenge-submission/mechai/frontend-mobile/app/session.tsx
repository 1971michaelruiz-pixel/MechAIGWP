/**
 * SessionWorkflowScreen — full session state-machine for the MechAI mobile app.
 *
 * Creates a new session on mount via POST /api/sessions, then guides the
 * mechanic through VIN identification, customer assignment, symptom intake,
 * inspection findings, diagnosis, and completion — advancing the backend state
 * at each step via PATCH /api/sessions/{id}.
 *
 * Provides a "Resume session" input at the top to restore an in-progress
 * session and jump directly to its current step.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type SessionState =
  | 'listening'
  | 'vin_capture'
  | 'customer_assign'
  | 'symptom_intake'
  | 'inspection_intake'
  | 'diagnosing'
  | 'complete'

type VehicleData = {
  id?: string
  vin: string
  make: string | null
  model: string | null
  year: number | null
  trim?: string | null
  engine?: string | null
  body_style?: string | null
}

type CustomerSummary = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  email?: string
}

type SolutionItem = {
  rank: number
  description: string
  source_citation: string
  labor_hours: number | null
  confidence_score: number
}

const STATE_ORDER: SessionState[] = [
  'listening',
  'vin_capture',
  'customer_assign',
  'symptom_intake',
  'inspection_intake',
  'diagnosing',
  'complete',
]

const STEP_PILLS: { state: SessionState; label: string }[] = [
  { state: 'vin_capture', label: 'VIN' },
  { state: 'customer_assign', label: 'Customer' },
  { state: 'symptom_intake', label: 'Symptoms' },
  { state: 'inspection_intake', label: 'Findings' },
  { state: 'diagnosing', label: 'Diagnosis' },
  { state: 'complete', label: 'Done' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function SessionWorkflowScreen() {
  const router = useRouter()

  // ── Session ───────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>('listening')
  const [resumeInput, setResumeInput] = useState('')
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [patchError, setPatchError] = useState<string | null>(null)

  // ── Step data ─────────────────────────────────────────────────────────────
  const [manualVin, setManualVin] = useState('')
  const [decoding, setDecoding] = useState(false)
  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([])
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [assignedCustomer, setAssignedCustomer] = useState<CustomerSummary | null>(null)

  const [symptomText, setSymptomText] = useState('')
  const [findingsText, setFindingsText] = useState('')
  const [savingRecord, setSavingRecord] = useState(false)
  const [savedTags, setSavedTags] = useState<string[]>([])

  const [diagnosing, setDiagnosing] = useState(false)
  const [solutions, setSolutions] = useState<SolutionItem[]>([])
  const [diagError, setDiagError] = useState<string | null>(null)

  // ── Create session on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { id: string; state: SessionState }) => {
        setSessionId(data.id)
        setSessionState('vin_capture')
      })
      .catch(() => {/* session creation failure is silent — user can resume */})
  }, [])

  // ── PATCH helper ──────────────────────────────────────────────────────────
  const patch = useCallback(
    async (state: SessionState, extra: Record<string, string | null | undefined> = {}) => {
      if (!sessionId) return false
      setPatchError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, ...extra }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSessionState(state)
        return true
      } catch {
        setPatchError('Could not advance session. Check connectivity.')
        return false
      }
    },
    [sessionId],
  )

  // ── Resume ────────────────────────────────────────────────────────────────
  async function handleResume() {
    const id = resumeInput.trim()
    if (!id) return
    setResumeError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`)
      if (!res.ok) throw new Error('Session not found.')
      const data = await res.json()
      setSessionId(data.id)
      setSessionState(data.state as SessionState)
      setVehicleId(data.vehicle_id ?? null)
      setResumeInput('')
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Resume failed.')
    }
  }

  // ── Step 1: Decode VIN ────────────────────────────────────────────────────
  async function handleDecodeVin() {
    if (manualVin.trim().length !== 17) return
    setDecoding(true)
    setDecodeError(null)
    setVehicle(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: manualVin.trim().toUpperCase() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: VehicleData = await res.json()
      setVehicle(data)
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Decode failed.')
    } finally {
      setDecoding(false)
    }
  }

  async function handleConfirmVehicle() {
    if (!vehicle || !sessionId) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicle),
      })
      if (res.ok) {
        const saved: VehicleData = await res.json()
        if (saved.id) setVehicleId(saved.id)
        await patch('customer_assign', { vehicle_id: saved.id })
      }
    } catch {/* non-blocking */}
  }

  // ── Step 2: Customer search ───────────────────────────────────────────────
  const handleCustomerSearch = useCallback(async (q: string) => {
    setCustomerQuery(q)
    if (!q.trim()) { setCustomerResults([]); return }
    setSearchingCustomer(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/customers/search?q=${encodeURIComponent(q.trim())}`,
      )
      if (res.ok) setCustomerResults(await res.json())
    } finally {
      setSearchingCustomer(false)
    }
  }, [])

  async function handleSelectCustomer(c: CustomerSummary) {
    if (!vehicleId) return
    setAssignedCustomer(c)
    await fetch(`${API_BASE_URL}/api/customer-vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: c.id, vehicle_id: vehicleId }),
    }).catch(() => {})
    await patch('symptom_intake', { customer_id: c.id })
  }

  // ── Step 3: Symptoms → navigate to voice screen ───────────────────────────
  function handleOpenVoiceForSymptoms() {
    // Navigate to the existing voice screen; on completion the mechanic
    // pastes the transcript back in the text area and taps "Next".
    router.push('/voice')
  }

  async function handleSymptomNext() {
    if (!symptomText.trim()) return
    await patch('inspection_intake')
  }

  // ── Step 4: Findings → save service record ────────────────────────────────
  async function handleSaveRecord() {
    if (!vehicleId || !findingsText.trim()) return
    setSavingRecord(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          presented_symptoms: symptomText || null,
          inspection_findings: findingsText,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const saved = await res.json()
      setSavedTags(saved.symptom_tags ?? [])
      await patch('diagnosing', { service_record_id: saved.id })
    } catch {/* non-blocking */} finally {
      setSavingRecord(false)
    }
  }

  // ── Step 5: Run diagnosis ─────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState !== 'diagnosing' || !vehicle?.vin) return
    setDiagnosing(true)
    setDiagError(null)
    fetch(`${API_BASE_URL}/api/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: vehicle.vin, symptom_tags: savedTags }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: SolutionItem[]) => { setSolutions(data); setDiagnosing(false) })
      .catch(() => { setDiagError('Diagnosis failed.'); setDiagnosing(false) })
  }, [sessionState, vehicle?.vin, savedTags])

  async function handleMarkComplete() {
    await patch('complete')
  }

  // ── Step 6: Download PDF ──────────────────────────────────────────────────
  function handleDownloadPdf() {
    if (!sessionId) return
    Linking.openURL(`${API_BASE_URL}/api/sessions/${sessionId}/pdf`)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const currentIdx = STATE_ORDER.indexOf(sessionState)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>MechAI Session</Text>

      {/* Session ID badge */}
      {sessionId ? (
        <Text style={styles.sessionBadge}>
          {sessionId.slice(0, 8)}…
        </Text>
      ) : null}

      {/* Resume input */}
      <View style={styles.resumeRow}>
        <TextInput
          value={resumeInput}
          onChangeText={setResumeInput}
          placeholder="Resume session ID…"
          placeholderTextColor="#57606a"
          style={[styles.resumeInput]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={handleResume} style={styles.resumeBtn} disabled={!resumeInput.trim()}>
          <Text style={styles.resumeBtnText}>Resume</Text>
        </Pressable>
      </View>
      {resumeError ? <Text style={styles.errorText}>{resumeError}</Text> : null}
      {patchError ? <Text style={styles.errorText}>{patchError}</Text> : null}

      {/* Step pills */}
      {sessionState !== 'listening' && (
        <View style={styles.pillRow}>
          {STEP_PILLS.map((p) => {
            const stateIdx = STATE_ORDER.indexOf(p.state)
            const done = stateIdx < currentIdx
            const active = p.state === sessionState
            return (
              <View
                key={p.state}
                style={[
                  styles.pill,
                  active && styles.pillActive,
                  done && styles.pillDone,
                ]}
              >
                <Text style={[styles.pillText, (active || done) && styles.pillTextActive]}>
                  {done ? '✓' : p.label}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {/* ── Step 1: VIN Capture ─────────────────────────────────────────────── */}
      {sessionState === 'vin_capture' && (
        <StepSection title="Identify Vehicle">
          <Text style={styles.hint}>Enter or speak the VIN to decode the vehicle.</Text>
          <TextInput
            value={manualVin}
            onChangeText={(v) => setManualVin(v.toUpperCase())}
            placeholder="17-character VIN"
            placeholderTextColor="#57606a"
            maxLength={17}
            autoCapitalize="characters"
            style={styles.vinInput}
          />
          <Pressable
            onPress={handleDecodeVin}
            disabled={manualVin.trim().length !== 17 || decoding}
            style={[styles.btnPrimary, manualVin.trim().length !== 17 && styles.btnDisabled]}
          >
            {decoding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Decode VIN</Text>
            )}
          </Pressable>

          {decodeError ? <Text style={styles.errorText}>{decodeError}</Text> : null}

          {vehicle && (
            <View style={styles.vehicleCard}>
              <VehicleRow label="VIN" value={vehicle.vin} />
              <VehicleRow label="Make" value={vehicle.make} />
              <VehicleRow label="Model" value={vehicle.model} />
              <VehicleRow label="Year" value={vehicle.year != null ? String(vehicle.year) : null} />
              <VehicleRow label="Trim" value={vehicle.trim} />
              <Pressable onPress={handleConfirmVehicle} style={[styles.btnPrimary, { marginTop: 12 }]}>
                <Text style={styles.btnPrimaryText}>Confirm Vehicle →</Text>
              </Pressable>
            </View>
          )}
        </StepSection>
      )}

      {/* ── Step 2: Customer Assign ─────────────────────────────────────────── */}
      {sessionState === 'customer_assign' && (
        <StepSection title="Assign Customer">
          {assignedCustomer ? (
            <Text style={styles.successText}>
              ✓ Assigned: {assignedCustomer.first_name} {assignedCustomer.last_name}
            </Text>
          ) : (
            <>
              <TextInput
                value={customerQuery}
                onChangeText={handleCustomerSearch}
                placeholder="Search by name or phone…"
                placeholderTextColor="#57606a"
                style={styles.searchInput}
                autoFocus
              />
              {searchingCustomer && <ActivityIndicator color="#3b82d4" />}
              <FlatList
                data={customerResults}
                keyExtractor={(c) => c.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable onPress={() => handleSelectCustomer(item)} style={styles.resultRow}>
                    <Text style={styles.resultName}>
                      {item.first_name} {item.last_name}
                    </Text>
                    {item.phone ? <Text style={styles.resultPhone}>{item.phone}</Text> : null}
                  </Pressable>
                )}
              />
            </>
          )}
        </StepSection>
      )}

      {/* ── Step 3: Symptom Intake ──────────────────────────────────────────── */}
      {sessionState === 'symptom_intake' && (
        <StepSection title="Presented Symptoms">
          <Text style={styles.hint}>Describe what the customer reported.</Text>
          <TextInput
            value={symptomText}
            onChangeText={setSymptomText}
            placeholder="Customer complaint…"
            placeholderTextColor="#57606a"
            multiline
            numberOfLines={5}
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Pressable onPress={handleOpenVoiceForSymptoms} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>Open Voice Capture</Text>
          </Pressable>
          <Pressable
            onPress={handleSymptomNext}
            disabled={!symptomText.trim()}
            style={[styles.btnPrimary, !symptomText.trim() && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>Next →</Text>
          </Pressable>
        </StepSection>
      )}

      {/* ── Step 4: Inspection Findings ─────────────────────────────────────── */}
      {sessionState === 'inspection_intake' && (
        <StepSection title="Inspection Findings">
          {symptomText ? (
            <View style={styles.recap}>
              <Text style={styles.recapLabel}>✓ Symptoms</Text>
              <Text style={styles.recapText}>{symptomText}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>Describe what you found during inspection.</Text>
          <TextInput
            value={findingsText}
            onChangeText={setFindingsText}
            placeholder="Inspection findings…"
            placeholderTextColor="#57606a"
            multiline
            numberOfLines={5}
            style={styles.textArea}
            textAlignVertical="top"
          />
          {savingRecord ? (
            <ActivityIndicator color="#3b82d4" style={{ marginTop: 12 }} />
          ) : (
            <Pressable
              onPress={handleSaveRecord}
              disabled={!findingsText.trim()}
              style={[styles.btnPrimary, !findingsText.trim() && styles.btnDisabled]}
            >
              <Text style={styles.btnPrimaryText}>Save &amp; Run Diagnosis →</Text>
            </Pressable>
          )}
        </StepSection>
      )}

      {/* ── Step 5: Diagnosing ──────────────────────────────────────────────── */}
      {sessionState === 'diagnosing' && (
        <StepSection title="Diagnosis">
          {savedTags.length > 0 && (
            <View style={styles.tagRow}>
              {savedTags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {diagnosing && <ActivityIndicator color="#3b82d4" style={{ marginTop: 12 }} />}
          {diagError ? <Text style={styles.errorText}>{diagError}</Text> : null}
          {solutions.map((sol) => (
            <View key={sol.rank} style={styles.solutionCard}>
              <Text style={styles.solutionTitle}>
                {sol.rank}. {sol.description}
              </Text>
              <Text style={styles.solutionMeta}>
                {sol.source_citation}
                {sol.labor_hours != null ? ` · ${sol.labor_hours} hrs` : ''}
                {` · ${Math.round(sol.confidence_score * 100)}%`}
              </Text>
            </View>
          ))}
          {!diagnosing && (
            <Pressable onPress={handleMarkComplete} style={[styles.btnPrimary, { marginTop: 16 }]}>
              <Text style={styles.btnPrimaryText}>Mark Complete ✓</Text>
            </Pressable>
          )}
        </StepSection>
      )}

      {/* ── Step 6: Complete ────────────────────────────────────────────────── */}
      {sessionState === 'complete' && (
        <StepSection title="Session Complete">
          <Text style={styles.successText}>✓ Session completed successfully.</Text>

          {vehicle && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>Vehicle</Text>
              <VehicleRow label="VIN" value={vehicle.vin} />
              <VehicleRow label="Make / Model" value={`${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()} />
            </View>
          )}

          {assignedCustomer && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>Customer</Text>
              <Text style={styles.summaryField}>
                {assignedCustomer.first_name} {assignedCustomer.last_name}
              </Text>
              {assignedCustomer.phone ? (
                <Text style={styles.summaryMuted}>{assignedCustomer.phone}</Text>
              ) : null}
            </View>
          )}

          {savedTags.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>Symptom Tags</Text>
              <View style={styles.tagRow}>
                {savedTags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {solutions.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>Top Diagnosis</Text>
              <Text style={styles.summaryField}>{solutions[0].description}</Text>
              <Text style={styles.summaryMuted}>
                {solutions[0].source_citation}
                {solutions[0].labor_hours != null ? ` · ${solutions[0].labor_hours} hrs` : ''}
              </Text>
            </View>
          )}

          <Pressable onPress={handleDownloadPdf} style={[styles.btnPrimary, { marginTop: 8 }]}>
            <Text style={styles.btnPrimaryText}>Download PDF Report</Text>
          </Pressable>
        </StepSection>
      )}
    </ScrollView>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.stepSection}>
      <Text style={styles.stepTitle}>{title}</Text>
      {children}
    </View>
  )
}

function VehicleRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.vehicleRow}>
      <Text style={styles.vehicleLabel}>{label}</Text>
      <Text style={[styles.vehicleValue, !value && styles.emptyValue]}>{value ?? '—'}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 4,
  },
  sessionBadge: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#57606a',
    marginBottom: 12,
  },
  resumeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  resumeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
  },
  resumeBtn: {
    backgroundColor: '#3b82d4',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  resumeBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  errorText: {
    color: '#c05621',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  successText: {
    color: '#2f855a',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 12,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#3b82d4',
    borderColor: '#3b82d4',
  },
  pillDone: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  pillText: {
    fontSize: 11,
    color: '#57606a',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stepSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: '#57606a',
    marginBottom: 10,
    lineHeight: 18,
  },
  vinInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
    letterSpacing: 2,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  vehicleCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f7f8fa',
    overflow: 'hidden',
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vehicleLabel: {
    fontSize: 12,
    color: '#57606a',
    fontWeight: '500',
  },
  vehicleValue: {
    fontSize: 12,
    color: '#1f2328',
    flexShrink: 1,
    textAlign: 'right',
  },
  emptyValue: {
    color: '#57606a',
    fontStyle: 'italic',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
    marginBottom: 8,
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2328',
  },
  resultPhone: {
    fontSize: 12,
    color: '#57606a',
    marginTop: 2,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
    minHeight: 100,
    marginBottom: 10,
  },
  recap: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    opacity: 0.85,
  },
  recapLabel: {
    fontSize: 11,
    color: '#57606a',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recapText: {
    fontSize: 12,
    color: '#57606a',
    lineHeight: 17,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '500',
  },
  solutionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f7f8fa',
  },
  solutionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2328',
    lineHeight: 18,
  },
  solutionMeta: {
    fontSize: 11,
    color: '#57606a',
    marginTop: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f7f8fa',
  },
  summaryHeading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#57606a',
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryField: {
    fontSize: 13,
    color: '#1f2328',
    fontWeight: '500',
  },
  summaryMuted: {
    fontSize: 12,
    color: '#57606a',
    marginTop: 2,
  },
  btnPrimary: {
    backgroundColor: '#3b82d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSecondaryText: {
    color: '#1f2328',
    fontWeight: '500',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
})
