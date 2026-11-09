import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dateHealth, isSourceSnapshot, orangeOnly, parseSource, snapshotForLead } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
import { followUpSnapshot } from '../src/followUpTracker'
import { buildAleReadout } from '../src/aleDecisions'

const snapshot:SourceSnapshot=JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))
const activities=parseSource(snapshot),actionSnapshot=followUpSnapshot(snapshot)!
const actions=parseSource(actionSnapshot)
const project=(row:number)=>activities.find(p=>p.row===row)!
const action=(row:number)=>actions.find(p=>p.row===row)!
const today='2026-11-09'

test('explicit escalation closures preserve open work and reopen on a changed plan or new risk',()=>{
 const closed=[34,60,61,62,64,65,66]
 for(const row of closed){
  const p=project(row)
  expect(p.completed).toBe(false)
  expect(dateHealth(p,today)).toMatchObject({tone:'paused',label:'Escalation closed'})
  expect(dateHealth(p,'2026-11-08').tone).toBe('escalation')
  expect(dateHealth({...p,endRaw:'2026-10-01',end:'2026-10-01'},today).tone).toBe('escalation')
  expect(dateHealth({...p,escalationReason:'New confirmed blocker'},today).tone).toBe('escalation')
  expect(dateHealth({...p,status:'At risk'},today).tone).toBe('escalation')
  expect(dateHealth({...p,followUpDate:'2026-11-08'},today).tone).toBe('escalation')
 }
 const readout=buildAleReadout(activities,today)
 expect(readout.escalations.some(p=>closed.includes(Number(p.activityId.replace('source-row-',''))))).toBe(false)
 expect(readout.escalations.some(p=>p.activityId==='source-row-77')).toBe(true)
 expect(readout.escalations.some(p=>p.activityId==='source-row-20')).toBe(true)
 for(const row of [7,14,15,20,29])expect(dateHealth(action(row),today).label).toBe('Escalation closed')
 expect(project(6)).toMatchObject({pwcOwners:'Sonu Kumar',frmLeads:'Avi',completed:false})
 expect(project(6).escalationResolution).toBeUndefined()
 expect(action(15).frmLeads).toBe('Ash')
 for(const row of [23,35]){
  expect(action(row).completed).toBe(false)
  expect(action(row).escalationResolution).toBeUndefined()
  expect(action(row).end).toBe('2026-11-30')
 }
 for(const row of [40,60,66])expect(project(row).end).toBe('2027-01-15')
 expect(action(48)).toMatchObject({completed:false,end:'2026-11-11'})
})

test('before-date boundaries, delivery forecasts and named roles retain their precision',()=>{
 const dcgm=project(67)
 expect(dcgm).toMatchObject({pwcOwners:'Layla Yang',frmLeads:'Avi',endRaw:'Before 2026-11-13',end:'2026-11-13',completed:false})
 expect(dateHealth(dcgm,'2026-11-12').tone).toBe('scheduled')
 expect(dateHealth(dcgm,'2026-11-13').tone).toBe('escalation')
 expect(dateHealth({...dcgm,start:'2026-11-13'},'2026-11-12').tone).toBe('escalation')
 expect(action(32)).toMatchObject({pwcOwners:'Layla Yang',endRaw:dcgm.endRaw,end:dcgm.end})
 expect(action(32).trackerActions[0]).toMatchObject({addedBy:'FRM / PwC',deadline:'2026-11-06'})
 expect(project(19).end).toBe('2026-11-15')
 expect(project(19).meetingNotes.at(-1)?.text).toContain('November 13')
 expect(project(19).meetingNotes.at(-1)?.applicationNote).toContain('not assumed to replace')
 expect(project(18).completed).toBe(true)
 expect(project(20).completed).toBe(false)
 for(const row of [26,77])expect(project(row).leadershipPriority).toContain('Top priority')
 expect(project(26).pwcOwners).toBe('Joaquin Garcia Stephen Wilm')
 expect(project(77)).toMatchObject({pwcOwners:'',frmLeads:'Sudhika',start:null,end:null,completed:false,discoverySource:'Slack via FRMprio Buddy'})
 expect(project(77).pwcPriority).toBe('')
 expect(activities.filter(p=>p.newlyTrackedOn===today)).toHaveLength(5)
 expect(activities.some(p=>/new compute applications/i.test(p.name))).toBe(false)
})

