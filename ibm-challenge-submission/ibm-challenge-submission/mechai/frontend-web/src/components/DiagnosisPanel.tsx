/**
 * DiagnosisPanel — runs the MechAI diagnosis engine and displays ranked repair solutions.
 *
 * Props:
 *   vin          — vehicle VIN passed to POST /api/diagnose
 *   symptomTags  — snake_case tags from the saved service record
 *   apiBaseUrl   — defaults to VITE_API_BASE_URL
 *
 * States: idle → loading → loaded (solutions) | empty | error
 */

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SolutionItem = {
  rank: number
  description: string
  source_citation: string
  labor_hours: number | null
  confidence_score: number
}

export type DiagnosisPanelProps = {
  vin: string
  symptomTags: string[]
  apiBaseUrl?: string
}

type PanelState = 'idle' | 'loading' | 'loaded' | 'error'

// ── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  width: '100%',
  padding: '1rem 1.25rem',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#f7f8fa',
}

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#3b82d4',
  color: '#fff',
  lineHeight: 1.4,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        backgroundColor: rank === 1 ? '#3b82d4' : '#e5e7eb',
        color: rank === 1 ? '#fff' : '#57606a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {rank}
    </div>
  )
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100)
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: '#e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: pct >= 70 ? '#3b82d4' : pct >= 40 ? '#7c5cd8' : '#57606a',
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '0.7rem', color: '#57606a' }}>{pct}% confidence</span>
    </div>
  )
}

function SolutionCard({ solution }: { solution: SolutionItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <RankBadge rank={solution.rank} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600, color: '#1f2328', lineHeight: 1.4 }}>
            {solution.description}
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#57606a' }}>
            {solution.source_citation}
            {solution.labor_hours != null && (
              <span style={{ marginLeft: '0.75rem' }}>
                ⏱ {solution.labor_hours} hrs
              </span>
            )}
          </p>
          <ConfidenceBar score={solution.confidence_score} />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DiagnosisPanel({
  vin,
  symptomTags,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
}: DiagnosisPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [solutions, setSolutions] = useState<SolutionItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function runDiagnosis() {
    setPanelState('loading')
    setErrorMsg(null)
    setSolutions([])

    try {
      const res = await fetch(`${apiBaseUrl}/api/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, symptom_tags: symptomTags }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      const data: SolutionItem[] = await res.json()
      setSolutions(data)
      setPanelState('loaded')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Diagnosis failed.')
      setPanelState('error')
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1f2328' }}>
          Diagnosis
        </h3>
        {(panelState === 'idle' || panelState === 'error') && (
          <button onClick={runDiagnosis} style={btnPrimary}>
            Run Diagnosis
          </button>
        )}
        {panelState === 'loaded' && solutions.length > 0 && (
          <button
            onClick={runDiagnosis}
            style={{ ...btnPrimary, backgroundColor: 'transparent', color: '#3b82d4', border: '1px solid #3b82d4' }}
          >
            Re-run
          </button>
        )}
      </div>

      {panelState === 'idle' && (
        <div style={{ ...cardStyle, color: '#57606a', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Press "Run Diagnosis" to match symptoms against repair data.
        </div>
      )}

      {panelState === 'loading' && (
        <div style={{ ...cardStyle, color: '#57606a', fontSize: '0.875rem' }}>
          Analysing symptoms…
        </div>
      )}

      {panelState === 'error' && (
        <div style={{ ...cardStyle, color: '#c05621', fontSize: '0.875rem' }}>
          {errorMsg}
        </div>
      )}

      {panelState === 'loaded' && solutions.length === 0 && (
        <div style={{ ...cardStyle, color: '#57606a', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No matching repair data found. Try adding more symptom detail.
        </div>
      )}

      {panelState === 'loaded' && solutions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {solutions.map((s) => (
            <SolutionCard key={s.rank} solution={s} />
          ))}
        </div>
      )}
    </div>
  )
}
