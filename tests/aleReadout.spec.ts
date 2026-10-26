import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildAleReadout } from '../src/aleDecisions'
import { alignmentState, dateHealth, parseSource, SOURCE_STORAGE } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'

const snapshot: SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json', import.meta.url), 'utf8'))
const activities = parseSource(snapshot)
const today = '2026-10-26'
const readoutName = 'Alejandro’s leadership readout'

function fixture(end: string): SourceSnapshot {
  const row = Array.from({ length: 25 }, () => '')
  Object.assign(row, { 2: 'Readout fixture', 4: 'Mayra Mendoza', 5: 'Avi', 6: 'High', 7: 'Platform', 8: 'High', 9: 'Yes', 10: 'Testing', 22: '2026-10-19', 23: end, 24: 'READOUT_PRIVATE_STAFFING' })
  return { ...snapshot, publicationId: undefined, annotations: undefined, changeLog: undefined, fileName: 'Readout test fixture', rows: [...snapshot.rows.slice(0, 2), row], sections: { '3': 'Active portfolio' } }
}

test('readout matches both buckets: ten decisions across nine topics with worksheet owners and distinct revenue asks', () => {
  const data = buildAleReadout(activities, today)
  expect(data.decisionCount).toBe(10)
  expect(data.topicCount).toBe(9)
  expect(data.overlapCount).toBe(1)
  expect(data.escalations.map(item => item.activityId)).toEqual(activities.filter(item => dateHealth(item, today).tone === 'escalation').map(item => item.id))
  expect(data.alignment.map(item => item.activityId)).toEqual(activities.filter(item => alignmentState(item) === 'Not aligned').map(item => item.id))
  expect(new Set([...data.escalations, ...data.alignment].map(item => item.id)).size).toBe(10)
  const oracle = data.escalations.find(item => item.topic === 'Oracle MCP')!
  expect(oracle.owners).toEqual(['Joaquin Garcia', 'Stephen Wilm'])
  expect(oracle.owners).not.toContain('Jeff Rose')
  expect(data.escalations.some(item=>['Stripe','AWS','Monitoring — Deloitte follow-up'].includes(item.topic))).toBe(false)
  expect(data.escalations.find(item => item.topic === 'Revenue new controls')?.nextStep).toContain('October 22 checkpoint')
  expect(data.alignment[0].nextStep).toContain('PwC High versus FRM Low')
  expect(oracle.nextStep).toContain('larger-value sample transaction')
  expect(data.escalations.find(item=>item.topic.includes('Phases 2 & 3'))?.nextStep).toContain('@sdp')
  expect(data.escalations.find(item => item.topic === 'SDLC — Pando')?.nextStep).toContain('whether to resume')
  const platform = data.escalations.filter(item => item.topic.startsWith('Platform OE Testing'))
  expect(platform).toHaveLength(2)
  for (const item of platform) {
    expect(item.owners).toEqual(item.topic.endsWith('ITACs')?['Mayra Mendoza','Layla Yang']:['Sonu Kumar','Mayra Mendoza','Layla Yang'])
    expect(item.frmOwners).toEqual([])
    expect(item.nextStep).toContain('pending FRM TOD decision')
  }
})

test('unknown owners stay unassigned, completed work leaves escalation and actions follow current data', () => {
  const data = parseSource(fixture('TBD'))
  data[0].pwcOwners = ''
  data[0].meetingNotes = [{ source: 'Jeff', recordedOn: today, text: 'Confirm dates.' }]
  const unresolved = buildAleReadout(data, today)
  expect(unresolved.decisionCount).toBe(1)
  expect(unresolved.escalations[0].owners).toEqual([])
  expect(unresolved.escalations[0].nextStep).toContain('end date')
  expect(buildAleReadout(parseSource(fixture('Completed')), today).decisionCount).toBe(0)
  expect(buildAleReadout(parseSource(fixture(today)), today).decisionCount).toBe(0)
  expect(buildAleReadout(parseSource(fixture('2026-10-20')), '2026-10-21').escalations).toHaveLength(1)
})

