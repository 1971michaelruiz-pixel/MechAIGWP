/**
 * TwoPhaseVoiceCapture — two-step voice intake for service records.
 *
 * Phase 1: "Describe presented symptoms"
 * Phase 2: "Describe inspection findings"
 *
 * Props:
 *   onComplete  — called with (presentedTranscript, findingsTranscript) on submit
 *   apiBaseUrl  — base URL for the MechAI API (defaults to VITE_API_BASE_URL)
 */

import { useState } from 'react'
import VoiceCaptureButton from './VoiceCaptureButton'

export type TwoPhaseVoiceCaptureProps = {
  /** Called when both phases are complete and the user clicks Submit. */
  onComplete: (presented: string, findings: string) => void
  /** Base URL for the MechAI API — defaults to the Vite env var. */
  apiBaseUrl?: string
}

type Phase = 1 | 2

export default function TwoPhaseVoiceCapture({
  onComplete,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
}: TwoPhaseVoiceCaptureProps) {
  const [phase, setPhase] = useState<Phase>(1)
  const [presentedTranscript, setPresentedTranscript] = useState<string | null>(null)
  const [findingsTranscript, setFindingsTranscript] = useState<string | null>(null)

  function handlePhase1Transcript(text: string) {
    setPresentedTranscript(text)
  }

  function handlePhase2Transcript(text: string) {
    setFindingsTranscript(text)
  }

  function handleNext() {
    if (presentedTranscript) setPhase(2)
  }

  function handleSubmit() {
    if (presentedTranscript && findingsTranscript) {
      onComplete(presentedTranscript, findingsTranscript)
    }
  }

  const stepLabel = `Step ${phase} of 2`
  const phaseTitle = phase === 1 ? 'Describe presented symptoms' : 'Describe inspection findings'
  const currentTranscript = phase === 1 ? presentedTranscript : findingsTranscript
  const canAdvance = phase === 1 ? !!presentedTranscript : !!findingsTranscript

  return (
    <div
      style={{
        width: '100%',
        padding: '1.25rem',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        backgroundColor: '#f7f8fa',
        boxSizing: 'border-box' as const,
      }}
    >
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <StepDot active={phase === 1} done={phase > 1} label="1" />
        <div style={{ flex: 1, height: 2, backgroundColor: phase > 1 ? '#3b82d4' : '#e5e7eb', borderRadius: 1 }} />
        <StepDot active={phase === 2} done={false} label="2" />
        <span style={{ fontSize: '0.75rem', color: '#57606a', marginLeft: '0.5rem' }}>{stepLabel}</span>
      </div>

      {/* Phase heading */}
      <p style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.95rem', color: '#1f2328' }}>
        {phaseTitle}
      </p>

      {/* Voice capture button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <VoiceCaptureButton
          key={`phase-${phase}`}
          onTranscript={phase === 1 ? handlePhase1Transcript : handlePhase2Transcript}
          apiBaseUrl={apiBaseUrl}
        />
      </div>

      {/* Transcript display */}
      {currentTranscript && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {phase === 1 ? 'Presented symptoms' : 'Inspection findings'}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: '#1f2328' }}>
            {currentTranscript}
          </p>
        </div>
      )}

      {/* Phase 1 — completed transcript summary */}
      {phase === 2 && presentedTranscript && (
        <div
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            marginBottom: '1rem',
            opacity: 0.75,
          }}
        >
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✓ Presented symptoms captured
          </p>
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#57606a' }}>
            {presentedTranscript}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        {phase === 1 && (
          <button
            onClick={handleNext}
            disabled={!canAdvance}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              backgroundColor: canAdvance ? '#3b82d4' : '#e5e7eb',
              color: canAdvance ? '#fff' : '#57606a',
              cursor: canAdvance ? 'pointer' : 'not-allowed',
            }}
          >
            Next →
          </button>
        )}
        {phase === 2 && (
          <button
            onClick={handleSubmit}
            disabled={!canAdvance}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              backgroundColor: canAdvance ? '#3b82d4' : '#e5e7eb',
              color: canAdvance ? '#fff' : '#57606a',
              cursor: canAdvance ? 'pointer' : 'not-allowed',
            }}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step dot sub-component ─────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const bg = done ? '#3b82d4' : active ? '#3b82d4' : '#e5e7eb'
  const color = active || done ? '#fff' : '#57606a'

  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 700,
        flexShrink: 0,
        transition: 'background-color 0.2s',
      }}
    >
      {done ? '✓' : label}
    </div>
  )
}
