"use client"

import { useMemo, useState } from "react"
import { DemandProximityChart } from "@/components/demand-proximity-chart"
import { nearestDistanceKm, sortDemandNodes, type DemandProximityNode } from "@/lib/operating-data"

type SortMode = "priority" | "activation" | "members"

const SORT_OPTIONS: Array<{ id: SortMode; label: string }> = [
  { id: "priority", label: "Needs action" },
  { id: "activation", label: "Activation" },
  { id: "members", label: "Members" },
]

export function DemandProximityWorkspace({ nodes }: { nodes: DemandProximityNode[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("priority")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sorted = useMemo(() => sortDemandNodes(nodes, sortMode), [nodes, sortMode])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(node => `${node.demandName} ${node.owner} ${node.location}`.toLowerCase().includes(q))
  }, [sorted, query])

  const selected = filtered.find(node => node.id === selectedId) ?? filtered[0] ?? null

  if (nodes.length === 0) {
    return <div className="proximity-empty"><strong>All demand is matched.</strong><p>No open demand nodes need an SP option.</p></div>
  }

  return <div className="proximity-workspace">
    <div className="proximity-list-pane">
      <div className="proximity-controls">
        <input
          className="proximity-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search demand, owner, or location"
          aria-label="Search open demand"
        />
        <div className="proximity-sort" role="group" aria-label="Sort open demand">
          {SORT_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              className={sortMode === option.id ? "is-active" : ""}
              aria-pressed={sortMode === option.id}
              onClick={() => setSortMode(option.id)}
            >{option.label}</button>
          ))}
        </div>
      </div>
      <p className="proximity-count">{filtered.length} open {filtered.length === 1 ? "node" : "nodes"}</p>
      {filtered.length === 0 ? (
        <p className="proximity-no-results">No demand matches that search.</p>
      ) : (
        <ul className="proximity-list" role="listbox" aria-label="Open demand nodes">
          {filtered.map((node, index) => {
            const nearest = nearestDistanceKm(node)
            const noNear = nearest > 2
            const isSelected = selected?.id === node.id
            return <li key={`${node.id}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`proximity-row ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedId(node.id)}
              >
                <span className="proximity-row-main">
                  <strong>{node.demandName}</strong>
                  <small>{node.members.toLocaleString("en-IN")} Members · activate {node.activation}</small>
                </span>
                <span className={`proximity-row-flag ${noNear ? "is-alert" : "is-ok"}`}>
                  {noNear ? "No option in 2km" : `Nearest ${nearest.toFixed(1)}km`}
                </span>
              </button>
            </li>
          })}
        </ul>
      )}
    </div>
    <div className="proximity-detail-pane">
      {selected ? <DemandProximityChart node={selected} /> : <p className="proximity-no-results">Select a demand node to see its options.</p>}
    </div>
  </div>
}
