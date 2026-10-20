import { test, expect } from '@playwright/test'
import { alignmentState, dateHealth, isSourceSnapshot, orangeOnly, ORANGE_COLUMNS, parseSource, peopleDirectory, SOURCE_STORAGE } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { readFileSync } from 'node:fs'
const PUBLISHED_SNAPSHOT:SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))

const header = Array.from({ length: 25 }, () => '')
header[2] = 'Task / Activity'; header[4] = 'Owner(s)'; header[5] = 'FRM Lead'
header[22] = 'Projected/Actual Start Date'; header[23] = 'Projected End Date'; header[24] = 'Staffing Support Planned/Currently'
const row = (name: string, values: Record<number, string>) => {
  const r = Array.from({ length: 25 }, () => ''); r[2] = name
  for (const [k, v] of Object.entries(values)) r[Number(k)] = v
  return r
}
const fixture: SourceSnapshot = { kind: 'frmprio.prioritization.v1', fileName: 'Synthetic orange example.xlsx', tabName: 'Prioritization', importedAt: '2026-10-14T00:00:00Z', rows: [[], header,
  row('Example access review', { 4: 'Alex Morgan Jordan Lee', 5: 'Avi', 6: 'High (Oct / Nov)', 7: 'Platform', 8: 'Moderate', 9: 'No', 10: 'Testing', 11: '900', 21: 'EXCLUDED NARRATIVE', 22: '2026-09-15', 23: '2026-11-15', 24: 'Example supporting staff' }),
  row('Example PMO', { 4: 'Alex Morgan', 5: 'Avi, Ash', 6: 'High', 7: 'PMO', 8: 'High', 9: 'Yes', 22: 'N/A - PMO', 23: 'N/A - PMO' }),
  row('Example overdue', { 4: 'Jordan Lee', 5: 'Sudhika', 6: 'Moderate', 7: 'Platform', 8: 'Moderate', 9: 'Yes', 22: '2026-10-01', 23: '2026-10-13' }),
  ['', 'Deprioritized'], row('Example deferred', { 4: 'Jordan Lee', 5: 'Sudhika', 6: 'Moderate', 7: 'Non-Platform', 8: 'Moderate', 9: 'Yes', 17: '2026-12-31', 22: '2026-11-01', 23: 'TBD' }),
  ['', 'Completed'], row('Example completed', { 4: 'Alex Morgan', 5: 'Avi', 6: 'Not Applicable', 7: 'Platform', 8: 'Moderate', 9: 'n/a', 22: '2026-09-01', 23: 'Completed', 24: 'Completed supporting staff' }),
] }