test('top button opens the full portfolio readout from a filtered lead view and shows only concise metrics and actions', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-26T18:00:00Z'))
  await page.goto('/#lead=Ale')
  await page.getByLabel('Search source activities').fill('no matching activities')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
  await expect(page).toHaveURL(/#view=ale-kazam$/)
  const readout = page.getByRole('region', { name: readoutName })
  await expect(readout.locator('.ale-metrics .metric').nth(0).locator('strong')).toHaveText('10')
  await expect(readout.locator('.ale-metrics .metric').nth(1).locator('strong')).toHaveText('9')
  await expect(readout.locator('.ale-metrics .metric').nth(2).locator('strong')).toHaveText('1')
  await expect(readout.getByRole('article')).toHaveCount(10)
  await expect(readout).toContainText('Whole portfolio · 9 topics')
  await expect(readout).toContainText('1 topic appears in both buckets')
  const oracle = readout.getByRole('article', { name: 'Escalations: Oracle MCP', exact: true })
  await expect(oracle.locator('.ale-owners')).toContainText('@Stephen Wilm')
  await expect(oracle.locator('.ale-owners')).not.toContainText('Jeff')
  await expect(page.locator('.workbook-table, .workbook-filter-panel, .meeting-summaries, .staffing-detail')).toHaveCount(0)
  await expect(page.locator('.live-sheet')).toHaveCount(1)
  await expect(page.locator('.live-sheet')).toBeHidden()
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Project dashboard', exact: true })).toBeVisible()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(50)
})

test('readout link survives reload and browser navigation restores the appropriate view', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-26T18:00:00Z'))
  await page.addInitScript(({ key, data }) => { if (!localStorage.getItem(key)) { localStorage.setItem(key, JSON.stringify(data)); localStorage.setItem('frmprio.sourceView', 'manual') } }, { key: SOURCE_STORAGE, data: snapshot })
  await page.goto('/#view=ale-kazam')
  await expect(page.getByRole('region', { name: readoutName })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: readoutName })).toBeVisible()
  await page.locator('.sidebar').getByRole('button', { name: 'Avi view', exact: true }).click()
  await expect(page.getByRole('heading', { name: "Avi's projects", exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: readoutName })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('region', { name: readoutName })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: "Avi's projects", exact: true })).toBeVisible()
})

test('mobile readout fits the viewport and keeps owners, topics and next steps visible', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-26T18:00:00Z'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
  const readout = page.getByRole('region', { name: readoutName })
  await expect(readout.getByRole('article')).toHaveCount(10)
  await expect(readout.getByRole('article', { name: 'Escalations: Platform OE Testing — ITACs', exact: true })).not.toContainText('@Stephen Wilm')
  await expect(readout.getByRole('article', { name: 'Escalations: Oracle MCP', exact: true })).toContainText('Sudhika/Pavan')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('Pacific date rollover updates the decision count without reloading', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T06:59:30Z') })
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SOURCE_STORAGE, data: fixture('2026-10-20') })
  await page.goto('/#view=ale-kazam')
  const readout = page.getByRole('region', { name: readoutName })
  await expect(readout.locator('.ale-metrics .metric').first().locator('strong')).toHaveText('0')
  await expect(readout).not.toContainText('READOUT_PRIVATE_STAFFING')
  await page.clock.fastForward(61000)
  await expect(readout.locator('.ale-metrics .metric').first().locator('strong')).toHaveText('1')
  await expect(readout).toContainText('Oct 21, 2026')
  await expect(page.getByRole('button', { name: 'Ale-kazam', exact: true })).toContainText('1')
})

test('authorized sheet refresh continues while readout is open and updates its decisions', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T18:00:00Z') })
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-fixture-token', expires_in: 3600 }) }), revoke: (_token, callback) => callback() } } }
  })
  let reads = 0
  await page.route('https://sheets.googleapis.com/**', route => {
    if (route.request().url().includes('/values/')) {
      reads++
      return route.fulfill({ json: { values: fixture(reads === 1 ? 'TBD' : 'Completed').rows } })
    }
    return route.fulfill({ json: { sheets: [{ properties: { sheetId: 8496958, title: 'Prioritization' } }] } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect Google Sheets', exact: true }).click()
  await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Ale-kazam', exact: true }).click()
  const readout = page.getByRole('region', { name: readoutName })
  await expect(readout.locator('.ale-metrics .metric').first().locator('strong')).toHaveText('1')
  await page.clock.fastForward(5 * 60 * 1000)
  await expect(readout.locator('.ale-metrics .metric').first().locator('strong')).toHaveText('0')
  expect(reads).toBe(2)
  await expect(readout).not.toContainText('READOUT_PRIVATE_STAFFING')
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible()
})
