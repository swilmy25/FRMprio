import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { activitiesForLead, dateHealth, isSourceSnapshot, orangeOnly, ORANGE_COLUMNS, parseSource, peopleDirectory, snapshotForLead, SOURCE_STORAGE } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { meetingUpdatesByMember, uniqueMeetingItems, UNRECORDED_PWC_OWNER } from '../src/meetingSummaries'
const snapshot:SourceSnapshot=JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))
const activities=parseSource(snapshot)
const activity=(row:number)=>activities.find(p=>p.row===row)!
const verifiedOwners:{ownersByRow:Record<string,string[]>}=JSON.parse(readFileSync(new URL('./fixtures/workbook-pwc-owners.json',import.meta.url),'utf8'))

test('latest workbook and meeting decisions retain provenance and apply the requested dates',()=>{
 expect(isSourceSnapshot(snapshot)).toBe(true)
 expect(activities).toHaveLength(45)
 expect(activity(34).end).toBe('2026-10-30')
 expect(activity(34).meetingNotes[0].applicationNote).toContain('supersedes the earlier TBD')
 expect(activity(12).end).toBe('2026-10-23')
 expect(activity(12).workbookEndRaw).toBe('2026-10-15')
 expect(activity(12).meetingNotes[0].source).toBe('Mayra')
 expect(activity(35).end).toBe('2026-10-31')
 expect(activity(35).workbookEndRaw).toBe('2026-10-30')
 for(const row of [16,17,36]){
  expect(activity(row).endRaw).toBe('TBD')
  expect(dateHealth(activity(row),'2026-10-20').tone).toBe('escalation')
 }
 expect(snapshot.rows.every(row=>row.every((value,i)=>ORANGE_COLUMNS.includes(i)||value===''))).toBe(true)
})
test('completed closures are distinct from testing and future IronClad scope remains planned',()=>{
 expect(activities.filter(p=>p.completed)).toHaveLength(8)
 for(const row of [8,21,37])expect(activity(row).section).toBe('Completed')
 expect(activity(37).closureReason).toBe('Not assessed in FY26')
 expect(dateHealth(activity(37),'2026-10-20').label).toBe('Closed · not assessed in FY26')
 expect(activity(9).name).toContain('2027')
 expect(activity(9).completed).toBe(false)
 expect(activity(5).completed).toBe(true)
})
test('named removals leave AWS and Project Keystone intact and preserve revenue merge context',()=>{
 for(const row of [38,39,42])expect(activities.find(p=>p.row===row)).toBeUndefined()
 expect(activities.some(p=>p.name==='Azure'||p.name==='SDLC - Keystone'||p.name.startsWith('Non-Rev controls'))).toBe(false)
 expect(activity(40).name).toBe('AWS')
 expect(activity(40).endRaw).toBe('11/31')
 expect(dateHealth(activity(40),'2026-10-20').tone).toBe('escalation')
 expect(activity(34).name).toContain('Project Keystone')
 expect(activity(16).mergedActivities).toHaveLength(1)
 expect(activity(16).mergedActivities[0].name).toContain('Databricks - Orion')
 for(const lead of ['Ash','Urminder'])expect(activitiesForLead(activities,lead).filter(p=>p.row===16)).toHaveLength(1)
 const exported=snapshotForLead(snapshot,'Ash')
 expect(isSourceSnapshot(exported)).toBe(true)
 expect(parseSource(orangeOnly(exported)).find(p=>p.row===16)?.meetingNotes).toHaveLength(2)
 expect(Object.keys(exported.annotations??{}).every(row=>parseSource(exported).some(p=>p.row===Number(row)))).toBe(true)
})
test('notes and original workbook values are visible, merged context is searchable, and Nano is clearly closed',async({page})=>{
 await page.goto('/')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
 await page.getByLabel('Search source activities').fill('API Tokenization')
 await expect(page.locator('.source-date-facts')).toContainText('Oct 23, 2026')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('2026-10-15')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Mayra')
 await page.getByLabel('Search source activities').fill('Databricks - Orion')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
 await expect(page.getByRole('region',{name:'Merged activity context'})).toContainText('Original source row 39')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('FRM confirmation of scoping')
 await page.getByLabel('Search source activities').fill('Nano')
 await expect(page.locator('.workbook-row.date-completed')).toHaveCount(1)
 await expect(page.locator('.source-details')).toContainText('this is not completed testing')
 await expect(page.locator('.completed-marker')).toContainText('not assessed in FY26')
 await page.reload()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
})
test('a browser-local import can explicitly return to the published workbook and decisions',async({page})=>{
 const local=structuredClone(snapshot);delete local.publicationId;delete local.annotations;delete local.changeLog
 await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data))},{key:SOURCE_STORAGE,data:local})
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Load published update'})).toBeVisible()
 page.once('dialog',dialog=>dialog.accept())
 await page.getByRole('button',{name:'Load published update'}).click()
 await page.getByLabel('Search source activities').fill('API Tokenization')
 await expect(page.locator('.source-date-facts')).toContainText('Oct 23, 2026')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Mayra')
})

