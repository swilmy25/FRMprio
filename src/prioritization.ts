import { aleHistoryForNames, isAleHistory } from './aleHistory.ts'
import type { AleHistory } from './aleHistory'

export type MeetingNote = { source:string; recordedOn:string; postedOn?:string; text:string; applicationNote?:string }
export type MergedActivity = { row:number; name:string; pwcOwners:string; frmLeads:string; frmPriority:string; category:string; pwcPriority:string; alignment:string; activityType:string; startRaw:string; endRaw:string; staffing:string }
export const ACTIVITY_STATUSES = ['In progress','On track','At risk','On hold','Waiting on FRM'] as const
export type ActivityStatus = typeof ACTIVITY_STATUSES[number]
export type PlanningEstimate = { status:'Proposed'; minHours:number; maxHours:number; scope:string; allocationNote:string; assumptions:string[]; exclusions:string[]; breakdown:{label:string;minHours:number;maxHours:number}[] }
export type ActivityAnnotation = { notes:MeetingNote[]; historyName?:string; planningEstimate?:PlanningEstimate; userAdded?:boolean; escalationPaused?:boolean; escalationReason?:string; escalationAction?:string; followUpDate?:string; pwcOwnersOverride?:string; nameOverride?:string; endOverride?:string; sectionOverride?:string; closureReason?:string; frmLeadsOverride?:string; mergedActivities?:MergedActivity[]; statusOverride?:ActivityStatus }
export const MEETING_UPDATE_FLAGS = ['date-moved','date-confirmed','new-tbd','existing-tbd','discussion','completed','closed','scope-change','in-progress','date-corrected','on-track','at-risk','on-hold','waiting-frm','escalation-paused'] as const
export type MeetingUpdateFlag = typeof MEETING_UPDATE_FLAGS[number]
export type ChangeRecord = { source:string; recordedOn:string; postedOn?:string; row?:number; activity:string; detail:string; frmLeads?:string; pwcOwners?:string; title?:string; flags?:MeetingUpdateFlag[]; discussion?:string }

