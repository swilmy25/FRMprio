import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAleReadout } from '../src/aleDecisions.ts'
import { EMPTY_ALE_HISTORY, isAleHistory, mergeAleHistories, observeAleHistory, pacificDay } from '../src/aleHistory.ts'
import { isSourceSnapshot, parseSource } from '../src/prioritization.ts'

const snapshotPath = new URL('../src/data/prioritization.json', import.meta.url)
const historyPath = new URL('../src/data/ale-history.json', import.meta.url)
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const existing: unknown = JSON.parse(readFileSync(historyPath, 'utf8'))
if (!isSourceSnapshot(snapshot) || !isAleHistory(existing)) throw new Error('Invalid source or history; refusing to replace the readout log.')
const observedAt = new Date().toISOString()
const data = buildAleReadout(parseSource(snapshot), pacificDay(observedAt))
const merged = mergeAleHistories(existing, snapshot.aleHistory ?? EMPTY_ALE_HISTORY)
const next = observeAleHistory(merged, snapshot, data, observedAt)
const text = `${JSON.stringify(next, null, 2)}\n`
if (text !== readFileSync(historyPath, 'utf8')) writeFileSync(historyPath, text)
console.log(`Ale-kazam history: ${next.updates.length} logged update(s), ${data.decisionCount} current decisions. ${fileURLToPath(historyPath)}`)
