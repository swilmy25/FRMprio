import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildAleReadout } from '../src/aleDecisions'
import { dateHealth, isSourceSnapshot, orangeOnly, parseSource, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'

const snapshot: SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json', import.meta.url), 'utf8'))
const activities = parseSource(snapshot)

test('a custom pause explains no current PwC action, survives lead exports and does not suppress new risks', () => {
  const chronosphere = activities.find(item => item.row === 17)!
  expect(chronosphere.completed).toBe(false)
  expect(chronosphere.section).toBe('Deprioritized')
  expect(dateHealth(chronosphere,'2026-10-26')).toMatchObject({tone:'paused',reasons:[expect.stringContaining('No current PwC action')]})
  expect(dateHealth({...chronosphere,escalationReason:'New confirmed blocker'},'2026-10-26').tone).toBe('escalation')
  expect(dateHealth({...chronosphere,end:'2026-10-25',endRaw:'2026-10-25'},'2026-10-26').tone).toBe('escalation')
  const exported = snapshotForLead(orangeOnly(snapshot),'Avi')
  expect(isSourceSnapshot(exported)).toBe(true)
  expect(parseSource(JSON.parse(JSON.stringify(exported))).find(item => item.row === 17)?.escalationPauseReason).toBe(chronosphere.escalationPauseReason)
  const invalid = JSON.parse(JSON.stringify(snapshot))
  invalid.annotations['17'].escalationPauseReason = 123
  expect(isSourceSnapshot(invalid)).toBe(false)
  const readout = buildAleReadout(activities,'2026-11-10')
  expect(readout.escalations.some(item => item.activityId === chronosphere.id)).toBe(false)
  const tokenization = activities.find(item => item.row === 13)!
  expect(tokenization.followUpDate).toBeNull()
  expect(tokenization.end).toBe('2026-11-09')
  expect(activities.find(item => item.row === 12)?.end).toBe('2026-11-10')
  expect(readout.escalations.find(item => item.activityId === tokenization.id)).toMatchObject({owners:['Mayra Mendoza'],frmOwners:['Urminder'],nextStep:expect.stringContaining('usage path/control ownership')})
  expect(readout.escalations.find(item => item.activityId === 'source-row-16')?.nextStep).toContain('ToD conclusion action is marked completed')
})

test('Mayra’s current disposition, decision deadlines and source attribution appear in the dashboard and readout', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-10T18:00:00Z'))
  await page.goto('/')
  await page.getByLabel('Search source activities').fill('Chronosphere')
  await expect(page.locator('.workbook-row.date-paused')).toHaveCount(1)
  await expect(page.locator('.workbook-row.date-completed')).toHaveCount(0)
  await expect(page.locator('.workbook-row.date-paused .track')).toContainText('No current PwC action')
  await expect(page.locator('.workbook-row.date-paused .track')).not.toContainText('awaiting FRM dates')
  await expect(page.locator('.paused-escalation-note')).toContainText('no longer a priority per Mayra')
  await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('posted Oct 22, 2026')
  await page.getByLabel('Search source activities').fill('ChatGPT Tokenizer')
  await expect(page.locator('.source-date-facts')).toContainText('Nov 9, 2026')
  await expect(page.locator('.follow-up-checkpoint')).toHaveCount(0)
  await expect(page.locator('.date-escalation-panel')).toContainText('End date has passed')
  await page.getByLabel('Search source activities').fill('Revenue new controls')
  await expect(page.locator('.follow-up-checkpoint')).toHaveCount(0)
  await expect(page.locator('.date-escalation-panel')).toContainText('End date TBD')
  await page.getByRole('button',{name:'Ale-kazam',exact:true}).click()
  const readout = page.getByRole('region',{name:'Alejandro’s leadership readout'})
  await expect(readout.getByRole('article',{name:'Escalations: IT Ops / Chronosphere',exact:true})).toHaveCount(0)
  await expect(readout.getByRole('article',{name:'Escalations: ChatGPT Tokenizer with Astra Model',exact:true})).toContainText('November 9')
  await expect(readout.getByRole('article',{name:'Escalations: Revenue new controls',exact:true})).toContainText('ToD conclusion action is marked completed')
  await page.getByRole('button',{name:'Back to dashboard',exact:true}).click()
  const summaries = page.getByRole('region',{name:'Meeting updates by PwC owner'})
  await summaries.locator('summary').click()
  await summaries.getByRole('button',{name:'Mayra Mendoza',exact:false}).click()
  const clarification = summaries.locator('li').filter({hasText:'Chronosphere — deprioritized; no current PwC action'})
  await expect(clarification.locator('.meeting-update-source')).toContainText('Update from: Mayra Mendoza')
  await expect(clarification.locator('.meeting-update-source')).toContainText('Posted Oct 22, 2026')
  await expect(clarification.locator('.meeting-update-source')).toContainText('Recorded Oct 26, 2026')
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