export const SOURCE_STORAGE = 'frmprio.prioritization.v2'
export type SourceSnapshot = { kind: 'frmprio.prioritization.v1'; fileName: string; tabName: string; importedAt: string; rows: string[][]; includedColumns?: number[]; sections?: Record<string,string>; publicationId?: string; annotations?:Record<string,ActivityAnnotation>; changeLog?:ChangeRecord[]; aleHistory?:AleHistory }
export type SourceActivity = {
  id: string; row: number; ref: string; name: string; historyName?:string; workbookName:string; userAdded:boolean; section: string; workbookEndRaw:string; workbookFrmLeads:string; workbookPwcOwners:string; escalationPaused:boolean; escalationReason:string; escalationAction:string; followUpDate:string|null; closureReason:string; meetingNotes:MeetingNote[]; mergedActivities:MergedActivity[];
  planningEstimate?:PlanningEstimate; pwcOwners: string; frmLeads: string; staffing: string; frmPriority: string; pwcPriority: string; alignment: string;
  category: string; activityType: string; estimate: number | null; actual: number | null; remaining: number | null;
  controls: string; completedControls: string; outstandingControls: string;
  originalDue: string; revisedDue: string; startRaw: string; start: string | null; startMonth: string | null; end: string | null; endBasis: string; endRaw: string; completed: boolean;
  delay: string; timeUsed: string; notes: string; response: string;
  perspectives: Record<'a' | 'b' | 'c' | 'd' | 'e', string>; warnings: string[]; status: string;
}
export function sourceNumber(value: string): number | null {
  if (!/^\s*-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*$/.test(value)) return null
  const n = Number(value.replaceAll(',', ''))
  return Number.isFinite(n) ? n : null
}
export function sourceDate(value: string): string | null {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const us = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!iso && !us) return null
  const normalized = iso ? value.trim() : `${us![3]}-${us![1].padStart(2, '0')}-${us![2].padStart(2, '0')}`
  const parsed = new Date(`${normalized}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null
}
function sourceMonth(value: string): string | null {
  const text = value.trim().toLowerCase()
  const iso = text.match(/^(\d{4})-(\d{2})$/)
  const named = text.match(/^([a-z]+)\s+(\d{4})$/)
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const month = iso ? Number(iso[2]) : named ? months.indexOf(named[1]) + 1 : 0
  const year = iso?.[1] ?? named?.[2]
  return year && month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2,'0')}` : null
}
export function splitPerspectives(text: string): SourceActivity['perspectives'] {
  const result = { a: '', b: '', c: '', d: '', e: '' }
  const markers = [...text.matchAll(/(?:^|\n)\s*([a-e])\)\s*/gi)]
  for (let i = 0; i < markers.length; i++) {
    const match = markers[i]
    const key = match[1].toLowerCase() as keyof typeof result
    result[key] = text.slice(match.index! + match[0].length, markers[i + 1]?.index ?? text.length).trim()
  }
  return result
}
function object(value:unknown):value is Record<string,unknown> {return !!value&&typeof value==='object'&&!Array.isArray(value)}
function validNotes(value:unknown):boolean {return Array.isArray(value)&&value.every(n=>object(n)&&typeof n.source==='string'&&typeof n.text==='string'&&typeof n.recordedOn==='string'&&!!sourceDate(n.recordedOn)&&(n.postedOn===undefined||typeof n.postedOn==='string'&&!!sourceDate(n.postedOn))&&(n.applicationNote===undefined||typeof n.applicationNote==='string'))}
function validHourRange(value:unknown):boolean {
 return object(value)&&typeof value.minHours==='number'&&Number.isFinite(value.minHours)&&value.minHours>=0&&typeof value.maxHours==='number'&&Number.isFinite(value.maxHours)&&value.maxHours>=value.minHours
}
function validPlanningEstimate(value:unknown):boolean {
 if(value===undefined)return true
 if(!object(value)||value.status!=='Proposed'||!validHourRange(value)||typeof value.scope!=='string'||typeof value.allocationNote!=='string')return false
 if(!['assumptions','exclusions'].every(key=>Array.isArray(value[key])&&value[key].every(item=>typeof item==='string')))return false
 if(!Array.isArray(value.breakdown)||!value.breakdown.length||!value.breakdown.every(item=>object(item)&&typeof item.label==='string'&&validHourRange(item)))return false
 return Math.abs(value.breakdown.reduce((sum,item)=>sum+Number(item.minHours),0)-Number(value.minHours))<0.01&&Math.abs(value.breakdown.reduce((sum,item)=>sum+Number(item.maxHours),0)-Number(value.maxHours))<0.01
}
function validAnnotations(value:unknown):boolean {
 return value===undefined || object(value)&&Object.entries(value).every(([key,a])=>/^[1-9]\d*$/.test(key)&&object(a)&&validNotes(a.notes)&&(a.historyName===undefined||typeof a.historyName==='string'&&!!a.historyName.trim())&&validPlanningEstimate(a.planningEstimate)&&['userAdded','escalationPaused'].every(k=>a[k]===undefined||typeof a[k]==='boolean')&&['nameOverride','endOverride','closureReason','frmLeadsOverride','pwcOwnersOverride','escalationReason','escalationAction'].every(k=>a[k]===undefined||typeof a[k]==='string')&&(a.followUpDate===undefined||typeof a.followUpDate==='string'&&!!sourceDate(a.followUpDate))&&(a.statusOverride===undefined||ACTIVITY_STATUSES.includes(a.statusOverride as ActivityStatus))&&(a.sectionOverride===undefined||['Active portfolio','Deprioritized','Completed'].includes(String(a.sectionOverride)))&&(a.mergedActivities===undefined||Array.isArray(a.mergedActivities)&&a.mergedActivities.every(m=>object(m)&&Number.isInteger(m.row)&&Number(m.row)>0&&['name','pwcOwners','frmLeads','frmPriority','category','pwcPriority','alignment','activityType','startRaw','endRaw','staffing'].every(k=>typeof m[k]==='string'))))
}
function validChangeLog(value:unknown):boolean {return value===undefined||Array.isArray(value)&&value.every(c=>object(c)&&['source','activity','detail'].every(k=>typeof c[k]==='string')&&typeof c.recordedOn==='string'&&!!sourceDate(c.recordedOn)&&(c.postedOn===undefined||typeof c.postedOn==='string'&&!!sourceDate(c.postedOn))&&(c.row===undefined||Number.isInteger(c.row)&&Number(c.row)>0)&&['frmLeads','pwcOwners','title','discussion'].every(k=>c[k]===undefined||typeof c[k]==='string')&&(c.flags===undefined||Array.isArray(c.flags)&&c.flags.every(flag=>MEETING_UPDATE_FLAGS.includes(flag))))}
export function isSourceSnapshot(value: unknown): value is SourceSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as SourceSnapshot
  return v.kind === 'frmprio.prioritization.v1' && typeof v.fileName === 'string' && typeof v.tabName === 'string' && typeof v.importedAt === 'string' && Number.isFinite(Date.parse(v.importedAt)) && Array.isArray(v.rows) && v.rows.length <= 10000 && v.rows.every(row => Array.isArray(row) && row.length <= 200 && row.every(cell => typeof cell === 'string')) && (v.includedColumns === undefined || Array.isArray(v.includedColumns) && v.includedColumns.every(n=>Number.isInteger(n) && n>=0 && n<200)) && (v.sections === undefined || !!v.sections && typeof v.sections==='object' && Object.values(v.sections).every(s=>['Active portfolio','Deprioritized','Completed'].includes(s))) && (v.publicationId===undefined || typeof v.publicationId==='string') && validAnnotations(v.annotations) && validChangeLog(v.changeLog) && (v.aleHistory===undefined || isAleHistory(v.aleHistory))
}
export function parseSource(snapshot: SourceSnapshot): SourceActivity[] {
  const header = snapshot.rows.findIndex(row => /task\s*\/\s*activity/i.test(row[2] ?? '') && /FRM Lead/i.test(row[5] ?? '') && /Owner/i.test(row[4] ?? ''))
  if (header < 0) throw new Error('The Prioritization column layout is unrecognized. Expected Task / Activity in C, owners in E, and FRM Lead in F.')
  const dedicatedEnd = /(?:projected|actual).*end/i.test(snapshot.rows[header][23] ?? '')
  const included = (column:number) => !snapshot.includedColumns || snapshot.includedColumns.includes(column)
  let section = 'Active portfolio'
  const activities: SourceActivity[] = []
  const responseCounts = new Map<string, number>()
  for (const row of snapshot.rows.slice(header + 1)) if (row[2]?.trim() && row[21]?.trim()) responseCounts.set(row[21].trim(), (responseCounts.get(row[21].trim()) ?? 0) + 1)
  snapshot.rows.slice(header + 1).forEach((cells, index) => {
    const cell = (i: number) => (cells[i] ?? '').trim()
    if (!cell(2)) { if (/depriorit/i.test(cell(1))) section = 'Deprioritized'; else if (/^completed$/i.test(cell(1))) section='Completed'; return }
    section = snapshot.sections?.[String(header+index+2)] ?? section
    const annotation=snapshot.annotations?.[String(header+index+2)]
    const effectiveSection=annotation?.sectionOverride??section
    const workbookEndRaw=dedicatedEnd?cell(23):cell(17)
    const warnings: string[] = []
    const estimate = sourceNumber(cell(11)), actual = sourceNumber(cell(12)), remaining = sourceNumber(cell(13))
    const start = sourceDate(cell(22))
    const startMonth = start ? null : sourceMonth(cell(22))
    const endRaw = annotation?.endOverride??workbookEndRaw
    const completed = effectiveSection==='Completed' || /^completed$/i.test(endRaw)
    const revised = sourceDate(endRaw)
    const range = endRaw.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/)
    const rangeEnd = range ? sourceDate(range[2]) : null
    const end = revised ?? rangeEnd ?? (dedicatedEnd ? null : sourceDate(cell(16)))
    const endBasis = dedicatedEnd ? 'Projected/actual end · X' : revised ? 'Proposed updated due' : rangeEnd ? 'Updated due range endpoint' : end ? 'Original due only' : 'End unknown'
    if(rangeEnd) warnings.push(`${dedicatedEnd?'X':'R'} contains a due-date range. The last stated date is shown as an endpoint, not a single agreed deadline.`)
    if(end && endBasis === 'Original due only') warnings.push('No precise revised due date; the timeline shows the original due date only.')
    const perspectives = splitPerspectives(cell(21))
    if (included(11) && estimate === null) warnings.push(`Estimated effort is unknown (L: ${cell(11) || 'blank'}).`)
    if (included(12) && actual === null) warnings.push(`Actual hours are unknown (M: ${cell(12) || 'blank'}).`)
    if (included(13) && remaining === null) warnings.push(`Remaining hours are unknown (N: ${cell(13) || 'blank'}).`)
    if (remaining !== null && remaining < 0) warnings.push(`Reported remaining is ${remaining} hrs; actuals exceed the estimate. This is an estimate overrun, not negative future work.`)
    if (estimate !== null && actual !== null && remaining !== null && Math.abs(estimate - actual - remaining) > 0.05) warnings.push('L − M does not reconcile with N; values are preserved as reported.')
    if (startMonth) warnings.push(`Start month supplied (${cell(22)}); the exact day is not supplied or inferred.`)
    if (!start && !startMonth) warnings.push(`No precise start date (W: ${cell(22) || 'blank'}); no start date is inferred.`)
    if (!end && !completed && !/^(N\/A|Ongoing)/i.test(endRaw)) warnings.push(`No precise end date (${dedicatedEnd?'X':'R'}: ${endRaw || 'blank'}).`)
    if (start && end && start > end) warnings.push('Source start date is after the due date; the timeline window is not plotted.')
    if (cell(9).toLowerCase() === 'no') warnings.push('FRM and PwC alignment is explicitly marked No (J).')
    if (/^done\b/i.test(cell(20)) && remaining !== null && remaining > 0) warnings.push('U says Done but N still reports remaining hours; completion status needs review.')
    if (/refer .*row above/i.test(`${cell(18)} ${cell(19)}`)) warnings.push('This row refers to another activity. Confirm coverage before aggregating its control/report counts again.')
    if (cell(21) && (responseCounts.get(cell(21)) ?? 0) > 1) warnings.push('Column V repeats verbatim on multiple activities; confirm attribution before totaling this narrative.')
    const aHours = perspectives.a.match(/\b(\d+(?:\.\d+)?)\s*(?:hrs|hours)\b/i)
    const bHours = perspectives.b.match(/\b(\d+(?:\.\d+)?)\s*(?:hrs|hours)\b/i)
    if (aHours && actual !== null && Number(aHours[1]) !== actual) warnings.push(`V(a) reports ${aHours[1]} hrs versus ${actual} actual hrs in M. The two figures are not merged.`)
    if (bHours && remaining !== null && Number(bHours[1]) !== remaining) warnings.push(`V(b) reports ${bHours[1]} hrs versus ${remaining} remaining hrs in N. Confirm scope and timing.`)
    const status = completed ? 'Completed' : annotation?.statusOverride ?? (effectiveSection === 'Deprioritized' ? 'Deprioritized' : actual !== null && estimate !== null && actual > estimate ? 'Effort overrun' : /^done\b/i.test(cell(20)) && remaining === 0 ? 'Reported complete' : /on track/i.test(`${cell(18)} ${cell(21)}`) ? 'Reported on track' : cell(18) && !/^(N\/A|No Delay)/i.test(cell(18)) ? 'Delay noted' : /\bat risk\b/i.test(cell(20)) ? 'Risk noted' : actual === 0 ? 'No hours recorded' : 'Status not supplied')
    activities.push({ id: `source-row-${header + index + 2}`, row: header + index + 2, ref: cell(1), name: annotation?.nameOverride??cell(2), historyName:annotation?.historyName, workbookName:cell(2), userAdded:annotation?.userAdded??false, section:effectiveSection, workbookEndRaw, workbookFrmLeads:cell(5), workbookPwcOwners:cell(4), escalationPaused:annotation?.escalationPaused??false, escalationReason:annotation?.escalationReason??'', escalationAction:annotation?.escalationAction??'', followUpDate:annotation?.followUpDate??null, closureReason:annotation?.closureReason??'',meetingNotes:annotation?.notes??[],mergedActivities:annotation?.mergedActivities??[],planningEstimate:annotation?.planningEstimate, pwcOwners: annotation?.pwcOwnersOverride??cell(4), frmLeads: annotation?.frmLeadsOverride??cell(5), frmPriority: cell(6), pwcPriority: cell(8), alignment: cell(9), category: cell(7), activityType: cell(10), estimate, actual, remaining, controls: cell(3), completedControls: cell(14), outstandingControls: cell(15), originalDue: cell(16), revisedDue: cell(17), startRaw: cell(22), start, startMonth, end, endBasis, endRaw, completed, delay: cell(18), timeUsed: cell(19), notes: cell(20), response: cell(21), staffing: cell(dedicatedEnd?24:23), perspectives, warnings, status })
  })
  return activities
}
export function priorityRank(value: string): number { return /critical/i.test(value) ? 0 : /^high/i.test(value) ? 1 : /^(moderate|medium)/i.test(value) ? 2 : /^low/i.test(value) ? 3 : 4 }
export function knownTotals(activities: SourceActivity[]) {
  const sum = (key: 'estimate' | 'actual' | 'remaining') => ({ hours: activities.reduce((n, p) => n + (p[key] ?? 0), 0), known: activities.filter(p => p[key] !== null).length })
  return { estimate: sum('estimate'), actual: sum('actual'), remaining: sum('remaining'), positiveRemaining: activities.reduce((n,p) => n + Math.max(0, p.remaining ?? 0),0), negativeRemaining: activities.filter(p => p.remaining !== null && p.remaining < 0).length }
}


