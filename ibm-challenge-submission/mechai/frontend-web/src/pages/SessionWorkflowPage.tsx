import { useState, useEffect } from 'react'
import VoiceCaptureButton from '../components/VoiceCaptureButton'
import VehicleConfirmationCard, { VehicleData } from '../components/VehicleConfirmationCard'
import CustomerSearchPanel, { CustomerSummary } from '../components/CustomerSearchPanel'
import DiagnosisPanel from '../components/DiagnosisPanel'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// ── State machine types ────────────────────────────────────────────────────────

type SessionState =
  | 'listening'
  | 'vin_capture'
  | 'customer_assign'
  | 'symptom_intake'
  | 'inspection_intake'
  | 'diagnosing'
  | 'complete'

type DecodeState = 'idle' | 'decoding' | 'decoded' | 'error'

const STEP_LABELS: { state: SessionState; label: string }[] = [
  { state: 'vin_capture', label: 'VIN' },
  { state: 'customer_assign', label: 'Customer' },
  { state: 'symptom_intake', label: 'Symptoms' },
  { state: 'inspection_intake', label: 'Findings' },
  { state: 'diagnosing', label: 'Diagnosis' },
  { state: 'complete', label: 'Complete' },
]

const STATE_ORDER: SessionState[] = [
  'listening',
  'vin_capture',
  'customer_assign',
  'symptom_intake',
  'inspection_intake',
  'diagnosing',
  'complete',
]

// ── Summary sub-component ──────────────────────────────────────────────────────

