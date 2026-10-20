import { useMemo, useState } from 'react'
import { activitiesForLead, alignmentState, dateHealth, parseSource, peopleDirectory, priorityRank, rating } from './prioritization'
import type { SourceActivity, SourceSnapshot } from './prioritization'
import MeetingUpdates from './MeetingUpdates'
import { usePacificDate } from './usePacificDate'

const day = 86400000
const value = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
function Pill({ text }: { text: string }) {
  const theme = /^(high|critical)/i.test(text) ? 'high' : /^(moderate|medium)/i.test(text) ? 'medium' : /^low/i.test(text) ? 'low' : ''
  return <span className={`badge ${theme}`}>{text || 'Not supplied'}</span>
}
function ChoiceFilter({ title, options, selected, onChange }: { title: string; options: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return <details className="choice-filter"><summary>{title}<span>{selected.length ? `${selected.length} selected` : 'All'}</span></summary><div className="choice-menu" role="group" aria-label={title}>
    <button className="clear-choice" onClick={() => onChange([])}>Clear {title.toLowerCase()}</button>
    {options.map(option => <label key={option}><input type="checkbox" aria-label={`${title}: ${option}`} checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter(s => s !== option) : [...selected, option])} />{option}</label>)}
  </div></details>
}
export default function WorkbookDashboard({ snapshot, lead = null }: { snapshot: SourceSnapshot; lead?: string | null }) {
  const activities = useMemo(() => activitiesForLead(parseSource(snapshot),lead), [snapshot,lead])
  const leads = useMemo(() => peopleDirectory(activities.map(p => p.frmLeads)), [activities])
  const owners = useMemo(() => peopleDirectory(activities.map(p => p.pwcOwners), true), [activities])
  const [selectedId, setSelectedId] = useState(activities[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [selectedLeads, setLeads] = useState<string[]>([])
  const [selectedOwners, setOwners] = useState<string[]>([])
  const [frmRatings, setFrmRatings] = useState<string[]>([])
  const [pwcRatings, setPwcRatings] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [alignment, setAlignment] = useState('All alignment')
  const [section, setSection] = useState('All sections')
  const [healthFilter, setHealthFilter] = useState('All date statuses')
  const [sort, setSort] = useState('Sheet order')
  const [view, setView] = useState('Timeline')
  const today = usePacificDate()
  const matches = (selected: string[], values: string[]) => !selected.length || selected.some(s => values.includes(s))
  const filtered = activities.filter(p => `${p.name} ${p.pwcOwners} ${p.frmLeads} ${p.category} ${p.activityType} ${p.meetingNotes.map(n=>n.text).join(' ')} ${p.mergedActivities.map(m=>m.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())
    && matches(selectedLeads, leads.resolve(p.frmLeads)) && matches(selectedOwners, owners.resolve(p.pwcOwners))
    && matches(frmRatings, [rating(p.frmPriority)]) && matches(pwcRatings, [rating(p.pwcPriority)]) && matches(categories, [p.category || 'Not supplied'])
    && (alignment === 'All alignment' || alignmentState(p) === alignment)
    && (section === 'All sections' || p.section === section)
    && (healthFilter === 'All date statuses' || dateHealth(p, today).tone === healthFilter)
  ).sort((a, b) => sort === 'PwC priority' ? priorityRank(a.pwcPriority) - priorityRank(b.pwcPriority) : sort === 'FRM priority' ? priorityRank(a.frmPriority) - priorityRank(b.frmPriority) : a.row - b.row)
  const selected = filtered.find(p => p.id === selectedId) ?? filtered[0]
  const complete = filtered.filter(p => p.completed).length
  const escalated = filtered.filter(p => dateHealth(p, today).tone === 'escalation').length
  const unaligned = filtered.filter(p => alignmentState(p) === 'Not aligned').length
  const dated = filtered.flatMap(p => [p.start, p.end].filter((d): d is string => !!d))
  const minimum = dated.length ? Math.min(...dated.map(value)) - day * 4 : value(today) - day * 7
  const maximum = dated.length ? Math.max(...dated.map(value)) + day * 7 : minimum + day * 90
  const duration = Math.max(day * 7, maximum - minimum)
  const ticks = Array.from({ length: 6 }, (_, i) => new Date(minimum + duration * i / 5).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}))
  const todayPercent = (value(today) - minimum) / duration * 100
  const clear = () => { setSearch(''); setLeads([]); setOwners([]); setFrmRatings([]); setPwcRatings([]); setCategories([]); setAlignment('All alignment'); setSection('All sections'); setHealthFilter('All date statuses') }
  const selectMeetingActivity = (row:number) => { clear(); setSelectedId(`source-row-${row}`); requestAnimationFrame(() => document.getElementById('workbook-activity-detail')?.scrollIntoView({behavior:'smooth',block:'start'})) }
  const active = [...selectedLeads.map(v => ['FRM lead', v, () => setLeads(selectedLeads.filter(s => s !== v))] as const), ...selectedOwners.map(v => ['PwC owner', v, () => setOwners(selectedOwners.filter(s => s !== v))] as const), ...frmRatings.map(v => ['FRM priority', v, () => setFrmRatings(frmRatings.filter(s => s !== v))] as const), ...pwcRatings.map(v => ['PwC priority', v, () => setPwcRatings(pwcRatings.filter(s => s !== v))] as const), ...categories.map(v => ['Category', v, () => setCategories(categories.filter(s => s !== v))] as const)]
  return <div className="workbook-dashboard">
    <div className="source-snapshot-banner"><span>PRIORITIZATION SNAPSHOT</span><strong>{snapshot.tabName}</strong><p>{snapshot.fileName} · {activities.length} activities · updated {new Date(snapshot.importedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p><p>Orange columns only: activity, accountable owners, priorities, alignment, category, activity type, dates and detailed staffing.</p></div>
    <MeetingUpdates snapshot={snapshot} lead={lead} today={today} onSelectActivity={selectMeetingActivity} />
    {lead && <div className="lead-scope-banner"><strong>FRM lead: {lead}</strong><p>All summaries, filters, timeline rows and exports are scoped to this lead. Shared projects appear in each assigned lead’s view and once in the overall portfolio.</p></div>}
    <div className="metric-grid workbook-metrics">
      <button className="metric" onClick={clear}><p>Activities in view</p><strong>{filtered.length}<small> / {activities.length}</small></strong><span>Click to clear all filters</span></button>
      <button className={`metric ${healthFilter === 'completed' ? 'metric-active' : ''}`} onClick={() => setHealthFilter(healthFilter === 'completed' ? 'All date statuses' : 'completed')}><p>Completed / closed</p><strong className="green-number">{complete}</strong><span>Completed or closed by the source / meeting notes</span></button>
      <button className={`metric ${healthFilter === 'escalation' ? 'metric-active' : ''}`} onClick={() => setHealthFilter(healthFilter === 'escalation' ? 'All date statuses' : 'escalation')}><p>Escalation</p><strong className="red-number">{escalated}</strong><span>TBD, missing dates or overdue end</span></button>
      <button className={`metric ${alignment === 'Not aligned' ? 'metric-active' : ''}`} onClick={() => setAlignment(alignment === 'Not aligned' ? 'All alignment' : 'Not aligned')}><p>PwC / FRM not aligned</p><strong>{unaligned}</strong><span>Source says No or ratings differ</span></button>
    </div>
    {lead && <section className="lead-breakdowns" aria-label="FRM lead breakdown">
      <article><h2>FRM priorities</h2>{[...new Set(activities.map(p=>rating(p.frmPriority)))].map(r=><button key={r} onClick={()=>setFrmRatings(frmRatings.includes(r)?frmRatings.filter(v=>v!==r):[r])} aria-pressed={frmRatings.includes(r)}>{r}<strong>{activities.filter(p=>rating(p.frmPriority)===r).length}</strong></button>)}</article>
      <article><h2>Categories</h2>{[...new Set(activities.map(p=>p.category||'Not supplied'))].sort().map(c=><button key={c} onClick={()=>setCategories(categories.includes(c)?categories.filter(v=>v!==c):[c])} aria-pressed={categories.includes(c)}>{c}<strong>{activities.filter(p=>(p.category||'Not supplied')===c).length}</strong></button>)}</article>
      <article><h2>PwC ownership</h2>{owners.options.map(owner=><button key={owner} onClick={()=>setOwners(selectedOwners.includes(owner)?selectedOwners.filter(v=>v!==owner):[owner])} aria-pressed={selectedOwners.includes(owner)}>{owner}<strong>{activities.filter(p=>owners.resolve(p.pwcOwners).includes(owner)).length}</strong></button>)}<p>Shared projects count under each owner.</p></article>
    </section>}
    <section className="panel workbook-filter-panel" aria-label="Activity filters">
      <div className="filter-heading"><h2>Find your projects</h2><button className="button" onClick={clear}>Clear all filters</button></div>
      <div className={`people-filters ${lead?'lead-scoped-filters':''}`}>
        {!lead && <ChoiceFilter title="FRM lead" options={leads.options} selected={selectedLeads} onChange={setLeads} />}
        <ChoiceFilter title="PwC owner" options={owners.options} selected={selectedOwners} onChange={setOwners} />
        <ChoiceFilter title="FRM priority" options={[...new Set(activities.map(p => rating(p.frmPriority)))]} selected={frmRatings} onChange={setFrmRatings} />
        <ChoiceFilter title="PwC priority" options={[...new Set(activities.map(p => rating(p.pwcPriority)))]} selected={pwcRatings} onChange={setPwcRatings} />
        <ChoiceFilter title="Category" options={[...new Set(activities.map(p => p.category || 'Not supplied'))].sort()} selected={categories} onChange={setCategories} />
      </div>
      <div className="filters supplemental-filters"><input aria-label="Search source activities" placeholder="Search activities or accountable owners…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Filter priority alignment" value={alignment} onChange={e => setAlignment(e.target.value)}>{['All alignment', 'Not aligned', 'Aligned', 'Not recorded', 'Not applicable'].map(s => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter source section" value={section} onChange={e => setSection(e.target.value)}>{['All sections', 'Active portfolio', 'Deprioritized', 'Completed'].map(s => <option key={s} value={s}>{s==='Completed'?'Completed / closed':s}</option>)}</select>
        <select aria-label="Filter date status" value={healthFilter} onChange={e => setHealthFilter(e.target.value)}><option>All date statuses</option><option value="completed">Completed / closed</option><option value="escalation">Escalation</option><option value="scheduled">Scheduled / due today</option><option value="ongoing">Ongoing / not dated</option></select>
      </div>
      {!!active.length && <div className="active-filters">{active.map(([title, v, remove]) => <button key={`${title}:${v}`} onClick={remove} aria-label={`Remove ${title}: ${v}`}>{title}: {v} <span>×</span></button>)}</div>}
      <p className="filter-explanation">Multiple selections within one filter match any selected value; different filters combine. Names on shared-owner activities match individually.</p>
    </section>
    <section className="panel" aria-label="Workbook project timeline">
      <div className="panel-toolbar"><div className="tabs">{['Timeline', 'Projects'].map(t => <button key={t} className={view === t ? 'selected' : ''} onClick={() => setView(t)}>{t}</button>)}</div><div className="filters"><span className="as-of">Date check: {date(today)} · Pacific time</span><select aria-label="Sort source activities" value={sort} onChange={e => setSort(e.target.value)}>{['Sheet order', 'PwC priority', 'FRM priority'].map(s => <option key={s}>{s}</option>)}</select></div></div>
      <div className="timeline-scroll"><div className={`workbook-table ${view === 'Projects' ? 'date-list' : ''}`}>
        <div className="row table-head workbook-row"><span>ACTIVITY / OWNERS</span><span>PRIORITIES / ALIGNMENT</span><span>PROJECTED/ACTUAL START</span><span>PROJECTED/ACTUAL END</span>{view === 'Timeline' && <div className="time-axis">{ticks.map((t, i) => <span key={i} style={{ left: `${i / 5 * 100}%` }}>{t}</span>)}</div>}</div>
        {filtered.map(p => {
          const health = dateHealth(p, today), validWindow = p.start && p.end && p.start <= p.end
          return <button key={p.id} className={`row project-row workbook-row date-${health.tone} ${selected?.id === p.id ? 'selected-row' : ''}`} onClick={() => setSelectedId(p.id)} aria-pressed={selected?.id === p.id}>
            <div className="project-cell"><strong title={p.name}><small className="source-ref">Row {p.row} · {p.section}</small>{p.name.split('\n')[0]}</strong><span className="owners-list"><span className="owner-line" title={p.pwcOwners}><b>PwC</b> {p.pwcOwners || 'Not supplied'}</span><span className="owner-line" title={p.frmLeads}><b>FRM</b> {p.frmLeads || 'Not supplied'}</span></span></div>
            <div className="source-status"><div className="priority-pair"><span>PwC</span><Pill text={rating(p.pwcPriority)} /></div><div className="priority-pair"><span>FRM</span><Pill text={rating(p.frmPriority)} /></div><span className={`badge alignment-${alignmentState(p).toLowerCase().replaceAll(' ', '-')}`}>{alignmentState(p)}</span>{p.status==='In progress' && <span className="badge source-progress">In progress</span>}</div>
            <div className="source-date"><strong>{p.start ? date(p.start) : p.startRaw || 'Not supplied'}</strong><span className={`badge health-${health.tone}`}>{health.label}</span></div>
            <div className="source-date"><strong>{p.completed && !p.end ? p.closureReason?'Closed':'Completed' : p.end ? date(p.end) : p.endRaw || 'Not supplied'}</strong><small>{p.completed && !p.end ? p.closureReason?p.closureReason:'Actual end date not recorded' : p.endRaw !== p.end && p.end ? p.endRaw : ''}</small>{health.tone === 'escalation' && <span className="date-reason">{health.reasons.join(' · ')}</span>}</div>
            {view === 'Timeline' && <div className="track">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="gridline" style={{ left: `${i / 5 * 100}%` }} />)}{todayPercent >= 0 && todayPercent <= 100 && <span className="today-line" style={{ left: `${todayPercent}%` }} />}
              {validWindow ? <div className={`gantt-bar health-${health.tone}`} style={{ left: `${(value(p.start!) - minimum) / duration * 100}%`, width: `${(value(p.end!) - value(p.start!) + day) / duration * 100}%` }} title={`${p.start} to ${p.end}. ${health.label}. ${health.reasons.join(' ')}`}><span className="bar-label">{p.end!.slice(5)}</span></div>
                : p.completed ? <span className="completed-marker">✓ {p.closureReason?health.label:'Completed · end date not recorded'}</span>
                  : p.end ? <><span className={`due-marker health-${health.tone}`} style={{ left: `${(value(p.end) - minimum) / duration * 100}%` }} title={`End ${date(p.end)}; start unresolved`}>◆</span><span className="unplanned-label">Start not supplied</span></>
                    : <span className={`unresolved-marker health-${health.tone}`}>{health.tone === 'escalation' ? 'Escalate · dates unresolved' : 'Ongoing / dates not applicable'}</span>}
            </div>}
          </button>
        })}
        {!filtered.length && <div className="empty"><h3>No matching activities</h3><p>Clear a filter or try a different selection.</p></div>}
      </div></div>
      <div className="timeline-footer"><span>{filtered.length}/{activities.length} activities · summaries reflect filters</span><span className="date-legend"><i className="legend-green" /> Completed / closed <i className="legend-red" /> TBD / unresolved / overdue <i className="legend-blue" /> Scheduled · ◆ End date only</span></div>
    </section>
    <p className="date-rule-note">Red flags unfinished work with a TBD/unresolved date or an end date before today. Past actual starts are not overdue by themselves. Completed work and explicit scope closures stay green; closures do not indicate testing was performed. N/A / ongoing PMO dates remain undated.</p>
    {selected && <SourceDetails activity={selected} today={today} />}
  </div>
}
function SourceDetails({ activity: p, today }: { activity: SourceActivity; today: string }) {
  const health = dateHealth(p, today)
  return <section id="workbook-activity-detail" className="project-detail source-details" aria-label="Workbook activity detail">
    <div className="detail-heading"><div><p className="eyebrow">SOURCE ROW {p.row} · {p.section.toUpperCase()}</p><h2>{p.name}</h2><p className="detail-meta">PwC owners: {p.pwcOwners || 'Not supplied'} <span>·</span> FRM leads: {p.frmLeads || 'Not supplied'}</p></div><span className={`badge health-${health.tone}`}>{health.label}</span></div>
    <div className="detail-tags">{p.status==='In progress' && <span>Status: In progress</span>}<span>Category: {p.category || 'Not supplied'}</span><span>Activity: {p.activityType || 'Not supplied'}</span><span>PwC priority: {p.pwcPriority || 'Not supplied'}</span><span>FRM priority / timing: {p.frmPriority || 'Not supplied'}</span><span>Source alignment (J): {p.alignment || 'Not recorded'}</span></div>
    <div className="source-facts source-date-facts"><div><span>Projected/actual start · W</span><strong>{p.start ? date(p.start) : p.startRaw || 'Not supplied'}</strong></div><div><span>Current projected/actual end</span><strong>{p.end ? date(p.end) : p.endRaw || 'Not supplied'}</strong>{p.completed && !p.end && <small>{p.closureReason?`Scope closure: ${p.closureReason}; this is not completed testing.`:'Marked complete; exact actual end date not supplied.'}</small>}{p.end && p.endRaw !== p.end && <small>Source: {p.endRaw}</small>}</div></div>
    {!!p.meetingNotes.length && <section className="meeting-activity-notes" aria-label="Meeting context"><h3>Meeting context / applied decisions</h3><div className="workbook-originals"><span>Workbook end (X): <strong>{p.workbookEndRaw||'Not supplied'}</strong></span><span>Workbook FRM lead (F): <strong>{p.workbookFrmLeads||'Not supplied'}</strong></span></div>{p.meetingNotes.map((note,i)=><article key={i}><p>{note.text}</p>{note.applicationNote && <p className="application-interpretation"><strong>Applied interpretation:</strong> {note.applicationNote}</p>}<small>{note.source} · recorded {date(note.recordedOn)}</small></article>)}</section>}
    {!!p.mergedActivities.length && <section className="merged-scope" aria-label="Merged activity context"><h3>Merged scope · counted as one activity</h3>{p.mergedActivities.map(m=><article key={m.row}><h4>{m.name}</h4><p>Original source row {m.row} · FRM lead: {m.frmLeads||'Not supplied'} · PwC owners: {m.pwcOwners||'Not supplied'}</p><p>Category: {m.category||'Not supplied'} · Activity type: {m.activityType||'Not supplied'}</p><p>Original priorities: PwC {m.pwcPriority||'Not supplied'} · FRM {m.frmPriority||'Not supplied'} · Source alignment: {m.alignment||'Not recorded'}</p><p>Original start: {m.startRaw||'Not supplied'} · Original end: {m.endRaw||'Not supplied'}</p><p>Staffing support: {m.staffing||'Not supplied'}</p></article>)}</section>}
    <article className="staffing-detail"><p className="eyebrow">STAFFING VIEW · DETAIL ONLY</p><h3>Staffing support planned / currently · Y</h3><p>{p.staffing || 'Not supplied'}</p></article>
    {health.tone === 'escalation' && <div className="date-escalation-panel"><h3>Escalation needed</h3><ul>{health.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
    {alignmentState(p) === 'Not aligned' && <div className="source-warnings"><h3>Priority alignment needed</h3><p>{/^no$/i.test(p.alignment) ? 'The source explicitly marks FRM and PwC as not aligned.' : 'The supplied priority ratings differ, even if the alignment field says Yes.'} Confirm sequencing with both accountable owners.</p></div>}
    <p className="footnote">Orange workbook columns and explicitly supplied meeting notes are included. Hours, controls, historical due-date columns and the blue narrative column remain excluded.</p>
  </section>
}
