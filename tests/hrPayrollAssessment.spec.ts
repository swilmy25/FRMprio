import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { activitiesForLead, dateHealth, isSourceSnapshot, knownTotals, orangeOnly, parseSource, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { buildAleReadout } from '../src/aleDecisions'

const snapshot:SourceSnapshot=JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))
const activities=parseSource(snapshot)
const assessment=activities.find(item=>item.row===59)!

test('assessment captures ownership, proposed priority, PBC workflow and the conditional OE-exception trigger without inventing outcomes',()=>{
 expect(assessment.name).toContain('HR/Payroll late terminations')
 expect(assessment.pwcOwners).toBe('Stephen Wilm')
 expect(assessment.frmLeads).toBe('Sudhika & Chandana')
 expect(assessment.pwcPriority).toBe('High')
 expect(assessment.frmPriority).toBe('')
 expect(assessment.startRaw).toBe('TBD')
 expect(assessment.endRaw).toBe('TBD')
 expect(assessment.completed).toBe(false)
 expect(assessment.status).toBe('In progress')
 const notes=assessment.meetingNotes.map(note=>note.text+' '+note.applicationNote).join(' ')
 expect(notes).toContain('Approximately 20 terminations')
 expect(notes).toContain('actual termination date')
 expect(notes).toContain('relevant user access review')
 expect(notes).toContain('Network, DB and Application')
 expect(notes).toContain('raise an OE exception immediately')
 expect(notes).toContain('not a count of confirmed UAR exceptions')
 expect(notes).toContain('from Adi')
 expect(notes).toContain('HR Ops review')
 expect(assessment.staffing).toContain('@cloie.vonmassenhausen')
 expect(dateHealth(assessment,'2026-10-26').tone).toBe('escalation')
 const item=buildAleReadout(activities,'2026-10-26').escalations.find(item=>item.activityId===assessment.id)!
 expect(item.owners).toEqual(['Stephen Wilm'])
 expect(item.frmOwners).toEqual(['Sudhika','Chandana'])
 expect(item.nextStep).toContain('Agree Stephen’s scope and hours with Cloie')
})

test('planning range is a scoped proposal, survives both lead exports and never becomes actual or allocated hours',()=>{
 const plan=assessment.planningEstimate!
 expect(plan.status).toBe('Proposed')
 expect([plan.minHours,plan.maxHours]).toEqual([40,80])
 expect(plan.breakdown.reduce((sum,item)=>sum+item.minHours,0)).toBe(40)
 expect(plan.breakdown.reduce((sum,item)=>sum+item.maxHours,0)).toBe(80)
 expect(plan.allocationNote).toContain('do not allocate the entire range to Stephen')
 expect(plan.scope).toContain('not a team-provided commitment')
 expect(assessment.estimate).toBeNull()
 expect(assessment.actual).toBeNull()
 expect(knownTotals(activities)).toEqual(knownTotals(activities.filter(item=>item.row!==59)))
 for(const lead of ['Sudhika','Chandana']){
  expect(activitiesForLead(activities,lead).filter(item=>item.row===59)).toHaveLength(1)
  const exported=snapshotForLead(snapshot,lead)
  expect(isSourceSnapshot(exported)).toBe(true)
  expect(parseSource(orangeOnly(JSON.parse(JSON.stringify(exported))))).toContainEqual(expect.objectContaining({row:59,planningEstimate:plan}))
 }
 const invalid=structuredClone(snapshot)
 invalid.annotations!['59'].planningEstimate!.breakdown[0].minHours=9
 expect(isSourceSnapshot(invalid)).toBe(false)
 invalid.annotations!['59'].planningEstimate!.breakdown[0].minHours=8
 invalid.annotations!['59'].planningEstimate!.maxHours=-1
 expect(isSourceSnapshot(invalid)).toBe(false)
})

test('dashboard exposes the proposed range, owner allocation gap, procedures and separately attributed estimate in exports',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-28T18:00:00Z'))
 await page.goto('/')
 await page.getByLabel('Search source activities').fill('HR/Payroll')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
 await expect(page.locator('.detail-meta')).toContainText('Stephen Wilm')
 await expect(page.locator('.detail-meta')).toContainText('Sudhika & Chandana')
 await expect(page.locator('.planning-estimate-summary')).toHaveText('Full scope: 40–80 hrs · proposed')
 const plan=page.getByRole('region',{name:'Proposed effort estimate'})
 await expect(plan).toContainText('Full assessment: 40–80 hours')
 await expect(plan).toContainText('Stephen’s incremental commitment: To be confirmed')
 await expect(plan).toContainText('Allocation pending')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('If a late termination went undetected')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Planning estimate')
 await expect(page.locator('.workbook-table')).not.toContainText('@cloie.vonmassenhausen')
 const downloadPromise=page.waitForEvent('download')
 await page.getByRole('button',{name:'Export',exact:false}).click()
 const download=await downloadPromise
 const exported:SourceSnapshot=JSON.parse(readFileSync((await download.path())!,'utf8'))
 expect(isSourceSnapshot(exported)).toBe(true)
 expect(parseSource(exported).find(item=>item.row===59)?.planningEstimate).toEqual(assessment.planningEstimate)
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
