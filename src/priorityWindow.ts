import { buildAleReadout } from './aleDecisions.ts'
import { activitiesForLead, alignmentState, dateHealth, priorityRank } from './prioritization.ts'
import type { SourceActivity } from './prioritization'

export type TwoWeekPriorities = {
  start: string
  end: string
  firstWeekEnd: string
  secondWeekStart: string
  attention: SourceActivity[]
  firstWeek: SourceActivity[]
  secondWeek: SourceActivity[]
  starting: SourceActivity[]
  ongoing: SourceActivity[]
  actions: Map<string, string>
  total: number
}

export const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

// A "before" boundary falls on the preceding calendar day for window placement.
// The displayed target always retains the original qualifier.
function deliveryDay(p: SourceActivity): string | null {
  return p.end && /^before\s/i.test(p.endRaw) ? addDays(p.end, -1) : p.end
}

const compareDate = (a: string | null, b: string | null) => (a ?? '9999').localeCompare(b ?? '9999')
const comparePriority = (a: SourceActivity, b: SourceActivity) =>
  priorityRank(a.frmPriority) - priorityRank(b.frmPriority) || priorityRank(a.pwcPriority) - priorityRank(b.pwcPriority)
const compareDelivery = (a: SourceActivity, b: SourceActivity) =>
  compareDate(deliveryDay(a), deliveryDay(b)) || comparePriority(a, b) || a.row - b.row

export function buildTwoWeekPriorities(activities: SourceActivity[], today: string, lead: string | null = null): TwoWeekPriorities {
  const scoped = activitiesForLead(activities, lead)
  const end = addDays(today, 13), firstWeekEnd = addDays(today, 6)
  const readout = buildAleReadout(scoped, today)
  const actions = new Map<string, string>()
  for (const decision of [...readout.escalations, ...readout.alignment]) {
    const existing = actions.get(decision.activityId)
    actions.set(decision.activityId, existing ? `${existing} ${decision.nextStep}` : decision.nextStep)
  }
  const attention: SourceActivity[] = [], firstWeek: SourceActivity[] = [], secondWeek: SourceActivity[] = []
  const starting: SourceActivity[] = [], ongoing: SourceActivity[] = []
  for (const p of scoped) {
    if (p.completed) continue
    if (dateHealth(p, today).tone === 'escalation' || alignmentState(p) === 'Not aligned') {
      attention.push(p)
      continue
    }
    const due = deliveryDay(p)
    if (due && due >= today && due <= end) {
      if (due <= firstWeekEnd) firstWeek.push(p)
      else secondWeek.push(p)
    } else if (p.start && p.start >= today && p.start <= end) {
      starting.push(p)
    } else if (p.section !== 'Deprioritized' && p.status !== 'On hold' && p.status !== 'Planned'
      && (!due || due >= today)
      && (!p.start || p.start <= end) && (!p.startMonth || p.startMonth <= end.slice(0, 7))
      && (p.start && p.start <= end || p.startMonth && p.startMonth <= end.slice(0, 7)
        || ['In progress', 'On track', 'Waiting on FRM'].includes(p.status) || /^ongoing|^n\/a/i.test(p.startRaw))) {
      ongoing.push(p)
    }
  }
  attention.sort((a, b) => Number(dateHealth(b, today).tone === 'escalation') - Number(dateHealth(a, today).tone === 'escalation') || compareDelivery(a, b))
  firstWeek.sort(compareDelivery)
  secondWeek.sort(compareDelivery)
  starting.sort((a, b) => compareDate(a.start, b.start) || comparePriority(a, b) || a.row - b.row)
  ongoing.sort((a, b) => comparePriority(a, b) || compareDelivery(a, b))
  return {
    start: today, end, firstWeekEnd, secondWeekStart: addDays(today, 7),
    attention, firstWeek, secondWeek, starting, ongoing, actions,
    total: attention.length + firstWeek.length + secondWeek.length + starting.length + ongoing.length,
  }
}