test('member summaries distinguish moved dates, confirmed dates, new TBDs and existing TBDs',()=>{
 const groups=meetingUpdatesByMember(snapshot)
 expect(groups.filter(group=>!group.unassigned).map(group=>group.member)).toEqual(['Jeff Rose','Joaquin Garcia','Layla Yang','Mayra Mendoza','Nareg Seukunian','Sonu Kumar'])
 expect(groups.find(group=>group.unassigned)?.member).toBe(UNRECORDED_PWC_OWNER)
 const items=uniqueMeetingItems(groups)
 expect(items).toHaveLength(15)
 const rows=(flag:string)=>items.filter(item=>item.change.flags?.some(value=>value===flag)).map(item=>item.change.row).sort((a,b)=>a!-b!)
 expect(rows('date-moved')).toEqual([12,35])
 expect(rows('date-confirmed')).toEqual([34])
 expect(rows('new-tbd')).toEqual([16,36])
 expect(rows('existing-tbd')).toEqual([17])
 const scoped=meetingUpdatesByMember(snapshotForLead(snapshot,'Avi'))
 expect(scoped.find(group=>group.member==='Layla Yang')?.items).toHaveLength(2)
 const malformed=structuredClone(snapshot)
 Object.assign(malformed.changeLog![0],{flags:['unknown-flag']})
 expect(isSourceSnapshot(malformed)).toBe(false)
 const legacy=structuredClone(snapshot)
 legacy.changeLog?.forEach(change=>{delete change.flags})
 expect(isSourceSnapshot(legacy)).toBe(true)
})

test('all dashboard and meeting owners match the uploaded worksheet, with Jeff attributed only to his owned activity',()=>{
 const directory=peopleDirectory(activities.map(item=>item.pwcOwners),true)
 for(const item of activities)expect(directory.resolve(item.pwcOwners),`Worksheet E at row ${item.row}`).toEqual(verifiedOwners.ownersByRow[String(item.row)])
 const groups=meetingUpdatesByMember(snapshot)
 for(const group of groups){
  for(const item of group.items){
   const expected=item.change.row?verifiedOwners.ownersByRow[String(item.change.row)]:[]
   expect(item.pwcOwners,`Meeting ownership at row ${item.change.row}`).toEqual(expected)
   if(!group.unassigned)expect(expected).toContain(group.member)
  }
 }
 const jeff=groups.find(group=>group.member==='Jeff Rose')!
 expect(jeff.items.map(item=>item.change.row)).toEqual([8])
 const mayra=groups.find(group=>group.member==='Mayra Mendoza')!
 expect(mayra.items.filter(item=>item.change.source==='Jeff').map(item=>item.change.row)).toEqual([16,17,36,38])
 expect(mayra.items.find(item=>item.change.row===36)?.pwcOwners).toEqual(['Joaquin Garcia','Mayra Mendoza'])
 expect(groups.find(group=>group.unassigned)?.items.map(item=>item.change.activity)).toEqual(['Non-Rev controls'])
 const exported=snapshotForLead(snapshot,'Avi')
 expect(meetingUpdatesByMember(exported).find(group=>group.member==='Mayra Mendoza')?.items.some(item=>item.change.row===38)).toBe(true)
})

