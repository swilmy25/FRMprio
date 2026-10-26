import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildAleReadout } from '../src/aleDecisions'
import { dateHealth, isSourceSnapshot, orangeOnly, parseSource, peopleDirectory, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { meetingUpdatesByMember } from '../src/meetingSummaries'

const snapshot: SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json', import.meta.url), 'utf8'))
const activities = parseSource(snapshot)
const activity = (row: number) => activities.find(item => item.row === row)!
const today = '2026-10-26'

test('date corrections supersede overdue values without closing unfinished work or changing unrelated activities', () => {
  expect(activities).toHaveLength(50)
  expect(activity(40).end).toBe('2026-11-30')
  expect(activity(40).workbookEndRaw).toBe('11/31')
  expect(activity(40).start).toBe('2026-10-26')
  expect(activity(27).end).toBe('2026-12-31')
  expect(activity(27).workbookEndRaw).toBe('2026-10-15')
  expect(activity(27).status).toBe('In progress')
  expect(activity(22).end).toBe('2026-10-31')
  expect(activity(22).workbookEndRaw).toBe('2026-10-30')
  expect(activity(22).status).toBe('On track')
  for (const row of [22,27,40]) {
    expect(activity(row).completed).toBe(false)
    expect(dateHealth(activity(row), today).tone).toBe('scheduled')
  }
  expect(activity(21).completed).toBe(true)
  expect(activity(53).completed).toBe(true)
  expect(activity(18).status).toBe('On track')
  expect(activity(18).completed).toBe(false)
  expect(activity(18).end).toBe('2026-10-30')
})

test('current owners change independently of workbook ownership and update providers', () => {
  expect(activity(43).pwcOwners).toBe('Ben Oates')
  expect(activity(43).workbookPwcOwners).toBe('Mayra Mendoza')
  const owners = peopleDirectory(activities.map(item => item.pwcOwners), true)
  expect(owners.resolve(activity(56).pwcOwners)).toEqual(['Stephen Wilm','Mayra Mendoza','Layla Yang'])
  expect(owners.resolve(activity(57).pwcOwners)).toEqual(['Sonu Kumar','Mayra Mendoza','Layla Yang'])
  const groups = meetingUpdatesByMember(snapshot)
  const ben = groups.find(group => group.member === 'Ben Oates')!
  expect(ben.items.find(item => item.change.row === 43)?.providedBy).toBe('Mayra Mendoza')
  const sonu = groups.find(group => group.member === 'Sonu Kumar')!
  expect(sonu.items.some(item => item.change.row === 56)).toBe(false)
  const stephen = groups.find(group => group.member === 'Stephen Wilm')!
  const handoff = stephen.items.find(item => item.change.row === 56 && item.change.source === 'Sonu Kumar')!
  expect(handoff.providedBy).toBe('Sonu Kumar')
  expect(handoff.change.postedOn).toBe('2026-10-21')
  expect(handoff.change.recordedOn).toBe('2026-10-26')
})

test('reported control risk and PBC dependency escalate future targets with accurate next steps', () => {
  const oracle = activity(26), ads = activity(19)
  expect(oracle.status).toBe('At risk')
  expect(oracle.end).toBe('2026-10-30')
  expect(dateHealth(oracle, today).tone).toBe('escalation')
  expect(oracle.escalationReason).toContain('approval bypass')
  expect(oracle.meetingNotes.at(-1)?.text).toContain('wrong Oracle environment')
  expect(oracle.meetingNotes.at(-1)?.text).toContain('October 16')
  expect(oracle.meetingNotes.at(-1)?.text).toContain('planned for October 21')
  expect(ads.end).toBe('2026-11-15')
  expect(dateHealth(ads, today).tone).toBe('escalation')
  expect(dateHealth(ads, today).reasons).not.toContain('End date has passed; completion is not recorded')
  const readout = buildAleReadout(activities, today)
  expect(readout.escalations.find(item => item.topic === 'Oracle MCP')?.nextStep).toContain('@ssherugar')
  expect(readout.escalations.find(item => item.topic.includes('Phases 2 & 3'))?.nextStep).toContain('@sdp')
  expect(readout.escalations.some(item => item.topic === 'API Tokenization')).toBe(true)
})

test('Stripe pauses only its unresolved-date escalation and resumes normal checks when dates or risks change', () => {
  const stripe = activity(36)
  expect(stripe.completed).toBe(false)
  expect(stripe.status).toBe('Waiting on FRM')
  expect(stripe.endRaw).toBe('TBD')
  expect(dateHealth(stripe, today).tone).toBe('paused')
  expect(buildAleReadout(activities,today).escalations.some(item => item.topic === 'Stripe')).toBe(false)
  expect(dateHealth({...stripe,end:'2026-10-25',endRaw:'2026-10-25'},today).tone).toBe('escalation')
  expect(dateHealth({...stripe,end:'2026-10-30',endRaw:'2026-10-30'},today).tone).toBe('scheduled')
  expect(dateHealth({...stripe,endRaw:'11/31'},today).tone).toBe('escalation')
  expect(dateHealth({...stripe,escalationReason:'New confirmed blocker'},today).tone).toBe('escalation')
})

test('relative follow-up is anchored to the confirmed post date and pending TOD work is linked without merging buckets', () => {
  const revenue = activity(16)
  expect(revenue.followUpDate).toBe('2026-10-22')
  expect(revenue.endRaw).toBe('TBD')
  expect(dateHealth(revenue,today).reasons.join(' ')).toContain('checkpoint passed (2026-10-22)')
  expect(revenue.meetingNotes.at(-1)?.postedOn).toBe('2026-10-21')
  expect(revenue.meetingNotes.at(-1)?.recordedOn).toBe('2026-10-26')
  expect(activity(17).status).toBe('On hold')
  expect(activity(17).escalationAction).toContain('FRM’s hold decision')
  for (const row of [56,57]) {
    expect(activity(row).status).toBe('Waiting on FRM')
    expect(activity(row).escalationAction).toContain('TOD reassessment linked to Revenue')
  }
  expect(activities.filter(item => item.name.includes('OE Testing'))).toHaveLength(4)
  const exported = snapshotForLead(orangeOnly(snapshot), 'Avi')
  const imported = parseSource(JSON.parse(JSON.stringify(exported)))
  expect(imported.find(item => item.row === 43)?.pwcOwners).toBe('Ben Oates')
  expect(imported.find(item => item.row === 27)?.end).toBe('2026-12-31')
  const invalid = structuredClone(snapshot)
  invalid.annotations!['43'].notes.at(-1)!.postedOn = '2026-02-30'
  expect(isSourceSnapshot(invalid)).toBe(false)
})

test('portfolio, owner filters, dated source attribution, paused view and Ale-kazam all reflect the team updates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T18:00:00Z'))
  await page.goto('/')
  await page.getByLabel('Search source activities').fill('SDLC - Pando')
  await expect(page.locator('.detail-meta')).toContainText('PwC owners: Ben Oates')
  await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Workbook PwC owners (E): Mayra Mendoza')
  await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('posted Oct 21, 2026')
  await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('recorded Oct 26, 2026')
  await page.getByLabel('Search source activities').fill('Platform OE Testing')
  await page.locator('.workbook-filter-panel summary').filter({hasText:'PwC owner'}).click()
  const owner = page.getByRole('checkbox',{name:'PwC owner: Sonu Kumar',exact:true})
  await owner.check()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
  await expect(page.locator('.source-details h2')).toHaveText('Platform OE Testing — ITGCs')
  await owner.uncheck()
  await page.getByLabel('Search source activities').fill('')
  await page.getByLabel('Filter date status').selectOption('paused')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
  await expect(page.locator('.source-details h2')).toHaveText('Stripe')
  await expect(page.locator('.source-details')).toContainText('remains open in the portfolio')
  await expect(page.locator('.track')).toContainText('Escalation paused · awaiting FRM dates')
  await page.getByRole('button',{name:'Ale-kazam',exact:true}).click()
  const readout=page.getByRole('region',{name:'Alejandro’s leadership readout'})
  await expect(readout.getByRole('article',{name:'Escalations: Oracle MCP',exact:true})).toContainText('@Stephen Wilm')
  await expect(readout.getByRole('article',{name:'Escalations: SDLC — Pando',exact:true})).toContainText('@Ben Oates')
  for(const title of ['Stripe','AWS','Monitoring — Deloitte follow-up'])await expect(readout.getByRole('article',{name:`Escalations: ${title}`,exact:true})).toHaveCount(0)
})
