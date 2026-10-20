import { useMemo, useState } from 'react'
import { meetingUpdatesByMember, uniqueMeetingItems } from './meetingSummaries'
import { sourceDate } from './prioritization'
import type { MeetingUpdateFlag, SourceSnapshot } from './prioritization'

const labels: Record<MeetingUpdateFlag, string> = {
  'date-moved': 'Date moved',
  'date-confirmed': 'Date confirmed',
  'new-tbd': 'New TBD',
  'existing-tbd': 'Still TBD',
  discussion: 'Needs discussion',
  completed: 'Completed',
  closed: 'Scope closed',
  'scope-change': 'Scope change',
  'in-progress': 'In progress',
}
const focusOptions = [
  { value: 'all', label: 'All updates' },
  { value: 'date-moved', label: 'Moved dates' },
  { value: 'new-tbd', label: 'New TBDs' },
  { value: 'existing-tbd', label: 'Existing TBDs' },
  { value: 'discussion', label: 'Needs discussion' },
] as const
type Focus = typeof focusOptions[number]['value']

function dateText(raw: string): string {
  const iso = sourceDate(raw)
  return iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : raw || 'Not supplied'
}

export default function MeetingUpdates({ snapshot, lead, today, onSelectActivity }: {
  snapshot: SourceSnapshot
  lead: string | null
  today: string
  onSelectActivity: (row: number) => void
}) {
  const groups = useMemo(() => meetingUpdatesByMember(snapshot, lead), [snapshot, lead])
  const [member, setMember] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>('all')
  const allItems = uniqueMeetingItems(groups)
  const memberGroups = groups.filter(group => !member || group.member === member)
  const memberItems = uniqueMeetingItems(memberGroups)
  const ownerCount = groups.filter(group => !group.unassigned).length
  const unassignedCount = allItems.filter(item => !item.pwcOwners.length).length
  const count = (flag: MeetingUpdateFlag) => allItems.filter(item => item.change.flags?.includes(flag)).length
  const visibleGroups = memberGroups.map(group => ({ ...group, items: group.items.filter(item => focus === 'all' || item.change.flags?.includes(focus)) })).filter(group => group.items.length)
  if (!allItems.length) return null

  return <section className="panel meeting-summaries" aria-label="Meeting updates by PwC owner">
    <details>
      <summary>
        <span className="meeting-summary-heading"><strong>Meeting updates by PwC owner</strong><span>{allItems.length} updates · {ownerCount} PwC owners{unassignedCount ? ` · ${unassignedCount} owner unconfirmed` : ''}{lead ? ` · ${lead}'s projects` : ''}</span></span>
        <span className="meeting-headline-flags"><span className="meeting-flag flag-date-moved">{count('date-moved')} moved dates</span><span className="meeting-flag flag-new-tbd">{count('new-tbd')} new TBDs</span><span className="meeting-flag flag-discussion">{count('discussion')} to discuss</span></span>
      </summary>
      <div className="meeting-summary-body">
        <p className="meeting-summary-description">Grouped by assigned PwC owners from the workbook and user updates; note providers are labeled separately. Shared updates appear under each owner and count once in totals. Date comparisons use the workbook end date; recorded dates show when notes were supplied.</p>
        <div className="meeting-member-filters" role="group" aria-label="Meeting PwC owner">
          <button aria-pressed={!member} onClick={() => setMember(null)}>All PwC owners</button>
          {groups.map(group => <button key={group.member} aria-pressed={member === group.member} onClick={() => setMember(member === group.member ? null : group.member)}>{group.member}<span aria-hidden="true">{group.items.length}</span></button>)}
        </div>
        <div className="meeting-focus-filters" role="group" aria-label="Meeting update focus">
          {focusOptions.map(option => <button key={option.value} aria-label={option.label} aria-pressed={focus === option.value} onClick={() => setFocus(option.value)}>{option.label}<span aria-hidden="true">{memberItems.filter(item => option.value === 'all' || item.change.flags?.includes(option.value)).length}</span></button>)}
        </div>
        <p className="meeting-filter-note">These filters apply to meeting summaries. Project filters below control the Gantt.</p>
        <div className="meeting-member-grid" aria-live="polite">
          {visibleGroups.map(group => <article key={group.member} className="meeting-member-card" aria-label={`${group.member} meeting updates`}>
            <header><h3>{group.member}</h3><span>{group.items.length} {group.items.length === 1 ? 'update' : 'updates'}</span></header>
            <ul>{group.items.map(({ change, activity, pwcOwners, providedBy }, index) => {
              const flags = change.flags ?? []
              return <li key={`${change.row ?? 'unlinked'}:${change.recordedOn}:${index}`}>
                <div className="meeting-item-flags">{flags.map(flag => <span key={flag} className={`meeting-flag flag-${flag}`}>{labels[flag]}</span>)}</div>
                <h4>{activity ? <button onClick={() => onSelectActivity(activity.row)} aria-label={`View ${change.title || change.activity} activity`}>{change.title || change.activity}</button> : change.title || change.activity}</h4>
                <p className="meeting-owner-line"><strong>PwC {pwcOwners.length > 1 ? 'owners' : 'owner'}:</strong> {pwcOwners.join(', ') || 'Not recorded in latest workbook'}{pwcOwners.length > 1 ? ' · Shared ownership' : ''}</p>
                <p className="meeting-update-source"><span><strong>Update from:</strong> {providedBy}</span><small>Recorded {dateText(change.recordedOn)}</small></p>
                {activity && (flags.includes('date-moved') || flags.includes('new-tbd')) && <p className="meeting-date-change">Workbook end <span>{dateText(activity.workbookEndRaw)}</span><span aria-hidden="true"> → </span><strong>{dateText(activity.endRaw)}</strong></p>}
                {activity && flags.includes('date-confirmed') && <p className="meeting-date-change">End confirmed: <strong>{dateText(activity.endRaw)}</strong> · unchanged from workbook</p>}
                {flags.includes('existing-tbd') && <p className="meeting-date-change">End remains <strong>TBD</strong> · already TBD in workbook</p>}
                <p className="meeting-item-description">{change.detail}</p>
                {activity?.end && activity.end < today && !activity.completed && <p className="meeting-overdue">Current end {dateText(activity.end)} has passed; confirm revised timing.</p>}
                {change.discussion && <p className="meeting-discussion"><strong>Discuss / next step:</strong> {change.discussion}</p>}
              </li>
            })}</ul>
          </article>)}
        </div>
        {!visibleGroups.length && <div className="meeting-no-results"><p>No meeting updates match these filters.</p><button className="button" onClick={() => { setMember(null); setFocus('all') }}>Clear meeting filters</button></div>}
      </div>
    </details>
  </section>
}