test('shared and removed updates use recorded ownership and never infer an owner from the note provider',()=>{
 const example=structuredClone(snapshot)
 example.annotations=undefined
 example.rows=example.rows.map((row,i)=>i<2?row:row.map(()=>''))
 example.rows[2]=[...snapshot.rows[2]];example.rows[2][4]='Mayra Mendoza, Joaquin Garcia, Mayra'
 example.rows[3]=[...snapshot.rows[3]];example.rows[3][4]=''
 example.changeLog=[
  {source:'Jeff',recordedOn:'2026-10-20',row:3,activity:'Shared',detail:'Shared update',pwcOwners:'Jeff Rose',flags:['new-tbd']},
  {source:'Jeff',recordedOn:'2026-10-20',row:4,activity:'Unowned',detail:'Blank worksheet owner',pwcOwners:'Jeff Rose'},
  {source:'Jeff',recordedOn:'2026-10-20',row:38,activity:'Removed',detail:'Removed activity',pwcOwners:'Mayra Mendoza'},
  {source:'Jeff',recordedOn:'2026-10-20',activity:'Unknown',detail:'No recorded owner'},
 ]
 const groups=meetingUpdatesByMember(example)
 expect(groups.some(group=>group.member==='Jeff Rose')).toBe(false)
 expect(groups.find(group=>group.member==='Mayra Mendoza')?.items.map(item=>item.change.row)).toEqual([3,38])
 expect(groups.find(group=>group.member==='Joaquin Garcia')?.items.map(item=>item.change.row)).toEqual([3])
 expect(groups.find(group=>group.unassigned)?.items).toHaveLength(2)
 expect(uniqueMeetingItems(groups)).toHaveLength(4)
 expect(uniqueMeetingItems(groups).filter(item=>item.change.flags?.includes('new-tbd'))).toHaveLength(1)
})

test('Layla updates only the additional monitoring follow-up and current Engine Manager UI scope',()=>{
 expect(activity(27).status).toBe('In progress')
 expect(activity(27).completed).toBe(false)
 expect(activity(27).end).toBe('2026-10-15')
 expect(activity(27).workbookEndRaw).toBe('2026-10-15')
 expect(activity(27).meetingNotes[0].text).toContain('Sarah')
 expect(dateHealth(activity(27),'2026-10-20').tone).toBe('escalation')
 expect(activity(53).completed).toBe(true)
 expect(activity(45).completed).toBe(true)
 expect(activity(45).section).toBe('Completed')
 expect(activity(45).end).toBeNull()
 expect(activity(45).workbookEndRaw).toBe('2026-10-30')
 expect(activity(46).completed).toBe(false)
 expect(activity(54).completed).toBe(true)
})

