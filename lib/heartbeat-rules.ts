import type { HeartbeatRule } from "@/lib/heartbeat-control"

export const heartbeatRules: HeartbeatRule[] = [
  { kind: "supply_jco", label: "Supply JCO · property scouting", event_type: "visit_logged", signal: "property visit", definition: "No qualifying property visit is recorded within the configured limit.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log", action_label: "Check safety, then confirm", due_label: "Now", checklist: ["Check current shift", "Contact the owner", "Record the qualifying signal"] },
  { kind: "demand_jco", label: "Demand JCO · calls and gate visits", event_type: "gate_visit_confirmed", signal: "confirmed gate visit", definition: "No confirmed gate visit is recorded within the configured limit.", threshold_minutes: 45, escalation_multiplier: 2, source_system: "action_log", action_label: "Check safety, then confirm", due_label: "Now", checklist: ["Check current shift", "Contact the owner", "Record the qualifying signal"] },
  { kind: "essentials_category", label: "Essentials · category orders", event_type: "order_placed", signal: "category order", definition: "No category order is recorded within the configured limit.", threshold_minutes: 5, escalation_multiplier: 2, source_system: "commerce_orders", action_label: "Check safety, then confirm", due_label: "Now", checklist: ["Check order-feed continuity", "Check Member demand", "Check category availability"] },
  { kind: "other", label: "Other active roles", event_type: "signal_logged", signal: "qualifying work signal", definition: "No qualifying work signal is recorded within the configured limit.", threshold_minutes: 30, escalation_multiplier: 2, source_system: "action_log", action_label: "Check safety, then confirm", due_label: "Now", checklist: ["Check current shift", "Contact the owner", "Record the qualifying signal"] },
]

type PolicyRow = Record<string, unknown>
const text = (row: PolicyRow, ...keys: string[]) => { for (const key of keys) { const value = row[key]; if (String(value ?? "").trim()) return String(value).trim() } return "" }

/** Approved Dispatch policy records override bootstrap values. */
export function heartbeatRulesFromPolicies(rows: readonly PolicyRow[]): HeartbeatRule[] {
  return heartbeatRules.map((base) => {
    const prefix = `DISPATCH-${base.kind.toUpperCase().replaceAll("_", "-")}-`
    const approved = rows.filter((row) => text(row, "status").toLowerCase() === "approved" && text(row, "policy id", "policy_id").toUpperCase().startsWith(prefix))
    const value = (suffix: string) => text(approved.find((row) => text(row, "policy id", "policy_id").toUpperCase() === `${prefix}${suffix}`) ?? {}, "policy value", "threshold value", "threshold_value")
    const number = (suffix: string, fallback: number) => { const parsed = Number(value(suffix)); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback }
    const required = ["THRESHOLD", "ESCALATION", "LABEL", "DESCRIPTION", "ACTION", "DUE", "CHECKLIST"]
    const missing = required.filter((suffix) => !value(suffix))
    if (missing.length) throw new Error(`Approved Dispatch policies are missing for ${base.kind}: ${missing.join(", ")}`)
    return { ...base, threshold_minutes: number("THRESHOLD", base.threshold_minutes), escalation_multiplier: number("ESCALATION", base.escalation_multiplier), label: value("LABEL"), definition: value("DESCRIPTION"), action_label: value("ACTION"), due_label: value("DUE"), checklist: value("CHECKLIST").split("|").map((item) => item.trim()).filter(Boolean) }
  })
}