test('orange projection excludes other columns and maps W start, X end, Y staffing', () => {
  const projected = orangeOnly(fixture), a = parseSource(projected)
  expect(projected.includedColumns).toEqual(ORANGE_COLUMNS)
  expect(projected.rows.every(r => r.every((v, i) => ORANGE_COLUMNS.includes(i) || v === ''))).toBe(true)
  expect(JSON.stringify(projected)).not.toContain('EXCLUDED NARRATIVE')
  expect(a).toHaveLength(5)
  expect(a[0].start).toBe('2026-09-15'); expect(a[0].end).toBe('2026-11-15')
  expect(a[0].staffing).toBe('Example supporting staff')
  expect(a[0].estimate).toBeNull()
  expect(a[3].section).toBe('Deprioritized'); expect(a[3].end).toBeNull()
  expect(a[4].section).toBe('Completed'); expect(a[4].completed).toBe(true)
  expect(isSourceSnapshot(projected)).toBe(true)
})
test('completed work remains green, TBD and overdue end dates escalate, past actual starts do not', () => {
  const a = parseSource(orangeOnly(fixture)), today = '2026-10-14'
  expect(dateHealth(a[0], today).tone).toBe('scheduled')
  expect(dateHealth(a[1], today).tone).toBe('ongoing')
  expect(dateHealth(a[2], today).reasons).toContain('End date has passed; completion is not recorded')
  expect(dateHealth(a[3], today).reasons).toContain('End date TBD')
  expect(dateHealth(a[4], today).tone).toBe('completed')
  expect(dateHealth({ ...a[2], end: today }, today).label).toBe('Due today')
  expect(dateHealth({ ...a[0], end: '2026-08-01' }, today).tone).toBe('escalation')
  expect(alignmentState(a[0])).toBe('Not aligned')
  expect(alignmentState({ ...a[0], alignment: 'Yes' })).toBe('Not aligned')
})
test('shared owners resolve individually, including aliases, and FRM leads split correctly', () => {
  const directory = peopleDirectory(['Alex Morgan Jordan Lee', 'Alex / Jordan', 'Alex Morgan'], true)
  expect(directory.options).toEqual(['Alex Morgan', 'Jordan Lee'])
  expect(directory.resolve('Alex / Jordan')).toEqual(['Alex Morgan', 'Jordan Lee'])
  expect(peopleDirectory(['Sudhika & Chandana', 'Ash, Urminder']).options).toEqual(['Ash', 'Chandana', 'Sudhika', 'Urminder'])
})
async function loadFixture(page: import('@playwright/test').Page) {
  await page.clock.install({ time: new Date('2026-10-15T02:00:00Z') })
  await page.goto('/')
  await page.locator('.import-button input').setInputFiles({ name: 'source.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(5)
}
test('clickable person, rating, category and alignment filters combine and can be cleared', async ({ page }) => {
  await loadFixture(page)
  await page.locator('summary').filter({ hasText: 'FRM lead' }).click()
  await page.getByRole('checkbox', { name: 'FRM lead: Avi', exact: true }).check()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(3)
  await page.locator('summary').filter({ hasText: 'PwC owner' }).click()
  await page.getByRole('checkbox', { name: 'PwC owner: Jordan Lee', exact: true }).check()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
  await page.locator('summary').filter({ hasText: 'FRM priority' }).click()
  await page.getByRole('checkbox', { name: 'FRM priority: High', exact: true }).check()
  await page.locator('summary').filter({ hasText: 'Category' }).click()
  await page.getByRole('checkbox', { name: 'Category: Platform', exact: true }).check()
  await page.getByLabel('Filter priority alignment').selectOption('Not aligned')
  await expect(page.locator('.source-details h2')).toHaveText('Example access review')
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(5)
})
test('completed and escalation filters use colors and staffing appears only in details', async ({ page }) => {
  await loadFixture(page)
  await expect(page.locator('.staffing-detail')).toContainText('Example supporting staff')
  await expect(page.locator('.workbook-table')).not.toContainText('Example supporting staff')
  await expect(page.locator('.source-details')).not.toContainText('EXCLUDED NARRATIVE')
  await expect(page.locator('.workbook-row.date-completed')).toHaveCount(1)
  await expect(page.locator('.workbook-row.date-escalation')).toHaveCount(2)
  await page.getByLabel('Filter date status').selectOption('completed')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
  await expect(page.locator('.completed-marker')).toBeVisible()
  await page.getByLabel('Filter date status').selectOption('escalation')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await expect(page.locator('.workbook-table')).toContainText('TBD')
  await expect(page.locator('.gantt-bar')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(5)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).rows[2][21], SOURCE_STORAGE)).toBe('')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
test('new publication replaces an older bundled browser snapshot, and ignores the legacy cache', async ({ page }) => {
  const previous = { ...orangeOnly(fixture), publicationId: 'old-published-data' }
  await page.addInitScript(({ key, snapshot }) => { localStorage.setItem(key, JSON.stringify(snapshot)); localStorage.setItem('frmprio.publishedId', 'old-published-data'); localStorage.setItem('frmprio.prioritization.v1', JSON.stringify(snapshot)) }, { key: SOURCE_STORAGE, snapshot: previous })
  await page.goto('/')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
})
test('new visitors see the fresh orange-only workbook with completed items and explicit dates', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
  await expect(page.locator('.workbook-row.date-completed')).toHaveCount(8)
  await expect(page.locator('.table-head')).toContainText('PROJECTED/ACTUAL START')
  await expect(page.locator('.table-head')).toContainText('PROJECTED/ACTUAL END')
  expect(PUBLISHED_SNAPSHOT.includedColumns).toEqual(ORANGE_COLUMNS)
  expect(PUBLISHED_SNAPSHOT.rows.every(r => r.every((v, i) => ORANGE_COLUMNS.includes(i) || v === ''))).toBe(true)
  await page.screenshot({ path: '/tmp/frm-orange-dashboard.png', fullPage: true })
})
test('live refresh updates the orange view without replacing manual project records', async ({ page }) => {
  await page.addInitScript(() => { window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-fixture-token', expires_in: 3600 }) }), revoke: (_token, callback) => callback() } } } })
  let reads = 0
  await page.route('https://sheets.googleapis.com/**', route => {
    if (route.request().url().includes('/values/')) { reads++; const updated = structuredClone(fixture.rows); updated[2][2] = `Live source update ${reads}`; return route.fulfill({ json: { values: updated } }) }
    return route.fulfill({ json: { sheets: [{ properties: { sheetId: 8496958, title: 'Prioritization' } }] } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect Google Sheets' }).click()
  await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.locator('.source-details h2')).toHaveText('Live source update 1')
  await page.getByRole('button', { name: 'Refresh now' }).click()
  await expect(page.locator('.source-details h2')).toHaveText('Live source update 2')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('frmprio.projects.v1')!).length)).toBe(4)
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  await page.reload()
  await expect(page.locator('.source-details h2')).toHaveText('Live source update 2')
})
