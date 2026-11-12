import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseSource, SOURCE_STORAGE } from '../src/prioritization'
import type { ActivityAnnotation, SourceActivity, SourceSnapshot } from '../src/prioritization'
import { buildTwoWeekPriorities } from '../src/priorityWindow'

const snapshot: SourceSnapshot = JSON.parse(readFileSync(new URL('../src/data/prioritization.json', import.meta.url), 'utf8'))
const today = '2026-11-09'
const names = (items: SourceActivity[]) => items.map(p => p.name)
const all = (plan: ReturnType<typeof buildTwoWeekPriorities>) => [...plan.attention, ...plan.firstWeek, ...plan.secondWeek, ...plan.starting, ...plan.ongoing]

function fixture(models: {name: string; start?: string; end?: string; lead?: string; frm?: string; pwc?: string; section?: string; annotation?: Partial<ActivityAnnotation>}[]): SourceSnapshot {
  const rows = snapshot.rows.slice(0, 2).map(row => [...row])
  const annotations: NonNullable<SourceSnapshot['annotations']> = {}, sections: Record<string, string> = {}
  for (const model of models) {
    const row = Array<string>(25).fill('')
    Object.assign(row, {2:model.name, 4:'Stephen Wilm', 5:model.lead ?? 'Avi', 6:model.frm ?? 'Moderate', 7:'Testing', 8:model.pwc ?? 'Moderate', 9:'Yes', 10:'Testing', 22:model.start ?? '2026-11-01', 23:model.end ?? '2026-12-31'})
    rows.push(row)
    sections[String(rows.length)] = model.section ?? 'Active portfolio'
    annotations[String(rows.length)] = {notes:[], ...model.annotation}
  }
  return {...snapshot, publicationId:undefined, rows, annotations, sections, changeLog:undefined, followUpTracker:undefined}
}

test('the rolling 14-day window keeps delivery boundaries, qualified dates, urgency and paused work distinct', () => {
  const data = parseSource(fixture([
    {name:'Overdue', end:'2026-11-08'},
    {name:'Priority decision', frm:'Low', pwc:'High'},
    {name:'Closed', end:'Completed', frm:'Low', pwc:'High'},
    {name:'Today', end:today},
    {name:'Week 1 end', end:'2026-11-15'},
    {name:'Week 2 start', end:'2026-11-16'},
    {name:'Week 2 end', end:'2026-11-22'},
    {name:'Approximate', end:'Around 2026-11-20'},
    {name:'Exclusive boundary', end:'Before 2026-11-23'},
    {name:'Later delivery', end:'2026-11-23'},
    {name:'Upcoming start', start:'2026-11-16', annotation:{statusOverride:'Planned'}},
    {name:'Future start', start:'2026-11-23', annotation:{statusOverride:'In progress'}},
    {name:'Future month', start:'December 2026', annotation:{statusOverride:'In progress'}},
    {name:'On hold', end:'TBD', annotation:{statusOverride:'On hold', escalationPaused:true}},
    {name:'Deprioritized', section:'Deprioritized'},
    {name:'Paused escalation, open delivery', end:'2026-11-15', annotation:{escalationResolution:{recordedOn:today,reason:'No escalation needed',startRaw:'2026-11-01',endRaw:'2026-11-15',followUpDate:null}}},
  ]))
  const plan = buildTwoWeekPriorities(data, today)
  expect([plan.start, plan.firstWeekEnd, plan.secondWeekStart, plan.end]).toEqual([today,'2026-11-15','2026-11-16','2026-11-22'])
  expect(names(plan.attention)).toEqual(['Overdue','Priority decision'])
  expect(names(plan.firstWeek)).toEqual(['Today','Week 1 end','Paused escalation, open delivery'])
  expect(names(plan.secondWeek)).toEqual(['Week 2 start','Approximate','Week 2 end','Exclusive boundary'])
  expect(names(plan.starting)).toEqual(['Upcoming start'])
  expect(names(plan.ongoing)).toEqual(['Later delivery'])
  expect(plan.actions.get(data[1].id)).toContain('PwC High versus FRM Low')
  expect(new Set(all(plan).map(p => p.id)).size).toBe(plan.total)
})

test('FRM contact scoping retains shared projects once and ranks FRM priority before PwC for ongoing work', () => {
  const data = parseSource(fixture([
    {name:'Shared', lead:'Sudhika & Chandana', end:'2026-11-15'},
    {name:'Chandana only', lead:'Chandana', frm:'High', pwc:'High'},
    {name:'Avi only', lead:'Avi'},
    {name:'Unassigned', lead:''},
    {name:'Lower active', lead:'Chandana', frm:'Low', pwc:'Low'},
    {name:'Moderate active', lead:'Chandana'},
  ]))
  const plan = buildTwoWeekPriorities(data, today, 'Chandana')
  expect(names(plan.firstWeek)).toEqual(['Shared'])
  expect(names(plan.ongoing)).toEqual(['Chandana only','Moderate active','Lower active'])
  expect(names(all(buildTwoWeekPriorities(data, today, 'Sudhika')))).toEqual(['Shared'])
  expect(all(buildTwoWeekPriorities(data, today)).filter(p => p.name === 'Shared')).toHaveLength(1)
  expect(names(all(buildTwoWeekPriorities(data, today)))).toContain('Unassigned')
  expect(buildTwoWeekPriorities(data, today, 'Nobody').total).toBe(0)
})

