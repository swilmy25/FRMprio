import { useMemo } from 'react'
import { alignmentState, dateHealth, rating } from './prioritization'
import type { SourceActivity } from './prioritization'
import { buildTwoWeekPriorities } from './priorityWindow'
import './TwoWeekPriorities.css'

const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const endLabel = (p: SourceActivity) => p.end
  ? `${/^before\s/i.test(p.endRaw) ? 'Before ' : /^around\s/i.test(p.endRaw) ? 'Around ' : ''}${date(p.end)}`
  : p.endRaw || 'Not supplied'

function PriorityCard({ activity: p, today, action, onSelect }: {
  activity: SourceActivity; today: string; action?: string; onSelect: (row: number) => void
}) {
  const health = dateHealth(p, today)
  const alignment = alignmentState(p)
  const context = action || p.escalationAction || p.meetingNotes.at(-1)?.text
  return <article className={`fortnight-card ${health.tone === 'escalation' ? 'fortnight-risk' : ''}`} aria-label={p.name.split('\n')[0]}>
    <div className="fortnight-card-heading">
      <h4><button onClick={() => onSelect(p.row)} aria-label={`View ${p.name.split('\n')[0]} project details`}>{p.name.split('\n')[0]} <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12 12 4M5 4h7v7" /></svg></button></h4>
      <div className="fortnight-signals">
        {health.tone === 'escalation' && <span className="badge health-escalation">Escalation</span>}
        {alignment === 'Not aligned' && <span className="badge high">Needs alignment</span>}
        {health.tone === 'scheduled' && p.end === today && <span className="badge health-scheduled">{health.label}</span>}
        {p.status !== 'Status not supplied' && <span className="badge">{p.status}</span>}
        {health.tone === 'paused' && <span className="badge health-paused">{health.label}</span>}
      </div>
    </div>
    <dl className="fortnight-dates"><div><dt>Start</dt><dd>{p.start ? date(p.start) : p.startRaw || 'Not supplied'}{p.startMonth && ' · month only'}</dd></div><div><dt>{/^around\s/i.test(p.endRaw) ? 'Target ETA' : 'Target end'}</dt><dd>{endLabel(p)}{!['Projected/actual end · X', 'Projected end · Deadline J', 'End unknown'].includes(p.endBasis) && <small>{p.endBasis}</small>}</dd></div></dl>
    <div className="fortnight-owners"><p><b>FRM</b> {p.frmLeads || 'Lead not supplied'}</p><p><b>PwC</b> {p.pwcOwners || 'Owner not supplied'}</p></div>
    <div className="fortnight-ratings"><span>FRM <strong>{rating(p.frmPriority)}</strong></span><span>PwC <strong>{rating(p.pwcPriority)}</strong></span>{p.category && <span>{p.category}</span>}</div>
    {context ? <p className="fortnight-context"><b>{action || p.escalationAction ? 'Next step' : 'Latest update'}:</b> {context}</p>
      : <p className="fortnight-context">Confirm this window’s work and delivery readiness with the listed owners.</p>}
  </article>
}

export default function TwoWeekPriorities({ activities, today, lead, onSelect }: {
  activities: SourceActivity[]; today: string; lead: string | null; onSelect: (row: number) => void
}) {
  const plan = useMemo(() => buildTwoWeekPriorities(activities, today, lead), [activities, today, lead])
  const cards = (items: SourceActivity[]) => <div className="fortnight-cards">{items.map(p => <PriorityCard key={p.id} activity={p} today={today} action={plan.actions.get(p.id)} onSelect={onSelect} />)}</div>
  const week = (title: string, start: string, end: string, items: SourceActivity[]) => <section className="fortnight-week" aria-label={`${title} delivery priorities`}>
    <header><div><h3>{title}</h3><p>{date(start)} – {date(end)}</p></div><span>{items.length} {items.length === 1 ? 'delivery' : 'deliveries'}</span></header>
    {items.length ? <>{cards(items.slice(0, 3))}{items.length > 3 && <details className="fortnight-more"><summary>Show {items.length - 3} more deliveries</summary>{cards(items.slice(3))}</details>}</> : <p className="fortnight-empty">No additional delivery targets in this week.</p>}
  </section>
  return <section className="panel fortnight-priorities" aria-label="Next two weeks priorities">
    <header className="fortnight-heading"><div><p className="eyebrow">{lead ? `FRM FOCUS · ${lead}` : 'PORTFOLIO FOCUS'}</p><h2>Next two weeks</h2><p>{date(plan.start)} – {date(plan.end)} · Pacific time</p></div><span className="fortnight-total">{plan.total} open {plan.total === 1 ? 'project' : 'projects'}</span></header>
    <p className="fortnight-explanation">{lead ? `Priorities for ${lead}.` : 'Priorities across the full portfolio.'} Decisions first, then upcoming dates. Other active work is ordered by FRM priority, then PwC priority. Each project appears once; the project filters below apply to the timeline.</p>
    <div className="fortnight-summary" aria-label="Two-week focus counts"><div><strong>{plan.attention.length}</strong><span>Need attention</span></div><div><strong>{plan.firstWeek.length + plan.secondWeek.length}</strong><span>Delivery priorities</span></div><div><strong>{plan.starting.length}</strong><span>Upcoming starts</span></div><div><strong>{plan.ongoing.length}</strong><span>Other active work</span></div></div>
    {plan.attention.length > 0 && <section className="fortnight-attention" aria-label="Priorities needing attention"><header><h3>Act now</h3><p>Current escalations and priority decisions, including unresolved items from earlier dates.</p></header>{cards(plan.attention)}</section>}
    <div className="fortnight-weeks">{week('Week 1', plan.start, plan.firstWeekEnd, plan.firstWeek)}{week('Week 2', plan.secondWeekStart, plan.end, plan.secondWeek)}</div>
    {plan.starting.length > 0 && <section className="fortnight-starting" aria-label="Upcoming project starts"><header><h3>Starting in this window</h3><p>Confirm readiness and agree the first milestones.</p></header>{cards(plan.starting)}</section>}
    {plan.ongoing.length > 0 && <details className="fortnight-ongoing"><summary>Other active work to advance <span>{plan.ongoing.length}</span></summary><p>These open projects span this window or have ongoing work. Confirm the next milestone with the owners.</p>{cards(plan.ongoing)}</details>}
    {!plan.total && <p className="fortnight-empty">No open priorities in this window for {lead || 'the portfolio'}.</p>}
  </section>
}
