import type { DemandProximityNode } from "@/lib/operating-data"

const MAX_DISTANCE_KM = 5
const PLOT_SIZE = 320
const CENTER = PLOT_SIZE / 2
const MAX_RADIUS = 128

function positionOption(distanceKm: number, angle: number) {
  const radius = Math.min(distanceKm / MAX_DISTANCE_KM, 1) * MAX_RADIUS
  const radians = (angle - 90) * Math.PI / 180
  return { left: `${CENTER + Math.cos(radians) * radius}px`, top: `${CENTER + Math.sin(radians) * radius}px` }
}

export function DemandProximityChart({ node }: { node: DemandProximityNode }) {
  const nearest = [...node.options].sort((a, b) => a.distanceKm - b.distanceKm)[0]
  return <article className="proximity-card" aria-labelledby={`${node.id}-title`}>
    <header><div><p className="pillar-kicker">OPEN DEMAND</p><h3 id={`${node.id}-title`}>{node.demandName}</h3><p>{node.members.toLocaleString("en-IN")} Members · activate {node.activation}</p></div><span className="proximity-option-count">{node.options.length} options</span></header>
    <div className="proximity-plot" aria-hidden="true">{[5, 3, 2].map(distance => <div className={`proximity-ring ring-${distance}`} key={distance}><span>{distance} km</span></div>)}<div className="demand-node"><span>Demand</span><strong>{node.shortName}</strong><small>{node.members} Members</small></div>{node.options.map(option => <div className={`supply-option ${option.distanceKm <= 2 ? "is-viable" : ""}`} key={option.id} style={positionOption(option.distanceKm, option.angle)}><i /><span><strong>{option.name}</strong><small>{option.distanceKm.toFixed(1)} km</small></span></div>)}</div>
    <div className="proximity-summary"><p><span>Nearest option</span><strong>{nearest ? `${nearest.name} · ${nearest.distanceKm.toFixed(1)} km` : "No SP Studio coordinates"}</strong></p><p><span>Demand owner</span><strong>{node.owner}</strong></p></div>
    <p className="proximity-note">SP options are calculated from Studio Master coordinates. This demand node drops when its status becomes Matched.</p>
    <ul className="sr-only">{node.options.map(option => <li key={option.id}>{option.name}, {option.distanceKm.toFixed(1)} kilometres from {node.demandName}</li>)}</ul>
  </article>
}
