import { test, expect } from '@playwright/test'
import { knownTotals, parseSource, sourceDate, sourceNumber, splitPerspectives } from '../src/prioritization'
import type { SourceSnapshot } from '../src/prioritization'

const header = Array.from({length:24},()=> '')
header[2]='Task / Activity'; header[4]='Owner(s)'; header[5]='FRM Lead'
const row = (ref:string,name:string, values: Record<number,string>) => {
  const r=Array.from({length:24},()=> '');r[1]=ref;r[2]=name
  for(const [k,v] of Object.entries(values))r[Number(k)]=v
  return r
}
const fixture:SourceSnapshot={kind:'frmprio.prioritization.v1',fileName:'Synthetic example.xlsx',tabName:'Prioritization',importedAt:'2026-10-12T00:00:00Z',rows:[[],header,
  row('1','Example access review',{3:'9',4:'Example PwC owner',5:'Example FRM lead',6:'Moderate (Oct / Nov)',7:'Example category',8:'High',11:'100',12:'5',13:'95',16:'2026-10-31',17:'2026-11-15',21:'a) Initial discussion (10 hrs)\nb) Testing remaining (80 hours)\nc) N/A\nd) Additional request\ne) Agree priorities',22:'2026-09-15',23:'Example staff'}),
  row('2','Example PMO',{4:'Owner',5:'Lead',11:'72',12:'192',13:'-120',17:'Ongoing'}),
  row('3','Example unresolved scope',{11:'TBD',12:'2',13:'#VALUE!',17:'10/15/2026 -10/30/2026'}),
  row('4','Example duplicate context',{11:'5',12:'3',13:'2',21:'a) Initial discussion (10 hrs)\nb) Testing remaining (80 hours)\nc) N/A\nd) Additional request\ne) Agree priorities'}),
  row('Deprioritized and will not get done','',{}),row('1','Example deferred work',{11:'20',12:'0',13:'20',17:'2026-11-15'})]}

test('source mapping keeps unknowns, overrun, duplicate references and scope conflicts distinct',()=>{
 const activities=parseSource(fixture)
 expect(activities).toHaveLength(5)
 expect(new Set(activities.map(p=>p.id)).size).toBe(5)
 expect(activities[0].staffing).toBe('Example staff')
 expect(activities[0].warnings.join(' ')).toContain('10 hrs versus 5')
 expect(activities[0].warnings.join(' ')).toContain('repeats verbatim')
 expect(activities[1].remaining).toBe(-120)
 expect(activities[1].start).toBeNull()
 expect(activities[2].estimate).toBeNull()
 expect(activities[2].remaining).toBeNull()
 expect(activities[2].end).toBe('2026-10-30')
 expect(activities[2].endBasis).toBe('Updated due range endpoint')
 expect(activities[4].section).toBe('Deprioritized')
 expect(knownTotals(activities).positiveRemaining).toBe(117)
 expect(knownTotals(activities).remaining.hours).toBe(-3)
 expect(sourceNumber('N/A')).toBeNull()
 expect(sourceDate('2026-02-30')).toBeNull()
 expect(splitPerspectives('a) item\nb) second\nc) third\nd) fourth\ne) fifth').e).toBe('fifth')
})

test('uploaded source replaces the sample view, preserves five perspectives and survives reload',async({page})=>{
 await page.goto('/')
 await page.locator('.import-button input').setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(5)
 await expect(page.locator('.source-details')).toContainText('Example staff')
 await expect(page.locator('.source-details')).toContainText('Initial discussion (10 hrs)')
 await expect(page.locator('.source-details')).toContainText('Capacity gap: unknown')
 await expect(page.locator('.gantt-bar')).toHaveCount(1)
 await expect(page.locator('.due-marker')).toHaveCount(2)
 await page.reload()
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(5)
 await page.getByLabel('Filter source section').selectOption('Deprioritized')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
 await page.getByLabel('Filter source section').selectOption('All sections')
 await page.getByLabel('Search source activities').fill('unresolved')
 await expect(page.locator('.workbook-row.project-row')).toHaveCount(1)
 await expect(page.locator('.source-details')).toContainText('#VALUE!')
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('live tab refresh updates the workbook view without replacing manual project records',async({page})=>{
 await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:config=>({requestAccessToken:()=>config.callback({access_token:'test-fixture-token',expires_in:3600})}),revoke:(_token,callback)=>callback()}}}})
 let reads=0
 await page.route('https://sheets.googleapis.com/**',route=>{
  if(route.request().url().includes('/values/')){
   reads++
   const updated=structuredClone(fixture.rows)
   updated[2][2]=`Live source update ${reads}`
   return route.fulfill({json:{values:updated}})
  }
  return route.fulfill({json:{sheets:[{properties:{sheetId:8496958,title:'Prioritization'}}]}})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Connect Google Sheets'}).click()
 await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
 await page.getByRole('button',{name:'Sign in with Google'}).click()
 await expect(page.locator('.source-details h2')).toHaveText('Live source update 1')
 await page.getByRole('button',{name:'Refresh now'}).click()
 await expect(page.locator('.source-details h2')).toHaveText('Live source update 2')
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('frmprio.projects.v1')!).length)).toBe(4)
 await page.getByRole('button',{name:'Disconnect',exact:true}).click()
 await page.reload()
 await expect(page.locator('.source-details h2')).toHaveText('Live source update 2')
})