export const ORANGE_COLUMNS = [2,4,5,6,7,8,9,10,22,23,24]
export function orangeOnly(snapshot:SourceSnapshot):SourceSnapshot {
  const header=snapshot.rows.find(row=>/task\s*\/\s*activity/i.test(row[2]??'') && /FRM Lead/i.test(row[5]??''))
  if(header && !/(?:projected|actual).*end/i.test(header[23]??''))throw new Error('Use the current Prioritization layout with projected end in X and staffing in Y.')
  const sections:Record<string,string>={};let current='Active portfolio'
  snapshot.rows.forEach((row,index)=>{if(!row[2]?.trim()){if(/depriorit/i.test(row[1]??'')) current='Deprioritized';else if(/^completed$/i.test(row[1]??'')) current='Completed'}else if(!/task\s*\/\s*activity/i.test(row[2])) sections[String(index+1)]=snapshot.sections?.[String(index+1)]??current})
  return {...snapshot,includedColumns:ORANGE_COLUMNS,sections,rows:snapshot.rows.map(row=>Array.from({length:25},(_,i)=>ORANGE_COLUMNS.includes(i)?row[i]??'':''))}
}
export function rating(value:string):string {
 const match=value.trim().match(/^(Critical|High|Moderate|Medium|Low|Not Applicable)/i)
 return match ? match[1].toLowerCase()==='not applicable'?'Not applicable':match[1][0].toUpperCase()+match[1].slice(1).toLowerCase() : 'Not supplied'
}
export function alignmentState(p:SourceActivity):string {
 if(/^no$/i.test(p.alignment))return 'Not aligned'
 const a=priorityRank(p.frmPriority),b=priorityRank(p.pwcPriority)
 if(a<4 && b<4 && a!==b)return 'Not aligned'
 if(/^yes$/i.test(p.alignment))return 'Aligned'
 if(/^n\/a$/i.test(p.alignment))return 'Not applicable'
 return 'Not recorded'
}
export function peopleDirectory(values:string[],fullNames=false):{options:string[];resolve:(value:string)=>string[]} {
 const chunks=(v:string)=>v.split(/[,/&]|\band\b/i).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean)
 const preliminary=values.flatMap(v=>chunks(v).flatMap(s=>{const words=s.split(' ');return fullNames&&words.length>2&&words.length%2===0?Array.from({length:words.length/2},(_,i)=>words.slice(i*2,i*2+2).join(' ')):[s]}))
 const candidates=[...new Set(preliminary)]
 const resolve=(v:string)=>chunks(v).flatMap(s=>{const words=s.split(' ');return fullNames&&words.length>2&&words.length%2===0?Array.from({length:words.length/2},(_,i)=>words.slice(i*2,i*2+2).join(' ')):[s]}).map(s=>{if(s.includes(' '))return s;const found=candidates.filter(n=>n.split(' ')[0]===s&&n.includes(' '));return found.length===1?found[0]:s})
 return {options:[...new Set(values.flatMap(resolve))].sort(),resolve}
}
export type DateHealth={tone:'completed'|'escalation'|'scheduled'|'ongoing'|'paused';label:string;reasons:string[]}
export function dateHealth(p:SourceActivity,today:string):DateHealth {
 if(p.completed)return {tone:'completed',label:p.closureReason?`Closed · ${p.closureReason[0].toLowerCase()}${p.closureReason.slice(1)}`:'Completed',reasons:[p.closureReason||'Marked completed in the source or confirmed by a meeting update.']}
 if(p.escalationPaused&&!p.end&&/^(TBD|pending|)$/i.test(p.endRaw.trim())&&!p.escalationReason&&p.status!=='At risk')return {tone:'paused',label:'Escalation paused',reasons:['Awaiting FRM dates; escalation paused by the recorded team update.']}
 const reasons:string[]=[]
 if(p.escalationReason)reasons.push(p.escalationReason)
 else if(p.status==='At risk')reasons.push('Team reports delivery at risk')
 if(p.followUpDate&&p.followUpDate<today)reasons.push(`Follow-up checkpoint passed (${p.followUpDate}); confirmation not recorded`)
 const exempt=(s:string)=>/^(N\/A|Ongoing)/i.test(s)
 if(!p.start&&!p.startMonth&&!exempt(p.startRaw))reasons.push(/tbd|pending/i.test(p.startRaw)?'Start date TBD':'Start date missing or unresolved')
 if(!p.end&&!exempt(p.endRaw))reasons.push(/tbd|pending/i.test(p.endRaw)?'End date TBD':'End date missing or unresolved')
 if(p.start&&p.end&&p.start>p.end)reasons.push('Start date is after end date')
 if(p.startMonth&&p.end&&p.startMonth>p.end.slice(0,7))reasons.push('Start month is after end date')
 if(p.end&&p.end<today)reasons.push('End date has passed; completion is not recorded')
 if(p.start&&p.start<today&&/not started/i.test(p.startRaw))reasons.push('Projected start date has passed')
 if(reasons.length)return {tone:'escalation',label:'Escalation',reasons}
 if(!p.end)return {tone:'ongoing',label:'Ongoing / not dated',reasons:['Source is ongoing or dates are not applicable.']}
 return {tone:'scheduled',label:p.end===today?'Due today':'Scheduled',reasons:[]}
}

