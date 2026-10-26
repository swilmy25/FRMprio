import { alignmentState, dateHealth, peopleDirectory, priorityRank, rating } from './prioritization.ts'
import { aleHistoryKey } from './aleHistory.ts'
import type { SourceActivity } from './prioritization'

export type AleDecision = { id: string; activityId: string; historyKey: string; topic: string; owners: string[]; frmOwners: string[]; nextStep: string }
export type AleReadoutData = { escalations: AleDecision[]; alignment: AleDecision[]; decisionCount: number; topicCount: number; overlapCount: number }

function topic(activity: SourceActivity): string {
  const name = activity.name
  if (/^Revenue new controls\b/i.test(name)) return 'Revenue new controls'
  if (/chronosphere/i.test(name)) return 'IT Ops / Chronosphere'
  if (/^Monitoring\b/i.test(name) && /additional followup|Deloitte questions/i.test(name)) return 'Monitoring — Deloitte follow-up'
  if (/^SDLC\s*-\s*Pando\b/i.test(name)) return 'SDLC — Pando'
  if (/^Project Keystone\b/i.test(name)) return 'Project Keystone'
  if (/^API Tokenization\b/i.test(name)) return 'API Tokenization'
  if (/^Vertex\b/i.test(name)) return 'Vertex ITGCs'
  if (/^Oracle MCP\b/i.test(name)) return 'Oracle MCP'
  return name.split('\n')[0].replace(/\s+/g, ' ').trim()
}

function escalationNextStep(activity: SourceActivity, today: string): string {
  if (activity.escalationAction) return activity.escalationAction
  const notes = activity.meetingNotes.map(note => note.text).join(' ')
  if (/^Revenue new controls\b/i.test(activity.name) && /scop/i.test(notes) && !activity.end) return 'Get FRM scoping confirmed and agree start/end dates for the consolidated revenue work.'
  if (/^Monitoring\b/i.test(activity.name) && /Sarah/i.test(notes)) return 'Get Layla’s confirmation after her meeting with Sarah and agree a revised end date.'
  if (/^Platform OE Testing/i.test(activity.name) && !activity.frmLeads.trim()) return 'Confirm the FRM lead, priorities and start/end dates for this OE testing bucket.'
  if (activity.section === 'Deprioritized') return 'Confirm whether to resume this work and agree a start date and delivery plan.'
  const health = dateHealth(activity, today)
  if (activity.start && activity.end && activity.start > activity.end) return 'Agree valid start/end dates; the current start is after the end.'
  if (!activity.end && /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(activity.endRaw)) return `Confirm a valid, fully specified end date; the source lists “${activity.endRaw}”.`
  if (!activity.start && !activity.end) return 'Agree start and end dates with FRM so the work can be scheduled.'
  if (/chronosphere/i.test(activity.name) && !activity.end) return 'Confirm Chronosphere scoping and agree an end date with FRM.'
  if (!activity.end) return 'Agree a revised end date with FRM and confirm the delivery plan.'
  if (health.reasons.includes('End date has passed; completion is not recorded')) return 'Confirm completion or agree a revised end date with the team.'
  return 'Confirm the start date so the team can commit to the delivery plan.'
}

function alignmentNextStep(activity: SourceActivity): string {
  const pwc = priorityRank(activity.pwcPriority), frm = priorityRank(activity.frmPriority)
  return pwc < 4 && frm < 4 && pwc !== frm
    ? `Agree a shared priority and sequence: PwC ${rating(activity.pwcPriority)} versus FRM ${rating(activity.frmPriority)}.`
    : 'Resolve the recorded PwC/FRM misalignment and confirm a shared priority and sequence.'
}

export function buildAleReadout(activities: SourceActivity[], today: string): AleReadoutData {
  const owners = peopleDirectory(activities.map(activity => activity.pwcOwners), true)
  const frmOwners = peopleDirectory(activities.map(activity => activity.frmLeads))
  const decision = (activity: SourceActivity, bucket: 'escalation' | 'alignment'): AleDecision => ({
    id: `${bucket}:${activity.id}`,
    activityId: activity.id,
    historyKey: aleHistoryKey(activity.name, bucket),
    topic: topic(activity),
    owners: [...new Set(owners.resolve(activity.pwcOwners))],
    frmOwners: [...new Set(frmOwners.resolve(activity.frmLeads))],
    nextStep: bucket === 'escalation' ? escalationNextStep(activity, today) : alignmentNextStep(activity),
  })
  const escalations = activities.filter(activity => dateHealth(activity, today).tone === 'escalation').map(activity => decision(activity, 'escalation'))
  const alignment = activities.filter(activity => alignmentState(activity) === 'Not aligned').map(activity => decision(activity, 'alignment'))
  const escalationIds = new Set(escalations.map(item => item.activityId))
  return {
    escalations,
    alignment,
    decisionCount: escalations.length + alignment.length,
    topicCount: new Set([...escalations, ...alignment].map(item => item.activityId)).size,
    overlapCount: alignment.filter(item => escalationIds.has(item.activityId)).length,
  }
}
