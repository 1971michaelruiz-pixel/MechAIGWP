/**
 * VehicleHistoryTimeline — fetches and renders the full service history for a vehicle.
 *
 * Props:
 *   vin        — 17-character VIN used to query GET /api/vehicles/{vin}/history
 *   apiBaseUrl — base URL for the MechAI API (defaults to VITE_API_BASE_URL)
 */

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ServiceRecord = {
  id: string
  vehicle_id: string
  shop_id: string | null
  mechanic_id: string | null
  visit_date: string
  presented_symptoms: string | null
  inspection_findings: string | null
  symptom_tags: string[] | null
  created_at: string
}

type LoadState = 'loading' | 'loaded' | 'error'

// ── Sub-components ─────────────────────────────────────────────────────────────

function SymptomTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.55rem',
        borderRadius: 12,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        backgroundColor: '#eef3fb',
        color: '#3b82d4',
        border: '1px solid #c8d9f5',
        marginRight: '0.35rem',
        marginBottom: '0.35rem',
        textTransform: 'lowercase' as const,
      }}
    >
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function RecordCard({ record }: { record: ServiceRecord }) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(record.visit_date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const hasTags = record.symptom_tags && record.symptom_tags.length > 0
  const hasText = record.presented_symptoms || record.inspection_findings

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        backgroundColor: '#f7f8fa',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}
    >
      {/* Date header */}
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#57606a', fontWeight: 500 }}>
        {date}
      </p>

      {/* Symptom tag pills */}
      {hasTags ? (
        <div style={{ marginBottom: hasText ? '0.5rem' : 0 }}>
          {record.symptom_tags!.map((tag) => (
            <SymptomTag key={tag} label={tag} />
          ))}
        </div>
      ) : (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#57606a', fontStyle: 'italic' }}>
          No tags extracted
        </p>
      )}

      {/* Expandable raw text */}
      {hasText && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.78rem',
              color: '#3b82d4',
              fontWeight: 500,
            }}
          >
            {expanded ? '▲ Hide details' : '▼ Show details'}
          </button>

          {expanded && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {record.presented_symptoms && (
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Presented symptoms
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.55, color: '#1f2328' }}>
                    {record.presented_symptoms}
                  </p>
                </div>
              )}
              {record.inspection_findings && (
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Inspection findings
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.55, color: '#1f2328' }}>
                    {record.inspection_findings}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export type VehicleHistoryTimelineProps = {
  vin: string
  apiBaseUrl?: string
}

export default function VehicleHistoryTimeline({
  vin,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
}: VehicleHistoryTimelineProps) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!vin) return
    setLoadState('loading')
    fetch(`${apiBaseUrl}/api/vehicles/${encodeURIComponent(vin)}/history`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ServiceRecord[]>
      })
      .then((data) => {
        setRecords(data)
        setLoadState('loaded')
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load history.')
        setLoadState('error')
      })
  }, [vin, apiBaseUrl])

  return (
    <div style={{ width: '100%' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1f2328' }}>
        Service History
      </h3>

      {loadState === 'loading' && (
        <p style={{ fontSize: '0.875rem', color: '#57606a' }}>Loading history…</p>
      )}

      {loadState === 'error' && (
        <p style={{ fontSize: '0.875rem', color: '#c05621' }}>{errorMsg}</p>
      )}

      {loadState === 'loaded' && records.length === 0 && (
        <p style={{ fontSize: '0.875rem', color: '#57606a', fontStyle: 'italic' }}>
          No service history yet.
        </p>
      )}

      {loadState === 'loaded' && records.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {records.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {/* Timeline connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.9rem' }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: '#3b82d4',
                    flexShrink: 0,
                  }}
                />
              </div>
              <RecordCard record={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