test('member and focus filters show before/after dates and actionable TBDs without filtering the Gantt',async({page})=>{
 await page.goto('/')
 const summaries=page.getByRole('region',{name:'Meeting updates by PwC owner'})
 await summaries.locator('summary').click()
 await expect(summaries.getByRole('article')).toHaveCount(7)
 const mayra=summaries.getByRole('article',{name:'Mayra Mendoza meeting updates'})
 await expect(mayra).toContainText('Oct 15, 2026 → Oct 23, 2026')
 await expect(mayra).toContainText('Oct 30, 2026 → Oct 31, 2026')
 await summaries.getByRole('button',{name:'New TBDs',exact:true}).click()
 await expect(summaries.getByRole('article')).toHaveCount(2)
 await expect(summaries).toContainText('Nov 15, 2026 → TBD')
 await expect(summaries).toContainText('Oct 30, 2026 → TBD')
 await expect(summaries.getByRole('button',{name:'View IT Ops / Chronosphere activity'})).toHaveCount(0)
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
 await expect(mayra.locator('li').filter({hasText:'Stripe'})).toContainText('PwC owners: Joaquin Garcia, Mayra Mendoza')
 await expect(mayra.locator('li').filter({hasText:'Stripe'})).toContainText('Update provided by Jeff')
 await summaries.getByRole('button',{name:'Jeff Rose',exact:false}).click()
 await expect(summaries.getByRole('article')).toHaveCount(0)
 await expect(summaries).toContainText('No meeting updates match these filters')
 await summaries.getByRole('button',{name:'All updates',exact:true}).click()
 await expect(summaries.getByRole('article')).toContainText('IronClad')
 for(const title of ['Stripe','Revenue new controls','IT Ops / Chronosphere','Azure'])await expect(summaries.getByRole('article')).not.toContainText(title)
 await summaries.getByRole('button',{name:'Mayra Mendoza',exact:false}).click()
 await summaries.getByRole('button',{name:'Existing TBDs',exact:true}).click()
 await expect(summaries.getByRole('article')).toContainText('already TBD in workbook')
 await expect(summaries.getByRole('article')).toContainText('IT Ops / Chronosphere')
 await expect(summaries.getByRole('article')).not.toContainText('New TBD')
})

test('Layla summaries link to the scoped activities, preserve their status and export the follow-up',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-20T18:00:00Z'))
 await page.goto('/#lead=Avi')
 const summaries=page.getByRole('region',{name:'Meeting updates by PwC owner'})
 await summaries.locator('summary').click()
 await summaries.getByRole('button',{name:'Layla Yang',exact:false}).click()
 await expect(summaries.getByRole('article')).toHaveCount(1)
 await expect(summaries).toContainText('after meeting with Sarah')
 await expect(summaries).toContainText('Oct 15, 2026 has passed')
 await page.getByLabel('Search source activities').fill('no matching project')
 await summaries.getByRole('button',{name:'View Monitoring — Deloitte follow-up activity',exact:true}).click()
 await expect(page.locator('.source-details h2')).toContainText('additional followup')
 await expect(page.locator('.source-details')).toContainText('Status: In progress')
 await expect(page.getByRole('region',{name:'Meeting context'})).toContainText('Sarah')
 await summaries.getByRole('button',{name:'View Engine Manager UI Change activity',exact:true}).click()
 await expect(page.locator('.source-details h2')).toHaveText('Engine Manager UI Change')
 await expect(page.locator('.source-details')).toContainText('exact actual end date not supplied')
 const downloadPromise=page.waitForEvent('download')
 await page.getByRole('button',{name:'Export',exact:false}).click()
 const download=await downloadPromise
 const exported:SourceSnapshot=JSON.parse(readFileSync((await download.path())!,'utf8'))
 expect(isSourceSnapshot(exported)).toBe(true)
 expect(parseSource(exported).find(item=>item.row===27)?.status).toBe('In progress')
 expect(exported.changeLog?.find(change=>change.row===27)?.discussion).toContain('Sarah')
})

test('mobile member summaries stay inside the viewport and empty focus filters can be cleared',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 const summaries=page.getByRole('region',{name:'Meeting updates by PwC owner'})
 await summaries.locator('summary').click()
 await summaries.getByRole('button',{name:'Layla Yang',exact:false}).click()
 await summaries.getByRole('button',{name:'New TBDs',exact:true}).click()
 await expect(summaries).toContainText('No meeting updates match these filters')
 await summaries.getByRole('button',{name:'Clear meeting filters',exact:true}).click()
 await expect(summaries.getByRole('article')).toHaveCount(7)
 await summaries.getByRole('button',{name:'View Monitoring — Deloitte follow-up activity',exact:true}).click()
 await expect(page.locator('.source-details h2')).toContainText('additional followup')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
