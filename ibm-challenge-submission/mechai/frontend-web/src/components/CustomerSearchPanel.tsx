/**
 * CustomerSearchPanel — search for an existing customer or create a new one.
 *
 * - Debounces the search input by 300 ms before calling GET /api/customers/search
 * - Displays a result list with name and phone; each result has a "Select" button
 * - "New customer" button at the bottom expands an inline creation form
 * - On creation or selection the `onSelect` callback is fired with a CustomerSummary
 */

import { useState, useEffect, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CustomerSummary = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  email?: string
}

export type CustomerSearchPanelProps = {
  /** Called with the selected or newly-created customer. */
  onSelect: (customer: CustomerSummary) => void
  /** Defaults to http://localhost:8000 */
  apiBaseUrl?: string
}

// ── Styles (inline, matching project design tokens) ────────────────────────────

const panel: React.CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  backgroundColor: '#f7f8fa',
  overflow: 'hidden',
}

const sectionPad: React.CSSProperties = { padding: '1rem' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#1f2328',
}

const resultRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.6rem 1rem',
  borderTop: '1px solid #e5e7eb',
  backgroundColor: '#fff',
}

const btnBase: React.CSSProperties = {
  padding: '0.35rem 0.85rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  lineHeight: 1.4,
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#57606a',
  display: 'block',
  marginBottom: 4,
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomerSearchPanel({
  onSelect,
  apiBaseUrl = 'http://localhost:8000',
}: CustomerSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // New customer form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/customers/search?q=${encodeURIComponent(query.trim())}`,
        )
        if (res.ok) {
          const data: CustomerSummary[] = await res.json()
          setResults(data)
        }
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, apiBaseUrl])

  // ── New customer submit ───────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return

    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`${apiBaseUrl}/api/customers`, {
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
      onSelect(customer)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={panel}>
      {/* Search header */}
      <div style={sectionPad}>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: '#57606a' }}>
          Search customer by name or phone
        </p>
        <input
          type="text"
          placeholder="e.g. John Smith or 555-1234"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Result list */}
      {searching && (
        <p style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#57606a', margin: 0 }}>
          Searching…
        </p>
      )}

      {!searching && query.trim() && results.length === 0 && (
        <p style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#57606a', margin: 0 }}>
          No customers found.
        </p>
      )}

      {results.map((c) => (
        <div key={c.id} style={resultRow}>
          <div>
            <span style={{ fontSize: '0.9rem', color: '#1f2328', fontWeight: 500 }}>
              {c.first_name} {c.last_name}
            </span>
            {c.phone && (
              <span style={{ fontSize: '0.8rem', color: '#57606a', marginLeft: '0.5rem' }}>
                {c.phone}
              </span>
            )}
          </div>
          <button
            onClick={() => onSelect(c)}
            style={{ ...btnBase, backgroundColor: '#3b82d4', color: '#fff' }}
          >
            Select
          </button>
        </div>
      ))}

      {/* New customer toggle */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            ...btnBase,
            backgroundColor: 'transparent',
            color: '#3b82d4',
            border: '1px solid #3b82d4',
          }}
        >
          {showForm ? 'Cancel' : '+ New customer'}
        </button>
      </div>

      {/* Inline creation form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              <span style={labelStyle}>First name *</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Last name *</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          {createError && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#c05621' }}>{createError}</p>
          )}

          <button
            type="submit"
            disabled={creating || !firstName.trim() || !lastName.trim()}
            style={{
              ...btnBase,
              alignSelf: 'flex-start',
              backgroundColor: '#3b82d4',
              color: '#fff',
              opacity: creating || !firstName.trim() || !lastName.trim() ? 0.5 : 1,
              cursor: creating || !firstName.trim() || !lastName.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creating…' : 'Create customer'}
          </button>
        </form>
      )}
    </div>
  )
}
