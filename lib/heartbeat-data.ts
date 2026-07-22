import { buildHeartbeatSnapshot, type HeartbeatRule, type HeartbeatSource } from "./heartbeat-control"

export const heartbeatRules: HeartbeatRule[] = [
  { kind: "supply_jco", label: "Supply JCO · property scouting", event_type: "visit_logged", signal: "property visit", definition: "A logged property visit tagged good or bad. Either outcome counts.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log" },
  { kind: "demand_jco", label: "Demand JCO · calls and gate visits", event_type: "gate_visit_confirmed", signal: "confirmed gate visit", definition: "A confirmed gate visit. A dialled call alone does not count.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log" },
  { kind: "essentials_category", label: "Essentials · category orders", event_type: "order_placed", signal: "category order", definition: "Any order placed anywhere in the category.", threshold_minutes: 5, escalation_multiplier: 2, source_system: "commerce_orders" },
  { kind: "other", label: "Other active roles", event_type: "signal_logged", signal: "qualifying work signal", definition: "A configurable qualifying signal for the role.", threshold_minutes: 30, escalation_multiplier: 2, source_system: "action_log" },
]

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