test('Buddy and Slack provenance survive round trips and lead scoping; unsafe or malformed metadata is rejected',()=>{
 const exported=snapshotForLead(orangeOnly(snapshot),'Avi')
 expect(isSourceSnapshot(exported)).toBe(true)
 const p=parseSource(JSON.parse(JSON.stringify(exported))).find(p=>p.row===67)!
 expect(p.meetingNotes.at(-1)).toMatchObject({source:'Layla Yang',postedOn:today,recordedOn:today,via:'FRMprio Buddy',sourceUrl:'https://openai.enterprise.slack.com/archives/C0C9A94KGQN/p1794244067723979'})
 expect(p.meetingNotes.at(-1)?.readoutUrl).toContain('https://chatgpt.com/c/')
 expect(exported.followUpTracker?.annotations?.['32']).toEqual(snapshot.followUpTracker?.annotations?.['32'])
 const sudhika=snapshotForLead(snapshot,'Sudhika')
 expect(sudhika.followUpTracker?.annotations?.['32']).toBeUndefined()
 expect(parseSource(sudhika).some(p=>p.row===77)).toBe(true)
 expect(isSourceSnapshot(JSON.parse(JSON.stringify(actionSnapshot)))).toBe(true)
 for(const [field,value]of [['sourceUrl','javascript:alert(1)'],['readoutUrl','not a URL'],['via',42]] as const){
  const bad=structuredClone(snapshot);Object.assign(bad.annotations!['67'].notes.at(-1)!,{[field]:value});expect(isSourceSnapshot(bad)).toBe(false)
 }
 const bad=structuredClone(snapshot);bad.annotations!['65'].escalationResolution!.recordedOn='2026-02-30';expect(isSourceSnapshot(bad)).toBe(false)
 const malformed=structuredClone(snapshot);malformed.followUpTracker!.annotations!['32'].notes[0].sourceUrl='javascript:alert(1)';expect(isSourceSnapshot(malformed)).toBe(false)
})

test('closed escalation, leadership priority, source links and qualified dates are visible in both views',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'))
 await page.goto('/')
 await page.getByLabel('Search source activities').fill('Rockset compute-ops monitoring')
 const rockset=page.locator('.project-cell > strong[title="Rockset compute-ops monitoring — testing approach"]')
 await rockset.click()
 await expect(rockset.locator('..').locator('..')).toHaveClass(/date-paused/)
 await expect(page.locator('.resolved-escalation-note')).toContainText('Escalation closed')
 await expect(page.locator('.source-details')).toContainText('Status: In progress')
 await expect(page.locator('.date-escalation-panel')).toHaveCount(0)
 await page.getByLabel('Search source activities').fill('AI Governance')
 await page.locator('.project-cell > strong[title="AI Governance"]').click()
 await expect(page.locator('.detail-meta')).toContainText('PwC owners: Not supplied')
 await expect(page.locator('.detail-meta')).toContainText('FRM leads: Sudhika')
 await expect(page.locator('.detail-tags')).toContainText('Top priority')
 await expect(page.getByRole('region',{name:'Meeting context'}).getByRole('link',{name:'Source message',exact:true})).toHaveAttribute('href','https://openai.enterprise.slack.com/archives/C0C9A94KGQN/p1794012489918499')
 await page.getByLabel('Search source activities').fill('DCGM scoping')
 await expect(page.locator('.source-date-facts')).toContainText('Before Nov 13, 2026')
 await expect(page.locator('.detail-meta')).toContainText('Layla Yang')
 await page.getByRole('button',{name:'Open follow-up tracker',exact:true}).click()
 await page.getByLabel('Search source activities').fill('DCGM scoping')
 await expect(page.locator('.source-date-facts')).toContainText('Before Nov 13, 2026')
 await expect(page.locator('.detail-meta')).toContainText('Layla Yang')
 await expect(page.getByRole('region',{name:'Follow-up tracker actions'})).toContainText('Nov 6, 2026')
 await expect(page.getByRole('region',{name:'Meeting context'}).getByRole('link',{name:'Buddy readout',exact:true})).toHaveAttribute('href',/chatgpt.com\/c\//)
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
 await page.screenshot({path:'/tmp/frmprio-buddy-dcgm-mobile.png',fullPage:true})
})
