/**
 * DialectAdminPanel — shop manager interface for the Regional Dialect & Jargon Database.
 *
 * Tabs:
 *   1. Approved Terms   — active terms sorted by usage count
 *   2. Pending Review   — unapproved terms; approve or delete each row
 *   3. Flagged Candidates — auto-detected unknown tokens; dismiss or promote to a term
 *
 * Desktop-only (web). No mobile counterpart for this sub-task.
 */

import { useCallback, useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type DialectTerm = {
  id: string
  shop_id: string | null
  raw_term: string
  canonical_term: string
  category: string | null
  region: string | null
  approved: boolean
  usage_count: number
  created_at: string
}

type DialectCandidate = {
  id: string
  shop_id: string | null
  raw_term: string
  context_snippet: string | null
  occurrence_count: number
  flagged_at: string
}

type Tab = 'approved' | 'pending' | 'candidates'

export type DialectAdminPanelProps = {
  /** Base URL for the MechAI API — defaults to the Vite env var. */
  apiBaseUrl?: string
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const T = {
  bg: '#ffffff',
  surface: '#f7f8fa',
  border: '#e5e7eb',
  text: '#1f2328',
  muted: '#57606a',
  accent: '#3b82d4',
  danger: '#c0392b',
  success: '#2f855a',
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 1.25rem',
  border: 'none',
  borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  color: active ? T.accent : T.muted,
  fontSize: '0.9rem',
  whiteSpace: 'nowrap',
})

const btnStyle = (variant: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
  padding: '0.25rem 0.65rem',
  fontSize: '0.8rem',
  border: `1px solid ${variant === 'danger' ? T.danger : variant === 'primary' ? T.accent : T.border}`,
  borderRadius: 4,
  background: variant === 'primary' ? T.accent : variant === 'danger' ? T.danger : 'none',
  color: variant === 'ghost' ? T.text : '#fff',
  cursor: 'pointer',
  marginLeft: '0.35rem',
})

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: T.muted,
  borderBottom: `1px solid ${T.border}`,
  background: T.surface,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  color: T.text,
  borderBottom: `1px solid ${T.border}`,
  verticalAlign: 'middle',
}

// ── Add-as-Term inline form ────────────────────────────────────────────────────

type AddTermFormProps = {
  prefill: string
  apiBaseUrl: string
  onDone: () => void
  onCancel: () => void
}

