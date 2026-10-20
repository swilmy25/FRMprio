import { activitiesForLead, parseSource, peopleDirectory } from './prioritization'
import type { ChangeRecord, SourceActivity, SourceSnapshot } from './prioritization'

export type MeetingSummaryItem = { change: ChangeRecord; activity?: SourceActivity }
export type MeetingMemberSummary = { member: string; items: MeetingSummaryItem[] }

export function meetingUpdatesByMember(snapshot: SourceSnapshot, lead: string | null = null): MeetingMemberSummary[] {
  const activities = parseSource(snapshot)
  const scopedRows = new Set(activitiesForLead(activities, lead).map(activity => activity.row))
  const changes = (snapshot.changeLog ?? []).filter(change => !lead
    || change.row !== undefined && scopedRows.has(change.row)
    || change.frmLeads && peopleDirectory([change.frmLeads]).resolve(change.frmLeads).includes(lead))
  const directory = peopleDirectory([...activities.map(activity => activity.pwcOwners), ...changes.map(change => change.source)], true)
  const byRow = new Map(activities.map(activity => [activity.row, activity]))
  const groups = new Map<string, MeetingSummaryItem[]>()
  for (const change of changes) {
    const member = directory.resolve(change.source).join(', ') || change.source
    const items = groups.get(member) ?? []
    items.push({ change, activity: change.row === undefined ? undefined : byRow.get(change.row) })
    groups.set(member, items)
  }
  return [...groups].map(([member, items]) => ({ member, items }))
}
