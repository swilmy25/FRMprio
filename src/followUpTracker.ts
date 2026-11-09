import { ORANGE_COLUMNS, parseSource, peopleDirectory } from './prioritization.ts'
import type { SourceSnapshot } from './prioritization'

export function trackerPwCOwner(addedBy:string, knownOwners:string[]):string {
 const value=addedBy.trim()
 if(/^FRM$/i.test(value))return ''
 if(/^(PwC|FRM\s*\/\s*PwC)$/i.test(value))return 'PwC (team)'
 const directory=peopleDirectory(knownOwners,true)
 return directory.resolve(value).join(', ')
}

export function followUpSnapshot(snapshot:SourceSnapshot):SourceSnapshot|null {
 const tracker=snapshot.followUpTracker
 if(!tracker)return null
 const projects=parseSource(snapshot),byRow=new Map(projects.map(p=>[p.row,p]))
 const owners=projects.map(p=>p.pwcOwners)
 const frmDirectory=peopleDirectory(projects.map(p=>p.frmLeads))
 const frmNames=new Set(frmDirectory.options)
 const rows=Array.from({length:Math.max(3,...tracker.actions.map(a=>a.row))},()=>Array<string>(25).fill(''))
 Object.assign(rows[1],{2:'Task / Activity',4:'Owner(s)',5:'FRM Lead',7:'Category',8:'Tracker Priority',22:'Date added/updated',23:'Projected/Actual End',24:'Staffing'})
 const annotations:NonNullable<SourceSnapshot['annotations']>={},sections:Record<string,string>={}
 for(const action of tracker.actions){
  const row=rows[action.row-1]
  const fullTitle=action.shortTitle||action.description.split('\n')[0]
  const title=fullTitle.length>115?`${fullTitle.slice(0,112)}…`:fullTitle
  const namedFRM=frmDirectory.resolve(action.ownership.replace(/Alejandro/g,'Ale')).filter(name=>frmNames.has(name))
  const related=(action.projectRows??[]).flatMap(n=>byRow.get(n)?[byRow.get(n)!]:[])
  const frm=namedFRM.length?[...new Set(namedFRM)].join(', '):[...new Set(related.flatMap(p=>frmDirectory.resolve(p.frmLeads)))].join(', ')
  Object.assign(row,{2:title,4:trackerPwCOwner(action.addedBy,owners),5:frm,7:action.category,8:action.priority,10:action.category,22:action.updatedOn||'TBD',23:action.deadline||'TBD'})
  const completed=/^completed$/i.test(action.status)
  const onHold=/^hold$/i.test(action.status)
  sections[String(action.row)]=completed?'Completed':'Active portfolio'
  const parentPaused=related.find(p=>p.escalationPaused)
  annotations[String(action.row)]={userAdded:true,usesTrackerDates:true,trackerActions:[action],...(action.reviewAddedOn?{newlyTrackedOn:action.reviewAddedOn}:{}),
   ...(completed?{sectionOverride:'Completed'}:{statusOverride:onHold?'On hold':'In progress'}),
   ...(onHold&&parentPaused?{escalationPaused:true,escalationPauseReason:parentPaused.escalationPauseReason||'On hold per the source tracker.'}:{}),
   ...(!completed&&/escalation.*(?:needed|required)/i.test(action.notes)?{escalationReason:'The tracker explicitly requests escalation for the outstanding dependency.'}:{}),
   notes:[{source:'Follow-up Tracker',recordedOn:action.recordedOn,text:action.description,applicationNote:'PwC owner comes from Added by (B), category from D, start from Date added/updated (C), and projected end from Deadline (J). These dates describe this follow-up; they are not actual completion dates or a replacement for a related project’s testing delivery target. Team-only Added by entries retain their team label; FRM-only entries have no named PwC owner.'}]}
  const override=tracker.annotations?.[String(action.row)]
  if(override)annotations[String(action.row)]={...annotations[String(action.row)],...override,trackerActions:[action],notes:[...annotations[String(action.row)].notes,...override.notes]}
 }
 return {kind:'frmprio.prioritization.v1',fileName:tracker.fileName,tabName:tracker.tabName,importedAt:tracker.importedAt,includedColumns:ORANGE_COLUMNS,trackerView:true,reviewAsOf:tracker.actions.map(a=>a.recordedOn).sort().at(-1),rows,sections,annotations}
}

export function adsPbcCounts(controls:{status:string}[]) {
 const count=(status:string)=>controls.filter(c=>c.status.toLowerCase()===status.toLowerCase()).length
 return {total:controls.length,certified:count('Certified'),submitted:count('Submitted'),followUp:count('In Follow Up'),missing:count('Evidence Not Received'),onHold:count('ON HOLD')}
}

