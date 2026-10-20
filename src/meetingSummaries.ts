import { activitiesForLead, parseSource, peopleDirectory } from './prioritization'
import type { ChangeRecord, SourceActivity, SourceSnapshot } from './prioritization'

export const UNRECORDED_PWC_OWNER = 'Owner not recorded in latest workbook'
export type MeetingSummaryItem = { id: number; change: ChangeRecord; activity?: SourceActivity; pwcOwners: string[]; providedBy: string }
export type MeetingMemberSummary = { member: string; unassigned: boolean; items: MeetingSummaryItem[] }

export function uniqueMeetingItems(groups: MeetingMemberSummary[]): MeetingSummaryItem[] {
  return [...new Map(groups.flatMap(group => group.items).map(item => [item.id, item])).values()]
}

export function meetingUpdatesByMember(snapshot: SourceSnapshot, lead: string | null = null): MeetingMemberSummary[] {
  const activities = parseSource(snapshot)
  const scopedRows = new Set(activitiesForLead(activities, lead).map(activity => activity.row))
  const changes = (snapshot.changeLog ?? []).filter(change => !lead
    || change.row !== undefined && scopedRows.has(change.row)
    || change.frmLeads && peopleDirectory([change.frmLeads]).resolve(change.frmLeads).includes(lead))
  const directory = peopleDirectory([...activities.map(activity => activity.pwcOwners), ...changes.map(change => change.pwcOwners ?? '')], true)
  const byRow = new Map(activities.map(activity => [activity.row, activity]))
  const groups = new Map<string, MeetingSummaryItem[]>()
  changes.forEach((change, id) => {
    const activity = change.row === undefined ? undefined : byRow.get(change.row)
    // Current activity ownership is authoritative. Removed activities retain their
    // recorded column E owners; a note's author never supplies missing ownership.
    const pwcOwners = [...new Set(directory.resolve(activity ? activity.pwcOwners : change.pwcOwners ?? ''))]
    const providedBy = directory.resolve(change.source).join(', ') || 'Not supplied'
    const item = { id, change, activity, pwcOwners, providedBy }
    for (const member of pwcOwners.length ? pwcOwners : [UNRECORDED_PWC_OWNER]) {
      const items = groups.get(member) ?? []
      items.push(item)
      groups.set(member, items)
    }
  })
  return [...groups].map(([member, items]) => ({ member, unassigned: member === UNRECORDED_PWC_OWNER, items }))
    .sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || a.member.localeCompare(b.member))
}
