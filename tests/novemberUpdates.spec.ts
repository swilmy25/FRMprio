import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dateHealth, isSourceSnapshot, knownTotals, orangeOnly, parseSource, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { meetingUpdatesByMember } from '../src/meetingSummaries'

const snapshot:SourceSnapshot=JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))
const activities=parseSource(snapshot)
const azure=activities.find(item=>item.row===60)!

test('explicit scope survives orange projection and scoped exports without inventing actuals or an allocation',()=>{
 expect(azure.reportedScope).toEqual({controlCount:8,hours:200})
 expect(azure.pwcOwners).toBe('Sonu Kumar')
 expect(azure.end).toBe('2027-01-15')
 expect(azure.start).toBeNull()
 expect(azure.frmLeads).toBe('Avi')
 expect(azure.staffing).toBe('Odinga, Matthew')
 expect(azure.actual).toBeNull()
 expect(azure.remaining).toBeNull()
 expect(knownTotals(activities)).toEqual(knownTotals(activities.filter(item=>item.row!==60)))
 const withLead=structuredClone(snapshot)
 withLead.rows[59][5]='Example lead'
 withLead.annotations!['60'].frmLeadsOverride='Example lead'
 const exported=snapshotForLead(orangeOnly(withLead),'Example lead')
 expect(isSourceSnapshot(exported)).toBe(true)
 expect(parseSource(JSON.parse(JSON.stringify(exported)))[0].reportedScope).toEqual(azure.reportedScope)
 for(const badScope of [{controlCount:8.5,hours:200},{controlCount:8,hours:-1},{controlCount:8,hours:'200'}]){
  const invalid=JSON.parse(JSON.stringify(snapshot))
  invalid.annotations['60'].reportedScope=badScope
  expect(isSourceSnapshot(invalid)).toBe(false)
 }
 const oracle=activities.find(item=>item.row===26)!
 const groups=meetingUpdatesByMember(snapshot)
 expect(groups.find(group=>group.member==='Sonu Kumar')?.items.some(item=>item.change.row===26)).toBe(false)
 expect(groups.find(group=>group.member==='Stephen Wilm')?.items.find(item=>item.change.row===26&&item.change.recordedOn==='2026-11-02')?.providedBy).toBe('Sonu Kumar')
 expect(oracle.pwcOwners).toBe('Joaquin Garcia Stephen Wilm')
 expect(oracle.completed).toBe(false)
 expect(dateHealth(oracle,'2026-11-02').tone).toBe('escalation')
 const vertex=activities.find(item=>item.row===35)!
 expect(vertex.completed).toBe(true)
 expect(vertex.status).toBe('Completed')
 expect(vertex.end).toBeNull()
 expect(vertex.workbookEndRaw).toBe('2026-10-30')
 expect(dateHealth(vertex,'2026-11-09').tone).toBe('completed')
})

test('scope is visible, staffing stays in details, and Oracle remains open while Vertex is now closed',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-04T18:00:00Z'))
 await page.goto('/')
 await page.getByLabel('Search source activities').fill('Azure Platform')
 await expect(page.locator('.project-cell > strong[title="Azure Platform"]')).toHaveCount(1)
 await page.locator('.project-cell > strong[title="Azure Platform"]').click()
 await expect(page.locator('.reported-scope-summary')).toHaveText('8 controls · 200 hrs reported')
 await expect(page.locator('.workbook-table')).not.toContainText('Odinga')
 await expect(page.locator('.workbook-table')).not.toContainText('Matthew')
 await expect(page.getByRole('region',{name:'Reported scope and effort'})).toContainText('8 controls · 200 hours')
 await expect(page.locator('.staffing-detail')).toContainText('Odinga, Matthew')
 await expect(page.locator('.source-date-facts')).toContainText('Jan 15, 2027')
 await expect(page.locator('.detail-meta')).toContainText('Sonu Kumar')
 await expect(page.locator('.detail-meta')).toContainText('FRM leads: Avi')
 const downloadPromise=page.waitForEvent('download')
 await page.getByRole('button',{name:'Export',exact:false}).click()
 const exported:SourceSnapshot=JSON.parse(readFileSync((await (await downloadPromise).path())!,'utf8'))
 expect(parseSource(exported).find(item=>item.row===60)?.reportedScope).toEqual(azure.reportedScope)
 await page.getByLabel('Search source activities').fill('Oracle MCP')
 await expect(page.locator('.source-details h2')).toHaveText('AI Governance / Oracle MCP')
 await expect(page.locator('.source-date-facts')).toContainText('Nov 15, 2026')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Sonu believes all required Oracle MCP evidence')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('expected by the end of the week')
 await expect(page.locator('.date-escalation-panel')).toContainText('Deficiency wording has been shared with Sudhika')
 await page.getByLabel('Search source activities').fill('Vertex')
 await expect(page.locator('.workbook-row.date-escalation')).toHaveCount(0)
 await expect(page.locator('.workbook-row.date-completed')).toHaveCount(1)
 await expect(page.locator('.source-details')).toContainText('Status: Completed')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('one piece of evidence needs to be updated')
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
