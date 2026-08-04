import { buildHeartbeatSnapshot, type HeartbeatSource } from "./heartbeat-control"
import { heartbeatRules } from "./heartbeat-rules"
export { heartbeatRules } from "./heartbeat-rules"

type RelativeHeartbeatSource = Omit<HeartbeatSource, "last_heartbeat_at"> & { minutes_ago: number }

export const relativeHeartbeatSources: RelativeHeartbeatSource[] = [
  { id: "demand-vikram", name: "Vikram Singh", role: "Demand JCO", theatre: "Rajputana (NCR)", location: "Noida 01", kind: "demand_jco", roster_state: "active_shift", minutes_ago: 124 },
  { id: "essentials-recharge", name: "Mobile recharge", role: "Essentials category", theatre: "Coromandel (Tamil Nadu)", location: "Sriperumbudur 02", kind: "essentials_category", roster_state: "active_shift", minutes_ago: 12, checklist: ["Check stockout or order-feed failure", "Check Member pricing", "Check Studio capacity"] },
  { id: "supply-nisha", name: "Nisha Patel", role: "Supply JCO", theatre: "Wellington (Karnataka)", location: "Hosur 01", kind: "supply_jco", roster_state: "active_shift", minutes_ago: 58 },
  { id: "other-priya", name: "Priya Menon", role: "RM", theatre: "Deccan (Pune)", location: "Chakan 04", kind: "other", roster_state: "active_shift", minutes_ago: 37 },
  { id: "demand-aditi", name: "Aditi Rao", role: "Demand JCO", theatre: "Coromandel (Tamil Nadu)", location: "Sriperumbudur 02", kind: "demand_jco", roster_state: "active_shift", minutes_ago: 18 },
  { id: "supply-arjun", name: "Arjun Das", role: "Supply JCO", theatre: "Deccan (Pune)", location: "Chakan 04", kind: "supply_jco", roster_state: "active_shift", minutes_ago: 31 },
  { id: "demand-rohan", name: "Rohan Iyer", role: "Demand JCO", theatre: "Wellington (Karnataka)", location: "Hosur 01", kind: "demand_jco", roster_state: "approved_break", minutes_ago: 64 },
  { id: "supply-meera", name: "Meera Nair", role: "Supply JCO", theatre: "Rajputana (NCR)", location: "Gurgaon 05", kind: "supply_jco", roster_state: "off_shift", minutes_ago: 120 },
]

export function createIllustrativeHeartbeatSources(anchorAt: string) {
  const anchorTime = new Date(anchorAt).getTime()
  return relativeHeartbeatSources.map(({ minutes_ago, ...source }) => ({
    ...source,
    last_heartbeat_at: new Date(anchorTime - minutes_ago * 60_000).toISOString(),
  }))
}

export function createIllustrativeHeartbeatSnapshot(computedAt: string) {
  const sources: HeartbeatSource[] = createIllustrativeHeartbeatSources(computedAt)
  return buildHeartbeatSnapshot(sources, heartbeatRules, computedAt)
}

export const initialHeartbeatSnapshot = createIllustrativeHeartbeatSnapshot("2026-07-15T08:30:00.000Z")
