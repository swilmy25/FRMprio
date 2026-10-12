export const statuses = ['On track', 'At risk', 'Blocked', 'Complete', 'Not started'] as const
export const priorities = ['Critical', 'High', 'Medium', 'Low'] as const
export type Status = typeof statuses[number]
export type Priority = typeof priorities[number]
export type Work = { controls: number; hours: number; tasks: string }
export type Project = {
  id: string; name: string; status: Status; pwcPriority: Priority; frmPriority: Priority;
  frmOwner: string; pwcOwner: string; start: string; end: string;
  plan: Work; done: Work; extraDone: Work; extraAsked: Work;
  capacity: number; context: string; decision: string; category?: string; activityType?: string; assignments?: string; remainingTasks?: string;
}
export const emptyWork = (): Work => ({ controls: 0, hours: 0, tasks: '' })
export function impact(p: Project) {
  const remaining = { controls: Math.max(0, p.plan.controls - p.done.controls), hours: Math.max(0, p.plan.hours - p.done.hours) }
  const futureHours = remaining.hours + p.extraAsked.hours
  return { remaining, futureHours, gap: Math.max(0, futureHours - p.capacity), extraHours: p.extraDone.hours + p.extraAsked.hours,
    totalHours: p.done.hours + remaining.hours + p.extraDone.hours + p.extraAsked.hours }
}
export function validate(p: Project): string | null {
  if (!p.name.trim()) return 'Enter a project name.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start) || !/^\d{4}-\d{2}-\d{2}$/.test(p.end) || !Number.isFinite(Date.parse(p.start)) || !Number.isFinite(Date.parse(p.end)) || p.end < p.start) return 'End date must be on or after start date.'
  if (!Number.isFinite(p.capacity) || p.capacity < 0) return 'Available future hours must be a nonnegative number.'
  for (const w of [p.plan, p.done, p.extraDone, p.extraAsked]) {
    if (!w || typeof w.tasks !== 'string' || !Number.isFinite(w.hours) || w.hours < 0 || !Number.isInteger(w.controls) || w.controls < 0) return 'Hours must be nonnegative; controls must be whole nonnegative numbers.'
  }
  if (p.done.controls > p.plan.controls || p.done.hours > p.plan.hours) return 'Completed planned work cannot exceed the baseline. Record additional work under “Extra completed”.'
  return null
}
export const sampleProjects: Project[] = [
  { id: 'access', name: 'Access management review', status: 'On track', pwcPriority: 'High', frmPriority: 'High', frmOwner: 'Alex Morgan', pwcOwner: 'Jordan Lee', start: '2026-10-05', end: '2026-11-13', plan: { controls: 24, hours: 160, tasks: 'User access, provisioning and quarterly recertification.' }, done: { controls: 15, hours: 96, tasks: 'Provisioning and access evidence reviewed; 15 controls completed.' }, extraDone: { controls: 2, hours: 12, tasks: 'Two additional privileged-access controls reviewed.' }, extraAsked: { controls: 3, hours: 24, tasks: 'Extend coverage to three recently acquired systems.' }, capacity: 72, context: 'SAMPLE • Evidence is available for the original scope. New systems require separate owner walkthroughs.', decision: 'Confirm whether new-system coverage takes precedence over reporting work, or allocate 16 more hours.' },
  { id: 'reporting', name: 'Financial reporting controls', status: 'At risk', pwcPriority: 'Critical', frmPriority: 'High', frmOwner: 'Sam Rivera', pwcOwner: 'Taylor Chen', start: '2026-10-12', end: '2026-12-04', plan: { controls: 32, hours: 240, tasks: 'Close, consolidation and journal-entry controls.' }, done: { controls: 10, hours: 72, tasks: 'Journal-entry testing completed; close walkthroughs underway.' }, extraDone: { controls: 0, hours: 16, tasks: 'Reworked evidence packs following a reporting change.' }, extraAsked: { controls: 4, hours: 40, tasks: 'Add a review of four new consolidation controls.' }, capacity: 176, context: 'SAMPLE • Consolidation evidence is delayed. Extra coverage competes with the original close-testing window.', decision: 'Resolve evidence timing first. The full remaining scope needs 32 hours beyond available capacity.' },
  { id: 'change', name: 'Change management testing', status: 'Blocked', pwcPriority: 'High', frmPriority: 'Medium', frmOwner: 'Casey Brooks', pwcOwner: 'Jamie Patel', start: '2026-10-19', end: '2026-11-27', plan: { controls: 18, hours: 120, tasks: 'Deployment approvals, segregation and emergency changes.' }, done: { controls: 4, hours: 24, tasks: 'Emergency-change sample completed.' }, extraDone: { controls: 0, hours: 8, tasks: 'Supported an additional evidence extraction.' }, extraAsked: { controls: 2, hours: 16, tasks: 'Assess approval controls on a new deployment pipeline.' }, capacity: 96, context: 'SAMPLE • Main testing is blocked pending deployment logs. PwC and FRM priorities are not aligned.', decision: 'Agree the sequence with both owners. Adding the pipeline review requires 16 more hours or deferring other work.' },
  { id: 'vendor', name: 'Third-party risk assessment', status: 'Not started', pwcPriority: 'Medium', frmPriority: 'Low', frmOwner: 'Drew Wilson', pwcOwner: 'Morgan Ellis', start: '2026-11-02', end: '2026-12-18', plan: { controls: 12, hours: 80, tasks: 'Vendor due diligence and monitoring.' }, done: emptyWork(), extraDone: emptyWork(), extraAsked: { controls: 0, hours: 12, tasks: 'Provide an additional vendor onboarding workshop.' }, capacity: 92, context: 'SAMPLE • Planned to begin after access testing. Workshop request can fit the current capacity allocation.', decision: 'Maintain the planned start, subject to owner availability.' },
]
export function newProject(): Project {
  const today = new Date().toLocaleDateString('en-CA')
  return { id: crypto.randomUUID(), name: '', status: 'Not started', pwcPriority: 'Medium', frmPriority: 'Medium', frmOwner: '', pwcOwner: '', start: today, end: today, plan: emptyWork(), done: emptyWork(), extraDone: emptyWork(), extraAsked: emptyWork(), capacity: 0, context: '', decision: '' }
}