function SessionSummary({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => { setSummary(data); setLoading(false) })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load summary.')
        setLoading(false)
      })
  }, [sessionId])

  if (loading) return <p style={styles.muted}>Loading summary…</p>
  if (error) return <p style={{ color: '#c05621', fontSize: '0.875rem' }}>{error}</p>
  if (!summary) return null

  const sess = summary.session as Record<string, unknown> | null
  const vehicle = summary.vehicle as Record<string, unknown> | null
  const customer = summary.customer as Record<string, unknown> | null
  const svc = summary.service_record as Record<string, unknown> | null
  const diagnosis = summary.diagnosis as Array<Record<string, unknown>> | null

  return (
    <div style={styles.card}>
      <p style={styles.meta}>
        Session <code style={styles.code}>{String(sess?.id ?? '').slice(0, 8)}…</code>
        &nbsp;·&nbsp;{String(sess?.created_at ?? '').slice(0, 10)}
      </p>

      {vehicle && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Vehicle</h3>
          <p style={styles.row}><span style={styles.label}>VIN</span> {String(vehicle.vin)}</p>
          <p style={styles.row}><span style={styles.label}>Make / Model</span>
            {`${vehicle.year ?? '—'} ${vehicle.make ?? '—'} ${vehicle.model ?? '—'}`}
          </p>
          {vehicle.trim && (
            <p style={styles.row}><span style={styles.label}>Trim</span> {String(vehicle.trim)}</p>
          )}
        </section>
      )}

      {customer && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Customer</h3>
          <p style={styles.row}>
            <span style={styles.label}>Name</span>
            {`${customer.first_name} ${customer.last_name}`}
          </p>
          {customer.phone && (
            <p style={styles.row}><span style={styles.label}>Phone</span> {String(customer.phone)}</p>
          )}
          {customer.email && (
            <p style={styles.row}><span style={styles.label}>Email</span> {String(customer.email)}</p>
          )}
        </section>
      )}

      {svc && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Service Record</h3>
          {svc.presented_symptoms && (
            <>
              <p style={styles.label}>Presented symptoms</p>
              <p style={styles.bodyText}>{String(svc.presented_symptoms)}</p>
            </>
          )}
          {svc.inspection_findings && (
            <>
              <p style={styles.label}>Inspection findings</p>
              <p style={styles.bodyText}>{String(svc.inspection_findings)}</p>
            </>
          )}
          {Array.isArray(svc.symptom_tags) && svc.symptom_tags.length > 0 && (
            <p style={styles.row}>
              <span style={styles.label}>Tags</span>{' '}
              {(svc.symptom_tags as string[]).map((t) => (
                <span key={t} style={styles.tag}>{t}</span>
              ))}
            </p>
          )}
        </section>
      )}

      {diagnosis && diagnosis.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Diagnosis Solutions</h3>
          {diagnosis.map((sol) => (
            <div key={String(sol.rank)} style={styles.solutionCard}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                {sol.rank}. {String(sol.description)}
              </p>
              <p style={styles.meta}>
                {String(sol.source_citation)}
                {sol.labor_hours != null && ` · ${sol.labor_hours} hrs`}
                {` · ${Math.round(Number(sol.confidence_score) * 100)}% confidence`}
              </p>
            </div>
          ))}
        </section>
      )}

      <a
        href={`${API_BASE_URL}/api/sessions/${sessionId}/pdf`}
        target="_blank"
        rel="noreferrer"
        style={styles.pdfLink}
      >
        Download PDF Report
      </a>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SessionWorkflowPage() {
  // ── Session management ──────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>('listening')
  const [resumeInput, setResumeInput] = useState('')
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // ── Step-level state ────────────────────────────────────────────────────────
  const [decodeState, setDecodeState] = useState<DecodeState>('idle')
  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [manualVin, setManualVin] = useState('')

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [assignedCustomer, setAssignedCustomer] = useState<CustomerSummary | null>(null)

  const [symptomTranscript, setSymptomTranscript] = useState<string | null>(null)
  const [findingsTranscript, setFindingsTranscript] = useState<string | null>(null)
  const [serviceRecordId, setServiceRecordId] = useState<string | null>(null)
  const [savingRecord, setSavingRecord] = useState(false)
  const [savedSymptomTags, setSavedSymptomTags] = useState<string[]>([])

  const [patchError, setPatchError] = useState<string | null>(null)

  // ── Create session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setCreating(true)
    fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        setSessionId(data.id)
        setSessionState('vin_capture')
        setCreating(false)
      })
      .catch(() => setCreating(false))
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function patch(
    id: string,
    state: SessionState,
    extra: Record<string, string | null | undefined> = {},
  ): Promise<boolean> {
    setPatchError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      setSessionState(state)
      return true
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Request failed.')
      return false
    }
  }

  async function decodeFromPayload(body: { transcript?: string; vin?: string }) {
    setDecodeState('decoding')
    setDecodeError(null)
    setVehicle(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      const data: VehicleData = await res.json()
      setVehicle(data)
      setDecodeState('decoded')
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Decode failed.')
      setDecodeState('error')
    }
  }

  // ── Resume session ──────────────────────────────────────────────────────────
  async function handleResume(e: React.FormEvent) {
    e.preventDefault()
    const id = resumeInput.trim()
    if (!id) return
    setResumeError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`)
      if (!res.ok) throw new Error(`Session not found.`)
      const data = await res.json()
      setSessionId(data.id)
      setSessionState(data.state as SessionState)
      setVehicleId(data.vehicle_id ?? null)
      setCustomerId(data.customer_id ?? null)
      setServiceRecordId(data.service_record_id ?? null)
      setResumeInput('')
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Resume failed.')
    }
  }

  // ── Step 1: VIN capture ─────────────────────────────────────────────────────
  async function handleVinTranscript(text: string) {
    await decodeFromPayload({ transcript: text })
  }

  async function handleConfirmVehicle(v: VehicleData) {
    if (!sessionId) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const saved = await res.json()
      const vid: string = saved.id
      setVehicleId(vid)
      await patch(sessionId, 'customer_assign', { vehicle_id: vid })
    } catch {/* vehicle error is non-blocking for session advance */}
  }

  function handleManualVinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (manualVin.trim().length === 17) {
      void decodeFromPayload({ vin: manualVin.trim().toUpperCase() })
    }
  }

  // ── Step 2: Customer assign ─────────────────────────────────────────────────
  async function handleCustomerSelect(customer: CustomerSummary) {
    if (!sessionId || !vehicleId) return
    setAssignedCustomer(customer)
    setCustomerId(customer.id)
    await fetch(`${API_BASE_URL}/api/customer-vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, vehicle_id: vehicleId }),
    }).catch(() => {/* fire-and-forget */})
    await patch(sessionId, 'symptom_intake', { customer_id: customer.id })
  }

  // ── Step 3: Symptom intake ──────────────────────────────────────────────────
  async function handleSymptomTranscript(text: string) {
    if (!sessionId) return
    setSymptomTranscript(text)
    await patch(sessionId, 'inspection_intake')
  }

  // ── Step 4: Inspection intake → save service record ─────────────────────────
  async function handleFindingsTranscript(text: string) {
    if (!sessionId || !vehicleId) return
    setFindingsTranscript(text)
    setSavingRecord(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          presented_symptoms: symptomTranscript,
          inspection_findings: text,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const saved = await res.json()
      const srid: string = saved.id
      setSavedSymptomTags(saved.symptom_tags ?? [])
      setServiceRecordId(srid)
      await patch(sessionId, 'diagnosing', { service_record_id: srid })
    } catch {/* non-blocking */} finally {
      setSavingRecord(false)
    }
  }

  // ── Step 5: Mark complete ───────────────────────────────────────────────────
  async function handleMarkComplete() {
    if (!sessionId) return
    await patch(sessionId, 'complete')
  }

  // ── Step indicator ──────────────────────────────────────────────────────────
  const currentStepIdx = STATE_ORDER.indexOf(sessionState)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main style={{ padding: '2rem', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2328', marginBottom: '0.25rem' }}>
        MechAI — Session Workflow
      </h1>

      {/* Resume input */}
      <form onSubmit={handleResume} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Resume session ID…"
          value={resumeInput}
          onChange={(e) => setResumeInput(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
        <button type="submit" disabled={!resumeInput.trim()} style={btnSmallStyle}>
          Resume
        </button>
      </form>
      {resumeError && <p style={{ color: '#c05621', fontSize: '0.8rem', marginBottom: '1rem' }}>{resumeError}</p>}

      {creating && <p style={styles.muted}>Starting session…</p>}

      {sessionId && (
        <p style={{ ...styles.meta, marginBottom: '1.5rem' }}>
          Session <code style={styles.code}>{sessionId.slice(0, 8)}…</code>
        </p>
      )}

      {/* Step indicator bar */}
      {sessionState !== 'listening' && (
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {STEP_LABELS.map((s, i) => {
            const stateIdx = STATE_ORDER.indexOf(s.state)
            const done = stateIdx < currentStepIdx
            const active = s.state === sessionState
            return (
              <div
                key={s.state}
                style={{
                  flex: 1,
                  minWidth: 80,
                  padding: '0.4rem 0.5rem',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: active ? 700 : 400,
                  backgroundColor: active ? '#3b82d4' : done ? '#dbeafe' : '#f7f8fa',
                  color: active ? '#fff' : done ? '#1e40af' : '#57606a',
                  border: `1px solid ${active ? '#3b82d4' : '#e5e7eb'}`,
                }}
              >
                {done ? '✓ ' : ''}{s.label}
              </div>
            )
          })}
        </div>
      )}

      {patchError && (
        <p style={{ color: '#c05621', fontSize: '0.875rem', marginBottom: '1rem' }}>{patchError}</p>
      )}

      {/* ── Step 1: VIN Capture ─────────────────────────────────────────────── */}
      {sessionState === 'vin_capture' && (
        <StepCard title="Step 1 — Identify Vehicle">
          <p style={styles.muted}>Hold the button and speak the VIN, or enter it manually.</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <VoiceCaptureButton onTranscript={(text) => { void handleVinTranscript(text) }} />

            <form onSubmit={handleManualVinSubmit} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <input
                type="text"
                placeholder="Enter VIN manually (17 chars)"
                maxLength={17}
                value={manualVin}
                onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
              />
              <button
                type="submit"
                disabled={manualVin.trim().length !== 17}
                style={{ ...btnPrimaryStyle, opacity: manualVin.trim().length === 17 ? 1 : 0.5 }}
              >
                Decode
              </button>
            </form>

            {decodeError && (
              <p style={{ color: '#c05621', fontSize: '0.875rem', margin: 0 }}>{decodeError}</p>
            )}

            {decodeState === 'decoding' && (
              <VehicleConfirmationCard vehicle={null} onConfirm={() => {}} onEdit={() => {}} />
            )}

            {decodeState === 'decoded' && vehicle && (
              <VehicleConfirmationCard
                vehicle={vehicle}
                onConfirm={(v) => { void handleConfirmVehicle(v) }}
                onEdit={() => {/* edit handled inside card */}}
              />
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step 2: Customer Assign ─────────────────────────────────────────── */}
      {sessionState === 'customer_assign' && (
        <StepCard title="Step 2 — Assign Customer">
          {assignedCustomer ? (
            <p style={{ color: '#2f855a', fontSize: '0.9rem' }}>
              ✓ Assigned to <strong>{assignedCustomer.first_name} {assignedCustomer.last_name}</strong>
            </p>
          ) : (
            <CustomerSearchPanel onSelect={handleCustomerSelect} apiBaseUrl={API_BASE_URL} />
          )}
        </StepCard>
      )}

      {/* ── Step 3: Symptom Intake ──────────────────────────────────────────── */}
      {sessionState === 'symptom_intake' && (
        <StepCard title="Step 3 — Presented Symptoms">
          <p style={styles.muted}>Hold the button and describe what the customer reported.</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <VoiceCaptureButton
              onTranscript={(text) => { void handleSymptomTranscript(text) }}
            />
            {symptomTranscript && (
              <div style={styles.transcriptCard}>
                <p style={styles.meta}>Symptom transcript</p>
                <p style={{ margin: 0 }}>{symptomTranscript}</p>
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step 4: Inspection Intake ───────────────────────────────────────── */}
      {sessionState === 'inspection_intake' && (
        <StepCard title="Step 4 — Inspection Findings">
          <p style={styles.muted}>Hold the button and describe what you found during inspection.</p>
          {savingRecord && <p style={styles.muted}>Saving service record…</p>}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <VoiceCaptureButton
              onTranscript={(text) => { void handleFindingsTranscript(text) }}
            />
            {findingsTranscript && (
              <div style={styles.transcriptCard}>
                <p style={styles.meta}>Findings transcript</p>
                <p style={{ margin: 0 }}>{findingsTranscript}</p>
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step 5: Diagnosing ──────────────────────────────────────────────── */}
      {sessionState === 'diagnosing' && vehicle && (
        <StepCard title="Step 5 — Diagnosis">
          <DiagnosisPanel
            vin={vehicle.vin}
            symptomTags={savedSymptomTags}
            apiBaseUrl={API_BASE_URL}
          />
          <button
            onClick={() => { void handleMarkComplete() }}
            style={{ ...btnPrimaryStyle, marginTop: '1.5rem', width: '100%' }}
          >
            Mark Session Complete
          </button>
        </StepCard>
      )}

      {/* ── Step 6: Complete ────────────────────────────────────────────────── */}
      {sessionState === 'complete' && sessionId && (
        <StepCard title="Session Complete">
          <p style={{ color: '#2f855a', fontWeight: 600, marginBottom: '1rem' }}>
            ✓ The session has been completed successfully.
          </p>
          <SessionSummary sessionId={sessionId} />
        </StepCard>
      )}
    </main>
  )
}

// ── Step wrapper ───────────────────────────────────────────────────────────────

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1f2328', marginBottom: '1rem' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  muted: { fontSize: '0.875rem', color: '#57606a', margin: '0 0 0.75rem' },
  meta: { fontSize: '0.75rem', color: '#57606a', margin: '0 0 0.25rem' },
  code: { fontFamily: 'monospace', backgroundColor: '#f7f8fa', padding: '0 3px', borderRadius: 3 },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '1.25rem',
    backgroundColor: '#f7f8fa',
  },
  section: { marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.85rem', fontWeight: 700, color: '#1f2328', margin: '0 0 0.5rem' },
  row: { margin: '0.2rem 0', fontSize: '0.875rem', color: '#1f2328' },
  label: { fontSize: '0.75rem', color: '#57606a', marginRight: '0.5rem', display: 'inline-block' },
  bodyText: { fontSize: '0.875rem', color: '#1f2328', lineHeight: 1.6, margin: '0.25rem 0 0.75rem' },
  tag: {
    display: 'inline-block',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: 4,
    padding: '0 6px',
    fontSize: '0.75rem',
    marginRight: 4,
  },
  solutionCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '0.75rem',
    marginBottom: '0.5rem',
    backgroundColor: '#fff',
  },
  transcriptCard: {
    width: '100%',
    padding: '1rem',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    backgroundColor: '#f7f8fa',
    fontSize: '0.9rem',
  },
  pdfLink: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.5rem 1.25rem',
    backgroundColor: '#3b82d4',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
}

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.7rem',
  fontSize: '0.875rem',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  backgroundColor: '#fff',
  color: '#1f2328',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  backgroundColor: '#3b82d4',
  color: '#fff',
  cursor: 'pointer',
}

const btnSmallStyle: React.CSSProperties = {
  ...btnPrimaryStyle,
  padding: '0.4rem 0.85rem',
  fontSize: '0.8rem',
}
