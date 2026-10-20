import type { AleReadoutData } from './aleDecisions'
import type { SourceSnapshot } from './prioritization'

export const ALE_HISTORY_STORAGE = 'frmprio.ale-history.v1'
export type AleHistoryIssue = { key: string; topic: string; bucket: 'escalation' | 'alignment' }
export type AleObservation = { id: string; observedAt: string; decisions: AleHistoryIssue[] }
export type AleHistory = { kind: 'frmprio.ale-history.v1'; updates: AleObservation[] }
export type AleItemHistory = { firstSeen: string; lastSeen: string; seenUpdates: number; status: 'new' | 'carryover' | 'previously-seen' }
export const EMPTY_ALE_HISTORY: AleHistory = { kind: 'frmprio.ale-history.v1', updates: [] }

export function pacificDay(value: string): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isAleHistory(value: unknown): value is AleHistory {
  return object(value) && value.kind === 'frmprio.ale-history.v1' && Array.isArray(value.updates) && value.updates.length <= 10000
    && value.updates.every(update => object(update) && typeof update.id === 'string' && !!update.id && typeof update.observedAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(update.observedAt) && Number.isFinite(Date.parse(update.observedAt)) && new Date(update.observedAt).toISOString() === update.observedAt
      && Array.isArray(update.decisions) && update.decisions.length <= 10000 && update.decisions.every(item => object(item)
        && typeof item.key === 'string' && !!item.key && typeof item.topic === 'string' && ['escalation', 'alignment'].includes(String(item.bucket)))
      && new Set(update.decisions.map(item => item.key)).size === update.decisions.length)
    && new Set(value.updates.map(update => update.id)).size === value.updates.length
}

// Headings and buckets survive worksheet row moves and ownership handoffs.
export function aleHistoryKey(name: string, bucket: 'escalation' | 'alignment'): string {
  const heading = name.split('\n')[0].normalize('NFKC').replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  return `${bucket}:${heading}`
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (object(value)) return Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, stableValue(value[key])]))
  return value
}

function fingerprint(value: unknown): string {
  const text = JSON.stringify(stableValue(value))
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) hash = ((hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn
  return hash.toString(16).padStart(16, '0')
}

export function aleUpdateId(snapshot: SourceSnapshot, data: AleReadoutData): string {
  // Automated polling of unchanged content creates at most one check-in per
  // Pacific day. Explicit workbook imports retain their original version stamp.
  const stamp = snapshot.fileName === 'Live Google Sheets' ? pacificDay(snapshot.importedAt) : snapshot.importedAt
  return fingerprint({ stamp, tab: snapshot.tabName, rows: snapshot.rows, sections: snapshot.sections, annotations: snapshot.annotations,
    changeLog: snapshot.changeLog, decisions: [...data.escalations, ...data.alignment].map(item => item.historyKey).sort() })
}

export function mergeAleHistories(...histories: AleHistory[]): AleHistory {
  const updates = new Map<string, AleObservation>()
  for (const history of histories) for (const update of history.updates) {
    const previous = updates.get(update.id)
    updates.set(update.id, previous ? { id: update.id, observedAt: previous.observedAt < update.observedAt ? previous.observedAt : update.observedAt,
      decisions: [...new Map([...previous.decisions, ...update.decisions].map(item => [item.key, item])).values()] } : update)
  }
  return { kind: 'frmprio.ale-history.v1', updates: [...updates.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt)) }
}

export function observeAleHistory(history: AleHistory, snapshot: SourceSnapshot, data: AleReadoutData, observedAt: string): AleHistory {
  const id = aleUpdateId(snapshot, data)
  if (history.updates.some(update => update.id === id)) return history
  const decisions: AleHistoryIssue[] = [
    ...data.escalations.map(item => ({ key: item.historyKey, topic: item.topic, bucket: 'escalation' as const })),
    ...data.alignment.map(item => ({ key: item.historyKey, topic: item.topic, bucket: 'alignment' as const })),
  ]
  return mergeAleHistories(history, { kind: 'frmprio.ale-history.v1', updates: [{ id, observedAt, decisions }] })
}

export function aleItemHistory(history: AleHistory, updateId: string, key: string): AleItemHistory | null {
  const index = history.updates.findIndex(update => update.id === updateId)
  if (index < 0) return null
  const seen = history.updates.slice(0, index + 1).filter(update => update.decisions.some(item => item.key === key))
  if (!seen.length) return null
  return { firstSeen: pacificDay(seen[0].observedAt), lastSeen: pacificDay(seen[seen.length - 1].observedAt), seenUpdates: seen.length,
    status: seen.length === 1 ? 'new' : history.updates[index - 1]?.decisions.some(item => item.key === key) ? 'carryover' : 'previously-seen' }
}

export function aleHistoryForNames(history: AleHistory, names: string[]): AleHistory {
  const keys = new Set(names.flatMap(name => [aleHistoryKey(name, 'escalation'), aleHistoryKey(name, 'alignment')]))
  return { ...history, updates: history.updates.map(update => ({ ...update, decisions: update.decisions.filter(item => keys.has(item.key)) })) }
}
