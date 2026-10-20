import type { AleDecision, AleReadoutData } from './aleDecisions'
import { aleItemHistory, pacificDay } from './aleHistory'
import type { AleHistory } from './aleHistory'

const dateText = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function DecisionBucket({ title, items, tone, history, updateId }: { title: string; items: AleDecision[]; tone: string; history: AleHistory; updateId: string }) {
  return <section className={`panel ale-bucket ${tone}`} aria-label={`${title} decisions`}>
    <header><h2>{title}</h2><span>{items.length} {items.length === 1 ? 'decision' : 'decisions'}</span></header>
    {!!items.length && <div className="ale-column-headings" aria-hidden="true"><span>PwC / FRM owners</span><span>Topic</span><span>Needed to move forward</span><span>Update history</span></div>}
    {items.map(item => {
      const logged = aleItemHistory(history, updateId, item.historyKey)
      return <article className={`ale-decision ${logged?.status === 'carryover' ? 'ale-carried-over' : ''}`} key={item.id} aria-label={`${title}: ${item.topic}`}>
      <div className="ale-owner-groups">
        <div className="ale-owners"><span className="ale-owner-label">PwC</span>{item.owners.length ? item.owners.map(owner => <span className="ale-owner-tag" key={owner}>@{owner}</span>) : <span className="ale-owner-missing">Owner not supplied</span>}</div>
        <div className="ale-frm-owners"><span className="ale-owner-label">FRM</span>{item.frmOwners.length ? item.frmOwners.map(owner => <span className="ale-frm-tag" key={owner}>@{owner}</span>) : <span className="ale-owner-missing">Owner not supplied</span>}</div>
      </div>
      <h3>{item.topic}</h3>
      <p><span className="ale-mobile-label">Needed to move forward</span>{item.nextStep}</p>
      <div className="ale-item-history" aria-label={`${item.topic} update history`}>
        {logged && <><span className={`ale-history-badge history-${logged.status}`}>{logged.status === 'new' ? 'New this update' : logged.status === 'carryover' ? `Carryover · ${logged.seenUpdates} updates` : `Seen previously · ${logged.seenUpdates} updates`}</span><span><b>First logged</b> {dateText(logged.firstSeen)}</span><span><b>Last seen</b> {dateText(logged.lastSeen)}</span></>}
      </div>
    </article>})}
    {!items.length && <p className="ale-empty">No items currently in this bucket.</p>}
  </section>
}

export default function AleReadout({ data, today, history, updateId, storageError }: { data: AleReadoutData; today: string; history: AleHistory; updateId: string; storageError: boolean }) {
  const date = dateText(today)
  const carried = [...data.escalations, ...data.alignment].filter(item => aleItemHistory(history, updateId, item.historyKey)?.status === 'carryover').length
  return <section className="ale-readout" aria-label="Alejandro’s leadership readout">
    <div className="ale-context"><strong>Whole portfolio · {data.topicCount} {data.topicCount === 1 ? 'topic' : 'topics'}</strong><span>As of {date} · Pacific time</span></div>
    <div className="metric-grid ale-metrics">
      <div className="metric"><p>Decision items</p><strong>{data.decisionCount}</strong><span>Items for Alejandro and the team</span></div>
      <div className="metric"><p>Escalations</p><strong className="red-number">{data.escalations.length}</strong><span>Dates, scope or delivery need a decision</span></div>
      <div className="metric"><p>PwC / FRM alignment</p><strong className="ale-alignment-number">{data.alignment.length}</strong><span>Agree priority and sequencing</span></div>
      <div className="metric"><p>Carried over</p><strong className="ale-alignment-number">{carried}</strong><span>Also on the preceding logged update</span></div>
    </div>
    {!!data.overlapCount && <p className="ale-overlap-note">{data.overlapCount} {data.overlapCount === 1 ? 'topic appears' : 'topics appear'} in both buckets, with a separate action for each decision.</p>}
    <DecisionBucket title="Escalations" items={data.escalations} tone="ale-escalation" history={history} updateId={updateId} />
    <DecisionBucket title="PwC / FRM alignment" items={data.alignment} tone="ale-alignment" history={history} updateId={updateId} />
    {!!history.updates.length && <p className="ale-history-note">Tracking began {dateText(pacificDay(history.updates[0].observedAt))}; earlier history is unavailable. Published history is shared; browser imports are saved locally and included in source exports.</p>}
    {storageError && <p className="error" role="alert">Local update history could not be saved. Export the dashboard before leaving to retain it.</p>}
    <p className="ale-footnote">Next steps summarize the recorded blockers for Alejandro and the team to resolve. Owner tags follow the worksheet.</p>
  </section>
}