test('overall priorities show dates and owners, stay visible through timeline filters and open the chosen project', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'))
  await page.goto('/')
  const section = page.getByRole('region', {name:'Next two weeks priorities'})
  await expect(section).toContainText('Nov 12, 2026 – Nov 25, 2026')
  await expect(section).toContainText('Priorities across the full portfolio')
  const attention = section.getByRole('region', {name:'Priorities needing attention'})
  await expect(attention.getByRole('article')).toHaveCount(8)
  await expect(attention).toContainText('AI Governance / Oracle MCP')
  await expect(attention).toContainText('Sudhika')
  await expect(attention).toContainText('Joaquin Garcia Stephen Wilm')
  await expect(section.getByRole('article', {name:/Revenue new controls|Vertex \(ITGCs\)/})).toHaveCount(0)
  await expect(section.getByRole('region', {name:'Week 2 delivery priorities'})).toContainText('Around Nov 20, 2026')
  await expect(section.getByRole('region', {name:'Upcoming project starts'})).toContainText('Nov 16, 2026')
  await section.getByRole('region', {name:'Week 1 delivery priorities'}).locator('summary').click()
  await expect(section.getByRole('article', {name:'DCGM scoping',exact:true})).toContainText('Before Nov 13, 2026')
  await expect(section.getByRole('article', {name:'Non-GAAP metrics',exact:true})).toContainText('July 2026 · month only')
  await expect(section.getByRole('article', {name:'Ads New ITAC Controls — Phases 2 & 3',exact:true})).not.toContainText('Escalation needed')
  await page.getByLabel('Search source activities').fill('no matches')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(0)
  await expect(attention.getByRole('article')).toHaveCount(8)
  await section.getByRole('button', {name:'View DCGM scoping project details',exact:true}).click()
  await expect(page.locator('.source-details h2')).toHaveText('DCGM scoping')
  await expect(page.getByLabel('Search source activities')).toHaveValue('')
  await expect(page.locator('.source-details')).toBeInViewport()
})

test('sidebar contact views, reload and mobile preserve two-week scope and shared ownership', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'))
  await page.goto('/')
  await page.locator('.sidebar').getByRole('button', {name:'Chandana view',exact:true}).click()
  const section = page.getByRole('region', {name:'Next two weeks priorities'})
  await expect(section).toContainText('Priorities for Chandana')
  await expect(section.getByRole('article', {name:'HR/Payroll late terminations — impact assessment support',exact:true})).toHaveCount(1)
  await expect(section.getByRole('article', {name:'AI Governance / Oracle MCP',exact:true})).toHaveCount(0)
  await section.locator('.fortnight-ongoing > summary').click()
  for (const article of await section.getByRole('article').all()) await expect(article.locator('.fortnight-owners')).toContainText('Chandana')
  await section.getByRole('button', {name:'Collapse next two weeks',exact:true}).click()
  await expect(section.getByRole('button', {name:'Expand next two weeks',exact:true})).toHaveAttribute('aria-expanded','false')
  await expect(section.getByRole('heading', {name:'Next two weeks',exact:true})).toBeVisible()
  await expect(section.locator('.fortnight-weeks')).toBeHidden()
  await page.reload()
  await expect(section.locator('.fortnight-heading')).toContainText('FRM FOCUS · Chandana')
  await expect(section.getByRole('button', {name:'Expand next two weeks',exact:true})).toHaveAttribute('aria-expanded','false')
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.locator('.view-tabs').getByRole('button', {name:'Project dashboard',exact:true}).click()
  await expect(section.getByRole('button', {name:'Expand next two weeks',exact:true})).toHaveAttribute('aria-expanded','false')
  await expect(section.locator('.fortnight-weeks')).toBeHidden()
  await section.screenshot({path:'/tmp/frmprio-two-week-collapsed-mobile.png'})
  await section.getByRole('button', {name:'Expand next two weeks',exact:true}).press('Enter')
  await expect(section.getByRole('button', {name:'Collapse next two weeks',exact:true})).toHaveAttribute('aria-expanded','true')
  await expect(section).toContainText('Priorities across the full portfolio')
  await expect(section.getByRole('region', {name:'Priorities needing attention'})).toBeVisible()
  await page.screenshot({path:'/tmp/frmprio-two-week-mobile.png',fullPage:true})
})

test('the two-week dates roll forward at Pacific midnight without reloading', async ({page}) => {
  await page.clock.install({time:new Date('2026-11-10T07:59:30Z')})
  await page.addInitScript(({key,data}) => localStorage.setItem(key,JSON.stringify(data)), {key:SOURCE_STORAGE,data:fixture([{name:'Rollover delivery',end:'2026-11-09'}])})
  await page.goto('/')
  const section = page.getByRole('region', {name:'Next two weeks priorities'})
  await expect(section).toContainText('Nov 9, 2026 – Nov 22, 2026')
  await page.clock.fastForward(61000)
  await expect(section).toContainText('Nov 10, 2026 – Nov 23, 2026')
  await expect(section.getByRole('region', {name:'Priorities needing attention'})).toContainText('Rollover delivery')
})
