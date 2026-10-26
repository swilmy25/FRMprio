import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildAleReadout } from '../src/aleDecisions'
import { ALE_HISTORY_STORAGE, EMPTY_ALE_HISTORY, aleHistoryKey, aleItemHistory, aleUpdateId, isAleHistory, mergeAleHistories, observeAleHistory, pacificDay } from '../src/aleHistory'
import { isSourceSnapshot, orangeOnly, parseSource, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import type { AleHistory } from '../src/aleHistory'

const snapshot: SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json', import.meta.url), 'utf8'))
const published: AleHistory = JSON.parse(readFileSync(new URL('../src/data/ale-history.json', import.meta.url), 'utf8'))
const current = buildAleReadout(parseSource(snapshot), '2026-10-26')
const baselineData=buildAleReadout(parseSource(snapshot),'2026-10-20')
const rootName = 'Alejandro’s leadership readout'
const nextSnapshot = (date: string): SourceSnapshot => ({ ...structuredClone(snapshot), publicationId: undefined, importedAt: `${date}T18:00:00.000Z` })
const firstHistory = () => observeAleHistory(EMPTY_ALE_HISTORY, snapshot, baselineData, '2026-10-20T18:00:00.000Z')

test('published baseline uses observed dates and the readout carries all effective FRM owners', () => {
  expect(isAleHistory(published)).toBe(true)
  expect(published.updates.length).toBeGreaterThanOrEqual(1)
  expect(published.updates[0].decisions).toHaveLength(7)
  for (const item of [...current.escalations, ...current.alignment]) {
    const baseline = aleItemHistory(published, published.updates[0].id, item.historyKey)!
    if (published.updates[0].decisions.some(decision=>decision.key===item.historyKey)) {
      expect(baseline).toEqual({ firstSeen: '2026-10-20', lastSeen: '2026-10-20', seenUpdates: 1, status: 'new' })
    } else expect(baseline).toBeNull()
    const latest = aleItemHistory(published, aleUpdateId(snapshot, current), item.historyKey)!
    expect(latest.firstSeen).toBe(pacificDay(published.updates.find(update=>update.decisions.some(decision=>decision.key===item.historyKey))!.observedAt))
    expect(latest.seenUpdates).toBe(published.updates.filter(update=>update.decisions.some(decision=>decision.key===item.historyKey)).length)
  }
  expect(current.escalations.find(item => item.topic === 'Revenue new controls')?.frmOwners).toEqual(['Urminder', 'Ash'])
  expect(current.alignment[0].frmOwners).toEqual(['Urminder', 'Ash'])
  expect(current.escalations.find(item => item.topic === 'SDLC — Pando')?.frmOwners).toEqual(['Avi'])
  expect(current.escalations.find(item => item.topic === 'SDLC — Pando')?.owners).toEqual(['Ben Oates'])
})

test('shortening Oracle’s title preserves its existing escalation dates and history in lead exports', () => {
  const oracle = current.escalations.find(item => item.topic === 'Oracle MCP')!
  const prior = published.updates.slice(0, -1).filter(update => update.decisions.some(item => item.topic === 'Oracle MCP'))
  expect(prior.length).toBeGreaterThan(0)
  expect(oracle.historyKey).toBe(prior[0].decisions.find(item => item.topic === 'Oracle MCP')!.key)
  expect(aleItemHistory(published, aleUpdateId(snapshot, current), oracle.historyKey)).toMatchObject({
    firstSeen: pacificDay(prior[0].observedAt), seenUpdates: prior.length + 1, status: 'carryover',
  })
  const exported = snapshotForLead({ ...snapshot, aleHistory: published }, 'Sudhika')
  expect(isSourceSnapshot(exported)).toBe(true)
  const imported = buildAleReadout(parseSource(orangeOnly(JSON.parse(JSON.stringify(exported)))),'2026-10-26')
  expect(imported.escalations.find(item => item.topic === 'Oracle MCP')?.historyKey).toBe(oracle.historyKey)
  expect(exported.aleHistory?.updates.flatMap(update => update.decisions).filter(item => item.key === oracle.historyKey)).toHaveLength(prior.length + 1)
  const invalid = structuredClone(snapshot)
  invalid.annotations!['26'].historyName = ' '
  expect(isSourceSnapshot(invalid)).toBe(false)
})

test('a following source update preserves first dates across row moves and ownership handoffs', () => {
  const next = nextSnapshot('2026-10-27')
  ;[next.rows[15], next.rows[35]] = [next.rows[35], next.rows[15]]
  ;[next.annotations!['16'], next.annotations!['36']] = [next.annotations!['36'], next.annotations!['16']]
  next.rows[35][4] = 'Layla Yang'
  const data = buildAleReadout(parseSource(next), '2026-10-27')
  const history = observeAleHistory(firstHistory(), next, data, '2026-10-27T18:00:00.000Z')
  const revenue = data.escalations.find(item => item.topic === 'Revenue new controls')!
  expect(revenue.activityId).toBe('source-row-36')
  expect(revenue.owners).toEqual(['Layla Yang'])
  expect(aleItemHistory(history, aleUpdateId(next, data), revenue.historyKey)).toEqual({ firstSeen: '2026-10-20', lastSeen: '2026-10-27', seenUpdates: 2, status: 'carryover' })
  const api = data.escalations.find(item => item.topic === 'API Tokenization')!
  expect(aleItemHistory(history, aleUpdateId(next, data), api.historyKey)?.firstSeen).toBe('2026-10-27')
})

test('leaving and returning to one bucket does not reset dates or conflate Revenue’s separate decisions', () => {
  const next = nextSnapshot('2026-10-21')
  next.rows[15][6] = 'High'; next.rows[15][9] = 'Yes'
  const data = buildAleReadout(parseSource(next), '2026-10-21')
  expect(data.alignment).toHaveLength(0)
  const second = observeAleHistory(firstHistory(), next, data, '2026-10-21T18:00:00.000Z')
  const returned = nextSnapshot('2026-10-22')
  const back = buildAleReadout(parseSource(returned), '2026-10-22')
  const third = observeAleHistory(second, returned, back, '2026-10-22T18:00:00.000Z')
  const id = aleUpdateId(returned, back)
  expect(aleItemHistory(third, id, back.alignment[0].historyKey)).toEqual({ firstSeen: '2026-10-20', lastSeen: '2026-10-22', seenUpdates: 2, status: 'previously-seen' })
  expect(aleItemHistory(third, id, back.escalations.find(item => item.topic === 'Revenue new controls')!.historyKey)?.status).toBe('carryover')
})

test('reloads, UI publications and unchanged live polling do not inflate history, while a later daily check-in does', () => {
  const live = { ...snapshot, publicationId: undefined, fileName: 'Live Google Sheets', importedAt: '2026-10-20T18:00:00.000Z' }
  const first = observeAleHistory(EMPTY_ALE_HISTORY, live, current, '2026-10-20T18:00:00.000Z')
  const polled = { ...live, importedAt: '2026-10-20T18:05:00.000Z', publicationId: 'ui-only-change' }
  expect(observeAleHistory(first, polled, current, '2026-10-20T18:05:00.000Z')).toBe(first)
  const embedded = { ...polled, aleHistory: first }
  expect(observeAleHistory(first, embedded, current, '2026-10-20T18:06:00.000Z')).toBe(first)
  const later = { ...live, importedAt: '2026-10-21T18:00:00.000Z' }
  const second = observeAleHistory(first, later, current, '2026-10-21T18:00:00.000Z')
  expect(second.updates).toHaveLength(2)
  expect(aleItemHistory(second, aleUpdateId(later, current), current.escalations[0].historyKey)?.status).toBe('carryover')
})

test('history validation, merging and lead exports retain dates without exporting unrelated topics', () => {
  const original = firstHistory()
  const copy = structuredClone(original); copy.updates[0].observedAt = '2026-10-20T19:00:00.000Z'
  const merged = mergeAleHistories(original, copy)
  expect(merged.updates).toHaveLength(1)
  expect(merged.updates[0].observedAt).toBe('2026-10-20T18:00:00.000Z')
  const exported = snapshotForLead({ ...snapshot, aleHistory: original }, 'Avi')
  expect(isSourceSnapshot(exported)).toBe(true)
  expect(orangeOnly(exported).aleHistory?.updates[0].decisions).toHaveLength(2)
  expect(exported.aleHistory?.updates[0].decisions.some(item => /Stripe|Revenue/.test(item.topic))).toBe(false)
  const invalid = structuredClone(original); invalid.updates[0].observedAt = '2026-02-30T18:00:00.000Z'
  expect(isAleHistory(invalid)).toBe(false)
  expect(isSourceSnapshot({ ...snapshot, aleHistory: invalid })).toBe(false)
  expect(isAleHistory({ ...original, updates: [...original.updates, ...original.updates] })).toBe(false)
  expect(aleHistoryKey(' Revenue new controls\nNew context', 'escalation')).toBe(current.escalations.find(item=>item.topic==='Revenue new controls')!.historyKey)
})

test('readout shows both owner teams and carryover dates that survive reload and navigation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T18:00:00.000Z'))
  await page.goto('/#view=ale-kazam')
  const root = page.getByRole('region', { name: rootName })
  const revenue = root.getByRole('article', { name: 'Escalations: Revenue new controls', exact: true })
  await expect(revenue.locator('.ale-frm-owners')).toContainText('@Urminder')
  await expect(revenue.locator('.ale-frm-owners')).toContainText('@Ash')
  await expect(revenue.locator('.ale-item-history')).toContainText(published.updates.length===1?'New this update':`Carryover · ${published.updates.length} updates`)
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'next-update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nextSnapshot('2026-10-28'))) })
  await page.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
  await expect(revenue.locator('.ale-item-history')).toContainText(`Carryover · ${published.updates.length + 1} updates`)
  await expect(revenue.locator('.ale-item-history')).toContainText('First logged Oct 20, 2026')
  await expect(revenue.locator('.ale-item-history')).toContainText('Last seen Oct 28, 2026')
  await expect(root.locator('.ale-metrics .metric').nth(3).locator('strong')).toHaveText(String(current.decisionCount))
  await page.reload()
  await expect(revenue.locator('.ale-item-history')).toContainText(`Carryover · ${published.updates.length + 1} updates`)
  const history = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), ALE_HISTORY_STORAGE)
  expect(history.updates).toHaveLength(published.updates.length + 1)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('source exports transfer local update history into a fresh browser without creating duplicate check-ins', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T18:00:00.000Z'))
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'next-update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nextSnapshot('2026-10-28'))) })
  await expect(page.getByRole('status')).toContainText('Imported 50 activities')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: false }).click()
  const download = await downloadPromise
  const exported: SourceSnapshot = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(isSourceSnapshot(exported)).toBe(true)
  expect(exported.aleHistory?.updates).toHaveLength(published.updates.length + 1)
  const context = await browser.newContext()
  try {
    const other = await context.newPage()
    await other.clock.setFixedTime(new Date('2026-10-28T18:00:00.000Z'))
    await other.goto('/')
    await other.locator('input[type=file]').setInputFiles({ name: 'transferred.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) })
    await other.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
    const row = other.getByRole('article', { name: 'Escalations: SDLC — Pando', exact: true })
    await expect(row.locator('.ale-item-history')).toContainText(`Carryover · ${published.updates.length + 1} updates`)
    await expect(row.locator('.ale-frm-owners')).toContainText('@Avi')
  } finally { await context.close() }
})

test('history storage failures are visible and the in-memory history remains available for export', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T18:00:00.000Z'))
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(name, value) { if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError'); return original.call(this, name, value) }
  }, ALE_HISTORY_STORAGE)
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'next-update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nextSnapshot('2026-10-28'))) })
  await page.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Local update history could not be saved')
  await expect(page.getByRole('article', { name: 'Escalations: SDLC — Pando', exact: true }).locator('.ale-item-history')).toContainText(`Carryover · ${published.updates.length + 1} updates`)
})
