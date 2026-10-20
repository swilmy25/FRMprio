import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { activitiesForLead, parseSource, peopleDirectory } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'
const snapshot:SourceSnapshot=JSON.parse(readFileSync(new URL('../src/data/prioritization.json',import.meta.url),'utf8'))
const activities=parseSource(snapshot)
const leadNames=peopleDirectory(activities.map(p=>p.frmLeads)).options
const count=(lead:string)=>activitiesForLead(activities,lead).length

test('each lead has a scoped view and returning to Project dashboard restores the overall portfolio',async({page})=>{
 await page.goto('/')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
 for(const lead of leadNames){
  await page.locator('.sidebar').getByRole('button',{name:`${lead} view`,exact:true}).click()
  await expect(page.getByRole('heading',{name:`${lead}'s projects`,exact:true})).toBeVisible()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(count(lead))
  await expect(page.locator('.sidebar').getByRole('button',{name:`${lead} view`,exact:true})).toHaveAttribute('aria-current','page')
  await expect(page.getByRole('region',{name:'FRM lead breakdown'})).toBeVisible()
  await page.getByRole('button',{name:'Clear all filters',exact:true}).click()
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(count(lead))
 }
 await page.locator('.sidebar').getByRole('button',{name:'Project dashboard',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Project dashboard',exact:true})).toBeVisible()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
})
test('shared activities appear in each assigned lead view without duplicating the overall total',async({page})=>{
 const shared=activities.find(p=>peopleDirectory([p.frmLeads]).options.length>1)!
 const leads=peopleDirectory([shared.frmLeads]).options
 for(const lead of leads){
  await page.goto(`/#lead=${encodeURIComponent(lead)}`)
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(count(lead))
  await expect(page.locator('.workbook-row.project-row').filter({hasText:`Row ${shared.row} ·`})).toHaveCount(1)
 }
 await page.goto('/#portfolio')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
})
test('lead links survive reload, export only their scope and offer breakdown filters',async({page})=>{
 const lead='Avi'
 await page.goto(`/#lead=${lead}`)
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(count(lead))
 await page.reload()
 await expect(page.getByRole('heading',{name:`${lead}'s projects`,exact:true})).toBeVisible()
 const downloadPromise=page.waitForEvent('download')
 await page.getByRole('button',{name:'Export',exact:false}).click()
 const download=await downloadPromise
 const exported:SourceSnapshot=JSON.parse(readFileSync((await download.path())!,'utf8'))
 expect(parseSource(exported)).toHaveLength(count(lead))
 expect(activitiesForLead(parseSource(exported),lead)).toHaveLength(count(lead))
 await page.locator('.lead-breakdowns article').first().getByRole('button').first().click()
 await expect(page.locator('.active-filters')).toContainText('FRM priority')
 await page.getByRole('button',{name:'Clear all filters',exact:true}).click()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(count(lead))
 await page.screenshot({path:'/tmp/frm-lead-view.png',fullPage:true})
})
test('mobile view tabs switch lead scope without overflowing the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await page.locator('.view-tabs').getByRole('button',{name:'Avi view',exact:true}).click()
 await expect(page.getByRole('heading',{name:"Avi's projects",exact:true})).toBeVisible()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(count('Avi'))
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
 await page.locator('.view-tabs').getByRole('button',{name:'Project dashboard',exact:true}).click()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(45)
})
