import { useEffect, useMemo, useState } from 'react'
import { ALE_HISTORY_STORAGE, EMPTY_ALE_HISTORY, isAleHistory, mergeAleHistories, observeAleHistory } from './aleHistory'
import type { SourceSnapshot } from './prioritization'
import type { AleReadoutData } from './aleDecisions'
import { PUBLISHED_ALE_HISTORY } from './publishedAleHistory'

export function useAleHistory(snapshot: SourceSnapshot | null, data: AleReadoutData) {
  const [saved, setSaved] = useState(() => {
    try { const local: unknown = JSON.parse(localStorage.getItem(ALE_HISTORY_STORAGE) ?? 'null'); if (isAleHistory(local)) return local } catch { /* Published history remains available. */ }
    return EMPTY_ALE_HISTORY
  })
  const [storageError, setStorageError] = useState(false)
  const history = useMemo(() => mergeAleHistories(PUBLISHED_ALE_HISTORY, saved, snapshot?.aleHistory ?? EMPTY_ALE_HISTORY), [saved, snapshot])
  useEffect(() => {
    const observed = snapshot ? observeAleHistory(history, snapshot, data, new Date().toISOString()) : history
    const text = JSON.stringify(observed)
    if (text !== JSON.stringify(saved)) queueMicrotask(() => setSaved(previous => {
      const merged = mergeAleHistories(previous, observed)
      return JSON.stringify(merged) === JSON.stringify(previous) ? previous : merged
    }))
    try { localStorage.setItem(ALE_HISTORY_STORAGE, text); if (storageError) queueMicrotask(() => setStorageError(false)) } catch { if (!storageError) queueMicrotask(() => setStorageError(true)) }
  }, [history, saved, snapshot, data, storageError])
  return { history, storageError }
}
