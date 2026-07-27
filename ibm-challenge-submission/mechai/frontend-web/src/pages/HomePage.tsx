import { useState } from 'react'
import VoiceCaptureButton from '../components/VoiceCaptureButton'
import VehicleConfirmationCard, { VehicleData } from '../components/VehicleConfirmationCard'
import CustomerSearchPanel, { CustomerSummary } from '../components/CustomerSearchPanel'
import TwoPhaseVoiceCapture from '../components/TwoPhaseVoiceCapture'
import VehicleHistoryTimeline from '../components/VehicleHistoryTimeline'
import DiagnosisPanel from '../components/DiagnosisPanel'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type DecodeState = 'idle' | 'decoding' | 'decoded' | 'error'
type RecordState = 'idle' | 'saving' | 'saved' | 'error'

export default function HomePage() {
  const [transcript, setTranscript] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [decodeState, setDecodeState] = useState<DecodeState>('idle')
  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [confirmedVehicleId, setConfirmedVehicleId] = useState<string | null>(null)
  const [assignedCustomer, setAssignedCustomer] = useState<CustomerSummary | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [manualVin, setManualVin] = useState('')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordError, setRecordError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [savedSymptomTags, setSavedSymptomTags] = useState<string[]>([])

  // ── Decode helper ──────────────────────────────────────────────────────────
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
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      const data: VehicleData = await res.json()
      setVehicle(data)
      setDecodeState('decoded')
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Decode failed.')
      setDecodeState('error')
    }
  }

  // ── Transcript callback from VoiceCaptureButton ────────────────────────────
  function handleTranscript(text: string, sid: string) {
    setTranscript(text)
    setSessionId(sid)
    decodeFromPayload({ transcript: text })
  }

  // ── Confirm / Edit callbacks ───────────────────────────────────────────────
  function handleConfirm(v: VehicleData) {
    fetch(`${API_BASE_URL}/api/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.id) setConfirmedVehicleId(data.id) })
      .catch(() => {/* fire-and-forget on error */})
  }

  // ── Customer selection after vehicle confirm ───────────────────────────────
  async function handleCustomerSelect(customer: CustomerSummary) {
    if (!confirmedVehicleId) return
    setAssignedCustomer(customer)
    await fetch(`${API_BASE_URL}/api/customer-vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, vehicle_id: confirmedVehicleId }),
    }).catch(() => {/* fire-and-forget */})
  }

  function handleEdit(v: VehicleData) {
    void v
  }

  // ── Manual VIN submit ──────────────────────────────────────────────────────
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (manualVin.trim().length === 17) {
      decodeFromPayload({ vin: manualVin.trim().toUpperCase() })
    }
  }

  // ── Two-phase voice capture complete ──────────────────────────────────────
  async function handleServiceRecordComplete(presented: string, findings: string) {
    if (!confirmedVehicleId) return
    setRecordState('saving')
    setRecordError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: confirmedVehicleId,
          presented_symptoms: presented,
          inspection_findings: findings,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      const saved = await res.json()
      setSavedSymptomTags(saved?.symptom_tags ?? [])
      setRecordState('saved')
      setShowHistory(true)
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Failed to save record.')
      setRecordState('error')
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>MechAI</h1>
      <p style={{ marginTop: '0.75rem', color: '#57606a' }}>
        Hold the button below and describe what you're hearing from the vehicle.
      </p>

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <VoiceCaptureButton onTranscript={handleTranscript} />

        {/* Transcript display */}
        {transcript && (
          <div
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f7f8fa',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#57606a', marginBottom: '0.25rem' }}>
              Transcript — session <code>{sessionId}</code>
            </p>
            <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>{transcript}</p>
          </div>
        )}

        {/* VIN decode result */}
        {decodeState === 'decoding' && (
          <VehicleConfirmationCard vehicle={null} onConfirm={handleConfirm} onEdit={handleEdit} />
        )}

        {decodeState === 'decoded' && vehicle && (
          <VehicleConfirmationCard vehicle={vehicle} onConfirm={handleConfirm} onEdit={handleEdit} />
        )}

        {/* Customer assignment — shown once the vehicle has been confirmed */}
        {confirmedVehicleId && !assignedCustomer && (
          <CustomerSearchPanel onSelect={handleCustomerSelect} apiBaseUrl={API_BASE_URL} />
        )}

        {assignedCustomer && (
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f0fdf4',
              fontSize: '0.9rem',
              color: '#1f2328',
            }}
          >
            ✓ Assigned to{' '}
            <strong>{assignedCustomer.first_name} {assignedCustomer.last_name}</strong>
          </div>
        )}

        {/* Two-phase voice capture — shown after customer is assigned */}
        {assignedCustomer && recordState === 'idle' && (
          <TwoPhaseVoiceCapture
            onComplete={handleServiceRecordComplete}
            apiBaseUrl={API_BASE_URL}
          />
        )}

        {/* Saving indicator */}
        {recordState === 'saving' && (
          <p style={{ fontSize: '0.875rem', color: '#57606a' }}>Saving service record…</p>
        )}

        {/* Save error */}
        {recordState === 'error' && recordError && (
          <p style={{ fontSize: '0.875rem', color: '#c05621' }}>{recordError}</p>
        )}

        {/* Service history timeline — shown after record is saved */}
        {showHistory && vehicle?.vin && (
          <div style={{ width: '100%', marginTop: '0.5rem' }}>
            <VehicleHistoryTimeline vin={vehicle.vin} apiBaseUrl={API_BASE_URL} />
          </div>
        )}

        {/* Diagnosis panel — shown after history timeline */}
        {showHistory && vehicle?.vin && (
          <div style={{ width: '100%' }}>
            <DiagnosisPanel
              vin={vehicle.vin}
              symptomTags={savedSymptomTags}
              apiBaseUrl={API_BASE_URL}
            />
          </div>
        )}

        {/* No VIN found — offer manual entry */}
        {decodeState === 'error' && (
          <div
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff8f0',
            }}
          >
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#c05621' }}>
              {decodeError}
            </p>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Enter VIN manually (17 chars)"
                maxLength={17}
                value={manualVin}
                onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.7rem',
                  fontSize: '0.9rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              />
              <button
                type="submit"
                disabled={manualVin.trim().length !== 17}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#3b82d4',
                  color: '#fff',
                  cursor: manualVin.trim().length === 17 ? 'pointer' : 'not-allowed',
                  opacity: manualVin.trim().length === 17 ? 1 : 0.5,
                }}
              >
                Decode
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
