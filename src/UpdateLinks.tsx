import type { UpdateProvenance } from './prioritization'

export default function UpdateLinks({update}:{update:UpdateProvenance}) {
 if(!update.via&&!update.sourceUrl&&!update.readoutUrl)return null
 return <span className="update-links">{update.via&&<span>via {update.via}</span>}{update.sourceUrl&&<a href={update.sourceUrl} target="_blank" rel="noreferrer">Source message</a>}{update.readoutUrl&&<a href={update.readoutUrl} target="_blank" rel="noreferrer">Buddy readout</a>}</span>
}
