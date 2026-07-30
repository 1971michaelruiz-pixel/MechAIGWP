/**
 * ServiceRecordScreen — two-step voice/text intake for a new service visit.
 *
 * Navigated to with params:
 *   vehicleId — UUID of the confirmed vehicle record
 *
 * Phase 1: Presented symptoms (customer description)
 * Phase 2: Inspection findings (mechanic description)
 *
 * On save, POSTs to POST /api/service-records and navigates back on success.
 */

import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 1 | 2
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Component ──────────────────────────────────────────────────────────────────

export default function ServiceRecordScreen() {
  const params = useLocalSearchParams<{ vehicleId?: string }>()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>(1)
  const [presentedSymptoms, setPresentedSymptoms] = useState('')
  const [inspectionFindings, setInspectionFindings] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Navigation between phases ─────────────────────────────────────────────
  function handleNext() {
    if (presentedSymptoms.trim()) setPhase(2)
  }

  // ── Save record ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!params.vehicleId || !inspectionFindings.trim()) return
    setSaveState('saving')
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: params.vehicleId,
          presented_symptoms: presentedSymptoms.trim() || null,
          inspection_findings: inspectionFindings.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail ?? `HTTP ${res.status}`)
      }
      setSaveState('saved')
      // Give the user a moment to see the success message, then go back
      setTimeout(() => router.back(), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.')
      setSaveState('error')
    }
  }

  const canAdvance = phase === 1 ? presentedSymptoms.trim().length > 0 : inspectionFindings.trim().length > 0

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New Service Record</Text>

      {params.vehicleId ? (
        <Text style={styles.subtitle}>Vehicle ID: {params.vehicleId}</Text>
      ) : null}

      {/* Step indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, phase >= 1 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, phase >= 1 && styles.stepDotTextActive]}>
            {phase > 1 ? '✓' : '1'}
          </Text>
        </View>
        <View style={[styles.stepLine, phase > 1 && styles.stepLineActive]} />
        <View style={[styles.stepDot, phase === 2 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, phase === 2 && styles.stepDotTextActive]}>2</Text>
        </View>
        <Text style={styles.stepLabel}>Step {phase} of 2</Text>
      </View>

      {/* Phase 1 — Presented symptoms */}
      {phase === 1 && (
        <>
          <Text style={styles.fieldLabel}>Presented symptoms *</Text>
          <TextInput
            value={presentedSymptoms}
            onChangeText={setPresentedSymptoms}
            placeholder="Describe what the customer reported (brakes squealing, vibration, etc.)…"
            placeholderTextColor="#57606a"
            multiline
            numberOfLines={5}
            style={[styles.textArea]}
            textAlignVertical="top"
          />
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance}
            style={[styles.btnPrimary, !canAdvance && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>Next →</Text>
          </Pressable>
        </>
      )}

      {/* Phase 2 — Inspection findings */}
      {phase === 2 && (
        <>
          {/* Recap of phase 1 */}
          <View style={styles.recap}>
            <Text style={styles.recapLabel}>✓ Presented symptoms</Text>
            <Text style={styles.recapText}>{presentedSymptoms}</Text>
          </View>

          <Text style={styles.fieldLabel}>Inspection findings *</Text>
          <TextInput
            value={inspectionFindings}
            onChangeText={setInspectionFindings}
            placeholder="Describe what you found during inspection…"
            placeholderTextColor="#57606a"
            multiline
            numberOfLines={5}
            style={[styles.textArea]}
            textAlignVertical="top"
          />

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

          {saveState === 'saved' ? (
            <Text style={styles.successText}>✓ Record saved!</Text>
          ) : saveState === 'saving' ? (
            <ActivityIndicator color="#3b82d4" style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.actionRow}>
              <Pressable onPress={() => setPhase(1)} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>← Back</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canAdvance}
                style={[styles.btnPrimary, { flex: 1 }, !canAdvance && styles.btnDisabled]}
              >
                <Text style={styles.btnPrimaryText}>Save record</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#57606a',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#3b82d4',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#57606a',
  },
  stepDotTextActive: {
    color: '#ffffff',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: '#3b82d4',
  },
  stepLabel: {
    fontSize: 12,
    color: '#57606a',
    marginLeft: 6,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#57606a',
    fontWeight: '500',
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2328',
    backgroundColor: '#f7f8fa',
    minHeight: 110,
    marginBottom: 16,
  },
  recap: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    opacity: 0.85,
  },
  recapLabel: {
    fontSize: 11,
    color: '#57606a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  recapText: {
    fontSize: 13,
    color: '#57606a',
    lineHeight: 18,
  },
  errorText: {
    color: '#c05621',
    fontSize: 13,
    marginBottom: 8,
  },
  successText: {
    color: '#2f855a',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#3b82d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#1f2328',
    fontWeight: '500',
    fontSize: 15,
  },
})