export function activitiesForLead(activities:SourceActivity[],lead:string|null):SourceActivity[] {
 if(!lead)return activities
 const directory=peopleDirectory(activities.map(p=>p.frmLeads))
 return activities.filter(p=>directory.resolve(p.frmLeads).includes(lead))
}
export function snapshotForLead(snapshot:SourceSnapshot,lead:string):SourceSnapshot {
 const scoped=activitiesForLead(parseSource(snapshot),lead)
 const selectedRows=new Set(scoped.map(p=>p.row))
 const header=snapshot.rows.findIndex(row=>/task\s*\/\s*activity/i.test(row[2]??''))
 return {...snapshot,aleHistory:snapshot.aleHistory?aleHistoryForNames(snapshot.aleHistory,scoped.map(p=>p.historyName??p.name)):undefined,publicationId:undefined,fileName:`${snapshot.fileName} · FRM lead: ${lead}`,sections:Object.fromEntries(scoped.map(p=>[String(p.row),p.section])),annotations:Object.fromEntries(Object.entries(snapshot.annotations??{}).filter(([row])=>selectedRows.has(Number(row)))),changeLog:snapshot.changeLog?.filter(change=>change.row&&selectedRows.has(change.row)||change.frmLeads&&peopleDirectory([change.frmLeads]).resolve(change.frmLeads).includes(lead)),rows:snapshot.rows.map((row,index)=>index<=header||selectedRows.has(index+1)?row:row.map(()=>''))}
}
