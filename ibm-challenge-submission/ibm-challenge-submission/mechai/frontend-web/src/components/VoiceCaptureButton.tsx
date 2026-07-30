/**
 * VoiceCaptureButton — push-to-talk component using the browser MediaRecorder API.
 *
 * States: idle → recording → transcribing → done (or error)
 *
 * The component POSTs the recorded audio blob to POST /api/transcribe as
 * multipart form data and calls the `onTranscript` callback on success.
 */

import { useCallback, useRef, useState } from 'react'

export type TranscribeResult = {
  session_id: string
  transcript: string
  confidence: number | null
}

export type VoiceCaptureButtonProps = {
  /** Called when a transcript is successfully returned from the backend. */
  onTranscript: (transcript: string, sessionId: string) => void
  /** Base URL for the MechAI API — defaults to the Vite env var. */
  apiBaseUrl?: string
  /** Additional CSS class for the outer wrapper. */
  className?: string
}

type CaptureState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

const STATE_LABEL: Record<CaptureState, string> = {
  idle: '🎙 Hold to speak',
  recording: '⏹ Recording… release to send',
  transcribing: '⏳ Transcribing…',
  done: '✓ Done',
  error: '⚠ Error — try again',
}

const STATE_COLOR: Record<CaptureState, string> = {
  idle: '#3b82d4',
  recording: '#e53e3e',
  transcribing: '#7c5cd8',
  done: '#2f855a',
  error: '#c05621',
}

export default function VoiceCaptureButton({
  onTranscript,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  className,
}: VoiceCaptureButtonProps) {
  const [state, setState] = useState<CaptureState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start()
      setState('recording')
    } catch (err) {
      setErrorMsg('Microphone access denied.')
      setState('error')
    }
  }, [])

  // ── Stop recording & transcribe ────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.onstop = async () => {
      // Release microphone tracks
      recorder.stream.getTracks().forEach((t) => t.stop())

      const mimeType = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'

      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)

      setState('transcribing')
      try {
        const res = await fetch(`${apiBaseUrl}/api/transcribe`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const detail = await res.text()
          throw new Error(detail || `HTTP ${res.status}`)
        }

        const data: TranscribeResult = await res.json()
        onTranscript(data.transcript, data.session_id)
        setState('done')

        // Reset to idle after a short delay so the user can speak again
        setTimeout(() => setState('idle'), 2000)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Transcription failed.')
        setState('error')
      }
    }

    recorder.stop()
  }, [apiBaseUrl, onTranscript])

  const isActive = state === 'recording'
  const isDisabled = state === 'transcribing'

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={isActive ? stopRecording : undefined}
        onTouchStart={(e) => { e.preventDefault(); startRecording() }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
        disabled={isDisabled}
        aria-label={STATE_LABEL[state]}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: `3px solid ${STATE_COLOR[state]}`,
          backgroundColor: isActive ? STATE_COLOR[state] : 'transparent',
          color: isActive ? '#fff' : STATE_COLOR[state],
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontSize: '1.5rem',
          transition: 'background-color 0.15s, color 0.15s',
          outline: 'none',
        }}
      >
        {isActive ? '■' : '●'}
      </button>

      <span style={{ fontSize: '0.8rem', color: STATE_COLOR[state], textAlign: 'center', maxWidth: 160 }}>
        {errorMsg ?? STATE_LABEL[state]}
      </span>
    </div>
  )
}
