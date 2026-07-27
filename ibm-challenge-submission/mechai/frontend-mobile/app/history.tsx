/**
 * VehicleHistoryScreen — displays the full service history for a vehicle.
 *
 * Navigated to with params:
 *   vin — 17-character VIN
 *
 * Fetches GET /api/vehicles/{vin}/history on mount and renders a FlatList of
 * service records.  Each row shows the visit date and symptom tag pills.
 */

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

type ServiceRecord = {
  id: string
  vehicle_id: string
  visit_date: string
  presented_symptoms: string | null
  inspection_findings: string | null
  symptom_tags: string[] | null
  created_at: string
}

type LoadState = 'loading' | 'loaded' | 'error'

// ── Sub-components ─────────────────────────────────────────────────────────────

function SymptomTagPill({ label }: { label: string }) {
  return (
    <View style={styles.tagPill}>
      <Text style={styles.tagText}>{label.replace(/_/g, ' ')}</Text>
    </View>
  )
}

function RecordRow({ item }: { item: ServiceRecord }) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(item.visit_date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const hasTags = item.symptom_tags && item.symptom_tags.length > 0
  const hasText = item.presented_symptoms || item.inspection_findings

  return (
    <View style={styles.recordCard}>
      {/* Date + expand toggle */}
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{date}</Text>
        {hasText ? (
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.expandBtn}>{expanded ? '▲ Hide' : '▼ Details'}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Symptom tag pills */}
      {hasTags ? (
        <View style={styles.tagRow}>
          {item.symptom_tags!.map((tag) => (
            <SymptomTagPill key={tag} label={tag} />
          ))}
        </View>
      ) : (
        <Text style={styles.noTagsText}>No tags extracted</Text>
      )}

      {/* Expandable raw text */}
      {expanded && (
        <View style={styles.detailContainer}>
          {item.presented_symptoms ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Presented symptoms</Text>
              <Text style={styles.detailText}>{item.presented_symptoms}</Text>
            </View>
          ) : null}
          {item.inspection_findings ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Inspection findings</Text>
              <Text style={styles.detailText}>{item.inspection_findings}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VehicleHistoryScreen() {
  const params = useLocalSearchParams<{ vin?: string }>()
  const router = useRouter()

  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const vin = params.vin ?? ''

  useEffect(() => {
    if (!vin) {
      setLoadState('loaded')
      return
    }
    setLoadState('loading')
    fetch(`${API_BASE_URL}/api/vehicles/${encodeURIComponent(vin)}/history`)
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
  }, [vin])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Service History</Text>
        {vin ? <Text style={styles.subtitle}>{vin}</Text> : null}
      </View>

      {loadState === 'loading' && (
        <ActivityIndicator color="#3b82d4" style={{ marginTop: 32 }} />
      )}

      {loadState === 'error' && (
        <Text style={styles.errorText}>{errorMsg}</Text>
      )}

      {loadState === 'loaded' && records.length === 0 && (
        <Text style={styles.emptyText}>No service history yet.</Text>
      )}

      {loadState === 'loaded' && records.length > 0 && (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RecordRow item={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: '#3b82d4',
    fontWeight: '500',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
  },
  subtitle: {
    fontSize: 12,
    color: '#57606a',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  recordCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f7f8fa',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#57606a',
  },
  expandBtn: {
    fontSize: 12,
    color: '#3b82d4',
    fontWeight: '500',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eef3fb',
    borderWidth: 1,
    borderColor: '#c8d9f5',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3b82d4',
  },
  noTagsText: {
    fontSize: 12,
    color: '#57606a',
    fontStyle: 'italic',
  },
  detailContainer: {
    marginTop: 10,
    gap: 8,
  },
  detailBlock: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#57606a',
    fontWeight: '500',
  },
  detailText: {
    fontSize: 13,
    color: '#1f2328',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    color: '#57606a',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#c05621',
    textAlign: 'center',
    marginTop: 40,
    padding: 16,
  },
})
