/**
 * VoiceCaptureScreen — push-to-talk voice capture for the MechAI mobile app.
 *
 * States: idle → recording → transcribing → done (or error)
 *
 * Uses expo-av Audio.Recording to capture microphone audio, then POSTs the
 * recorded file to POST /api/transcribe and displays the returned transcript.
 *
 * Target: transcript returned within 3s for a 30-second clip.
 */

import { Audio } from 'expo-av'
import { useState, useRef, useCallback } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
} from 'react-native'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type CaptureState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

type TranscribeResult = {
  session_id: string
  transcript: string
  confidence: number | null
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VoiceCaptureScreen() {
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const recordingRef = useRef<Audio.Recording | null>(null)

  // ── Start recording ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      )
      recordingRef.current = recording
      setCaptureState('recording')
    } catch (err) {
      setErrorMsg('Microphone permission denied or unavailable.')
      setCaptureState('error')
    }
  }, [])

  // ── Stop recording & transcribe ──────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current
    if (!recording) return

    try {
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })

      const uri = recording.getURI()
      if (!uri) throw new Error('No audio URI returned from recorder.')
      recordingRef.current = null

      setCaptureState('transcribing')

      // Build multipart form data
      const formData = new FormData()
      // React Native's FormData accepts { uri, name, type } objects
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as unknown as Blob)

      const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `HTTP ${res.status}`)
      }

      const data: TranscribeResult = await res.json()
      setTranscript(data.transcript)
      setSessionId(data.session_id)
      setCaptureState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transcription failed.')
      setCaptureState('error')
    }
  }, [])

  const isRecording = captureState === 'recording'
  const isTranscribing = captureState === 'transcribing'
  const isDisabled = isTranscribing

  // ── Button label & colour ────────────────────────────────────────────────
  const buttonLabel = {
    idle: 'Hold to speak',
    recording: 'Release to send',
    transcribing: 'Transcribing…',
    done: 'Tap to speak again',
    error: 'Tap to try again',
  }[captureState]

  const buttonColor = {
    idle: '#3b82d4',
    recording: '#e53e3e',
    transcribing: '#7c5cd8',
    done: '#2f855a',
    error: '#c05621',
  }[captureState]

  function handleReset() {
    if (captureState === 'done' || captureState === 'error') {
      setCaptureState('idle')
      setErrorMsg(null)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Voice Capture</Text>
      <Text style={styles.subtitle}>
        Hold the button and describe what you're hearing from the vehicle.
      </Text>

      {/* Push-to-talk button */}
      <Pressable
        onPressIn={captureState === 'idle' ? startRecording : undefined}
        onPressOut={isRecording ? stopRecording : undefined}
        onPress={captureState === 'done' || captureState === 'error' ? handleReset : undefined}
        disabled={isDisabled}
        style={[
          styles.micButton,
          { borderColor: buttonColor, backgroundColor: isRecording ? buttonColor : 'transparent' },
        ]}
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
      >
        {isTranscribing ? (
          <ActivityIndicator color={buttonColor} size="large" />
        ) : (
          <Text style={[styles.micIcon, { color: isRecording ? '#fff' : buttonColor }]}>
            {isRecording ? '■' : '●'}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.stateLabel, { color: buttonColor }]}>
        {errorMsg ?? buttonLabel}
      </Text>

      {/* Transcript result */}
      {transcript && (
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptMeta}>
            Session: <Text style={styles.code}>{sessionId}</Text>
          </Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}
    </ScrollView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2328',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#57606a',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
    lineHeight: 22,
    maxWidth: 280,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 36,
    lineHeight: 40,
  },
  stateLabel: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 200,
  },
  transcriptCard: {
    marginTop: 32,
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f7f8fa',
  },
  transcriptMeta: {
    fontSize: 12,
    color: '#57606a',
    marginBottom: 6,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  transcriptText: {
    fontSize: 15,
    color: '#1f2328',
    lineHeight: 24,
  },
})
