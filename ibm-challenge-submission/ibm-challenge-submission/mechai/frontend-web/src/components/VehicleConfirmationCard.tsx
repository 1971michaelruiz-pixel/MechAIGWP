/**
 * VehicleConfirmationCard — displays NHTSA-decoded vehicle details and lets the
 * mechanic confirm or inline-edit them before the profile is saved.
 *
 * States:
 *  - vehicle === null  → loading skeleton
 *  - editing === false → read-only card with Confirm / Edit buttons
 *  - editing === true  → inline edit form with Save / Cancel buttons
 */

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type VehicleData = {
  vin: string
  make: string | null
  model: string | null
  year: number | null
  trim?: string | null
  engine?: string | null
  body_style?: string | null
}

export type VehicleConfirmationCardProps = {
  /** Decoded vehicle to display. Pass `null` to show a loading skeleton. */
  vehicle: VehicleData | null
  /** Called with the (possibly edited) vehicle when the mechanic hits Confirm. */
  onConfirm: (v: VehicleData) => void
  /** Called when the mechanic wants to edit — receives the current (edited) state. */
  onEdit: (v: VehicleData) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#57606a' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.95rem', color: value ? '#1f2328' : '#57606a', fontStyle: value ? 'normal' : 'italic' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function EditInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#57606a' }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.4rem 0.6rem',
          fontSize: '0.9rem',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          outline: 'none',
          color: '#1f2328',
          backgroundColor: '#ffffff',
        }}
      />
    </label>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  const bar = (w: number | string) => (
    <div
      style={{
        height: 14,
        width: w,
        borderRadius: 4,
        backgroundColor: '#e5e7eb',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  )
  return (
    <div style={cardStyle}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {[120, 90, 60, 140, 110, 80].map((w, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bar(50)}
            {bar(w)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  width: '100%',
  padding: '1.25rem',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  backgroundColor: '#f7f8fa',
}

const btnBase: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  lineHeight: 1.4,
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VehicleConfirmationCard({
  vehicle,
  onConfirm,
  onEdit,
}: VehicleConfirmationCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<VehicleData | null>(null)

  if (!vehicle) return <Skeleton />

  // ── Read-only view ──────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#57606a' }}>
          Decoded vehicle — <code style={{ fontFamily: 'monospace' }}>{vehicle.vin}</code>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <Field label="Make" value={vehicle.make} />
          <Field label="Model" value={vehicle.model} />
          <Field label="Year" value={vehicle.year} />
          <Field label="Trim" value={vehicle.trim} />
          <Field label="Engine" value={vehicle.engine} />
          <Field label="Body Style" value={vehicle.body_style} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onConfirm(vehicle)}
            style={{ ...btnBase, backgroundColor: '#3b82d4', color: '#fff' }}
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setDraft({ ...vehicle })
              setEditing(true)
              onEdit(vehicle)
            }}
            style={{ ...btnBase, backgroundColor: 'transparent', color: '#3b82d4', border: '1px solid #3b82d4' }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // ── Inline edit form ────────────────────────────────────────────────────────
  const d = draft!
  const set = (key: keyof VehicleData) => (v: string) =>
    setDraft((prev) => ({ ...prev!, [key]: v || null }))

  return (
    <div style={cardStyle}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#57606a' }}>
        Edit vehicle — <code style={{ fontFamily: 'monospace' }}>{d.vin}</code>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <EditInput label="Make" value={d.make ?? ''} onChange={set('make')} />
        <EditInput label="Model" value={d.model ?? ''} onChange={set('model')} />
        <EditInput label="Year" value={d.year != null ? String(d.year) : ''} onChange={(v) =>
          setDraft((prev) => ({ ...prev!, year: v ? parseInt(v, 10) || null : null }))
        } />
        <EditInput label="Trim" value={d.trim ?? ''} onChange={set('trim')} />
        <EditInput label="Engine" value={d.engine ?? ''} onChange={set('engine')} />
        <EditInput label="Body Style" value={d.body_style ?? ''} onChange={set('body_style')} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => {
            setEditing(false)
            onConfirm(d)
          }}
          style={{ ...btnBase, backgroundColor: '#3b82d4', color: '#fff' }}
        >
          Save &amp; Confirm
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{ ...btnBase, backgroundColor: 'transparent', color: '#57606a', border: '1px solid #e5e7eb' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
