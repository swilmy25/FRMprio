import type { AleDecision, AleReadoutData } from './aleDecisions'

function DecisionBucket({ title, items, tone }: { title: string; items: AleDecision[]; tone: string }) {
  return <section className={`panel ale-bucket ${tone}`} aria-label={`${title} decisions`}>
    <header><h2>{title}</h2><span>{items.length} {items.length === 1 ? 'decision' : 'decisions'}</span></header>
    {!!items.length && <div className="ale-column-headings" aria-hidden="true"><span>PwC owner</span><span>Topic</span><span>Needed to move forward</span></div>}
    {items.map(item => <article className="ale-decision" key={item.id} aria-label={`${title}: ${item.topic}`}>
      <div className="ale-owners"><span className="ale-mobile-label">PwC owner</span>{item.owners.length ? item.owners.map(owner => <span className="ale-owner-tag" key={owner}>@{owner}</span>) : <span className="ale-owner-missing">Owner not supplied</span>}</div>
      <h3>{item.topic}</h3>
      <p><span className="ale-mobile-label">Needed to move forward</span>{item.nextStep}</p>
    </article>)}
    {!items.length && <p className="ale-empty">No items currently in this bucket.</p>}
  </section>
}

export default function AleReadout({ data, today }: { data: AleReadoutData; today: string }) {
  const date = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return <section className="ale-readout" aria-label="Alejandro’s leadership readout">
    <div className="ale-context"><strong>Whole portfolio · {data.topicCount} {data.topicCount === 1 ? 'topic' : 'topics'}</strong><span>As of {date} · Pacific time</span></div>
    <div className="metric-grid ale-metrics">
      <div className="metric"><p>Decision items</p><strong>{data.decisionCount}</strong><span>Items for Alejandro and the team</span></div>
      <div className="metric"><p>Escalations</p><strong className="red-number">{data.escalations.length}</strong><span>Dates, scope or delivery need a decision</span></div>
      <div className="metric"><p>PwC / FRM alignment</p><strong className="ale-alignment-number">{data.alignment.length}</strong><span>Agree priority and sequencing</span></div>
    </div>
    {!!data.overlapCount && <p className="ale-overlap-note">{data.overlapCount} {data.overlapCount === 1 ? 'topic appears' : 'topics appear'} in both buckets, with a separate action for each decision.</p>}
    <DecisionBucket title="Escalations" items={data.escalations} tone="ale-escalation" />
    <DecisionBucket title="PwC / FRM alignment" items={data.alignment} tone="ale-alignment" />
    <p className="ale-footnote">Next steps summarize the recorded blockers for Alejandro and the team to resolve. Owner tags follow the worksheet.</p>
  </section>
}
