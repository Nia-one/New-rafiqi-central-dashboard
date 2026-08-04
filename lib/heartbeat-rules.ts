import type { HeartbeatRule } from "@/lib/heartbeat-control"

export const heartbeatRules: HeartbeatRule[] = [
  { kind: "supply_jco", label: "Supply JCO · property scouting", event_type: "visit_logged", signal: "property visit", definition: "A logged property visit tagged good or bad. Either outcome counts.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log" },
  { kind: "demand_jco", label: "Demand JCO · calls and gate visits", event_type: "gate_visit_confirmed", signal: "confirmed gate visit", definition: "A confirmed gate visit. A dialled call alone does not count.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log" },
  { kind: "essentials_category", label: "Essentials · category orders", event_type: "order_placed", signal: "category order", definition: "Any order placed anywhere in the category.", threshold_minutes: 5, escalation_multiplier: 2, source_system: "commerce_orders" },
  { kind: "other", label: "Other active roles", event_type: "signal_logged", signal: "qualifying work signal", definition: "A configurable qualifying signal for the role.", threshold_minutes: 30, escalation_multiplier: 2, source_system: "action_log" },
]