function AddTermForm({ prefill, apiBaseUrl, onDone, onCancel }: AddTermFormProps) {
  const [rawTerm, setRawTerm] = useState(prefill)
  const [canonicalTerm, setCanonicalTerm] = useState('')
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!rawTerm.trim() || !canonicalTerm.trim()) {
      setError('Raw term and canonical term are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${apiBaseUrl}/api/dialect/terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_term: rawTerm.trim(),
          canonical_term: canonicalTerm.trim(),
          category: category.trim() || null,
          region: region.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create term.')
    } finally {
      setSaving(false)
    }
  }, [rawTerm, canonicalTerm, category, region, apiBaseUrl, onDone])

  const inputStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem',
    fontSize: '0.82rem',
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    marginRight: '0.4rem',
    width: 160,
  }

  return (
    <tr style={{ background: '#fffbf0' }}>
      <td colSpan={5} style={{ ...tdStyle, padding: '0.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
          <input
            style={inputStyle}
            value={rawTerm}
            onChange={(e) => setRawTerm(e.target.value)}
            placeholder="Raw term"
          />
          <input
            style={inputStyle}
            value={canonicalTerm}
            onChange={(e) => setCanonicalTerm(e.target.value)}
            placeholder="Canonical term"
          />
          <input
            style={{ ...inputStyle, width: 110 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
          />
          <input
            style={{ ...inputStyle, width: 120 }}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region"
          />
          <button style={btnStyle('primary')} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button style={btnStyle('ghost')} onClick={onCancel}>
            Cancel
          </button>
          {error && (
            <span style={{ fontSize: '0.78rem', color: T.danger, marginLeft: '0.4rem' }}>
              {error}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Approved Terms tab ─────────────────────────────────────────────────────────

function ApprovedTermsTab({ terms }: { terms: DialectTerm[] }) {
  const sorted = [...terms].sort((a, b) => b.usage_count - a.usage_count)

  return (
    <div style={{ overflowX: 'auto' }}>
      {sorted.length === 0 ? (
        <p style={{ color: T.muted, padding: '1rem' }}>No approved terms yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Raw Term</th>
              <th style={thStyle}>Canonical Term</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Region</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Usage Count</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} style={{ background: T.bg }}>
                <td style={tdStyle}>
                  <code style={{ fontSize: '0.82rem' }}>{t.raw_term}</code>
                </td>
                <td style={tdStyle}>{t.canonical_term}</td>
                <td style={{ ...tdStyle, color: T.muted }}>{t.category ?? '—'}</td>
                <td style={{ ...tdStyle, color: T.muted }}>{t.region ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {t.usage_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Pending Review tab ─────────────────────────────────────────────────────────

type PendingReviewTabProps = {
  terms: DialectTerm[]
  apiBaseUrl: string
  onRefresh: () => void
}

function PendingReviewTab({ terms, apiBaseUrl, onRefresh }: PendingReviewTabProps) {
  const [actionError, setActionError] = useState<string | null>(null)

  const approveTerm = useCallback(
    async (id: string) => {
      setActionError(null)
      try {
        const res = await fetch(`${apiBaseUrl}/api/dialect/terms/${id}/approve`, {
          method: 'PATCH',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        onRefresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Approve failed.')
      }
    },
    [apiBaseUrl, onRefresh],
  )

  const deleteTerm = useCallback(
    async (id: string) => {
      setActionError(null)
      try {
        const res = await fetch(`${apiBaseUrl}/api/dialect/terms/${id}`, {
          method: 'DELETE',
        })
        // 204 No Content is success; treat 404 as already deleted
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
        onRefresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Delete failed.')
      }
    },
    [apiBaseUrl, onRefresh],
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      {actionError && (
        <p style={{ color: T.danger, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}>
          {actionError}
        </p>
      )}
      {terms.length === 0 ? (
        <p style={{ color: T.muted, padding: '1rem' }}>No terms pending review.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Raw Term</th>
              <th style={thStyle}>Canonical Term</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Region</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id} style={{ background: T.bg }}>
                <td style={tdStyle}>
                  <code style={{ fontSize: '0.82rem' }}>{t.raw_term}</code>
                </td>
                <td style={tdStyle}>{t.canonical_term}</td>
                <td style={{ ...tdStyle, color: T.muted }}>{t.category ?? '—'}</td>
                <td style={{ ...tdStyle, color: T.muted }}>{t.region ?? '—'}</td>
                <td style={tdStyle}>
                  <button style={btnStyle('primary')} onClick={() => approveTerm(t.id)}>
                    Approve
                  </button>
                  <button style={btnStyle('danger')} onClick={() => deleteTerm(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Flagged Candidates tab ─────────────────────────────────────────────────────

type CandidatesTabProps = {
  candidates: DialectCandidate[]
  apiBaseUrl: string
  onRefresh: () => void
}

function CandidatesTab({ candidates, apiBaseUrl, onRefresh }: CandidatesTabProps) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [addFormFor, setAddFormFor] = useState<string | null>(null)

  const dismissCandidate = useCallback(
    async (id: string) => {
      setActionError(null)
      try {
        const res = await fetch(`${apiBaseUrl}/api/dialect/candidates/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
        onRefresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Dismiss failed.')
      }
    },
    [apiBaseUrl, onRefresh],
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      {actionError && (
        <p style={{ color: T.danger, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}>
          {actionError}
        </p>
      )}
      {candidates.length === 0 ? (
        <p style={{ color: T.muted, padding: '1rem' }}>No flagged candidates.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Raw Token</th>
              <th style={thStyle}>Context Snippet</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Occurrences</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <>
                <tr key={c.id} style={{ background: T.bg }}>
                  <td style={tdStyle}>
                    <code style={{ fontSize: '0.82rem' }}>{c.raw_term}</code>
                  </td>
                  <td style={{ ...tdStyle, color: T.muted, maxWidth: 320 }}>
                    <span
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {c.context_snippet ?? '—'}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c.occurrence_count}
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={btnStyle('primary')}
                      onClick={() => setAddFormFor(addFormFor === c.id ? null : c.id)}
                    >
                      Add as Term
                    </button>
                    <button
                      style={btnStyle('danger')}
                      onClick={() => dismissCandidate(c.id)}
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
                {addFormFor === c.id && (
                  <AddTermForm
                    key={`form-${c.id}`}
                    prefill={c.raw_term}
                    apiBaseUrl={apiBaseUrl}
                    onDone={() => {
                      setAddFormFor(null)
                      onRefresh()
                    }}
                    onCancel={() => setAddFormFor(null)}
                  />
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DialectAdminPanel({
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
}: DialectAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('approved')
  const [terms, setTerms] = useState<DialectTerm[]>([])
  const [candidates, setCandidates] = useState<DialectCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [termsRes, candidatesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/dialect/terms`),
        fetch(`${apiBaseUrl}/api/dialect/candidates`),
      ])
      if (!termsRes.ok) throw new Error(`Terms fetch failed: HTTP ${termsRes.status}`)
      if (!candidatesRes.ok)
        throw new Error(`Candidates fetch failed: HTTP ${candidatesRes.status}`)
      const [termsData, candidatesData] = await Promise.all([
        termsRes.json() as Promise<DialectTerm[]>,
        candidatesRes.json() as Promise<DialectCandidate[]>,
      ])
      setTerms(termsData)
      setCandidates(candidatesData)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dialect data.')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const approvedTerms = terms.filter((t) => t.approved)
  const pendingTerms = terms.filter((t) => !t.approved)

  return (
    <div
      style={{
        fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
        fontSize: '14px',
        lineHeight: 1.6,
        color: T.text,
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem 0.75rem',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: T.text }}>
            Dialect &amp; Jargon Database
          </h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: T.muted }}>
            Manage regional mechanic slang to improve speech recognition accuracy.
          </p>
        </div>
        <button
          style={{ ...btnStyle('ghost'), fontSize: '0.78rem', border: `1px solid ${T.border}` }}
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error banner */}
      {loadError && (
        <div
          style={{
            padding: '0.5rem 1.25rem',
            background: '#fff0f0',
            color: T.danger,
            fontSize: '0.82rem',
            borderBottom: `1px solid #ffd0d0`,
          }}
        >
          {loadError}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          paddingLeft: '0.5rem',
        }}
      >
        <button style={tabStyle(activeTab === 'approved')} onClick={() => setActiveTab('approved')}>
          Approved Terms
          {approvedTerms.length > 0 && (
            <span
              style={{
                marginLeft: '0.4rem',
                background: T.accent,
                color: '#fff',
                borderRadius: 10,
                padding: '0 0.4rem',
                fontSize: '0.7rem',
              }}
            >
              {approvedTerms.length}
            </span>
          )}
        </button>
        <button style={tabStyle(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          Pending Review
          {pendingTerms.length > 0 && (
            <span
              style={{
                marginLeft: '0.4rem',
                background: '#e67e22',
                color: '#fff',
                borderRadius: 10,
                padding: '0 0.4rem',
                fontSize: '0.7rem',
              }}
            >
              {pendingTerms.length}
            </span>
          )}
        </button>
        <button
          style={tabStyle(activeTab === 'candidates')}
          onClick={() => setActiveTab('candidates')}
        >
          Flagged Candidates
          {candidates.length > 0 && (
            <span
              style={{
                marginLeft: '0.4rem',
                background: T.danger,
                color: '#fff',
                borderRadius: 10,
                padding: '0 0.4rem',
                fontSize: '0.7rem',
              }}
            >
              {candidates.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab body */}
      <div style={{ minHeight: 200 }}>
        {loading && (
          <p style={{ color: T.muted, padding: '1.25rem', fontSize: '0.85rem' }}>Loading…</p>
        )}
        {!loading && activeTab === 'approved' && <ApprovedTermsTab terms={approvedTerms} />}
        {!loading && activeTab === 'pending' && (
          <PendingReviewTab
            terms={pendingTerms}
            apiBaseUrl={apiBaseUrl}
            onRefresh={fetchData}
          />
        )}
        {!loading && activeTab === 'candidates' && (
          <CandidatesTab
            candidates={candidates}
            apiBaseUrl={apiBaseUrl}
            onRefresh={fetchData}
          />
        )}
      </div>
    </div>
  )
}
