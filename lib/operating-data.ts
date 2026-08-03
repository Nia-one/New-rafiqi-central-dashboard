import type { DashboardRoute } from "@/lib/dashboard-model"
import type { AllocationDomain, JoinKey, PositiveOutlier } from "@/lib/allocation-types"
import { mismatchContextById } from "@/lib/allocation-data"

export type FunnelDiagnosticContext = { domain: AllocationDomain; joinKey: JoinKey }
export type FunnelStage = { label: string; today: number; mtd: number; todayConversion: number | null; mtdConversion: number | null; delta: string; signal?: "issue" | "positive"; reason?: string; diagnosticContext?: FunnelDiagnosticContext }
export type TeamPerson = { name: string; conversion: number; lastUpdated: string }
export type TeamBlock = { name: string; owner: string; route: DashboardRoute; stages: FunnelStage[]; people: TeamPerson[] }

export const positiveOutliers: PositiveOutlier[] = [
  { id: "p-sram-hosur", domain: "Śram Park", theatre: "Wellington (Karnataka)", where: "Hosur 01", label: "Named demand matched inside radius and SLA", owner: "Nisha Patel · RM", forwardCmUpside24h: 150000, confidence: "High", status: "Verified", nextAction: "Hold 150 matched Nests for Hosur demand through activation on 16 Jul.", sourceUpdatedAt: "13:05 IST", laneTarget: { screen: "Living", subsection: "supply" }, evidence: ["1.4km from factory", "Matched in 9h", "150 of 150 Nests confirmed"] },
  { id: "p-ess-recharge", domain: "Essentials", theatre: "Coromandel (Tamil Nadu)", where: "Sriperumbudur 02", label: "Recharge repeat and fill both ahead of plan", owner: "Essentials Demand · Marketing", forwardCmUpside24h: 88000, confidence: "High", status: "Sustaining", nextAction: "Keep recharge availability at 100% and extend the winning message to two similar Studios.", sourceUpdatedAt: "13:52 IST", laneTarget: { screen: "Essentials" }, evidence: ["100% fill", "D30 repeat 48%", "Attach 18%"] },
  { id: "p-fono-gurgaon", domain: "FONO", theatre: "Rajputana (NCR)", where: "Gurgaon 05", label: "Occupancy conversion above Theatre plan", owner: "Karthik Rao · Theatre ops", forwardCmUpside24h: 64000, confidence: "Medium", status: "Verified", nextAction: "Protect activation pace and document the enterprise hand-off used at Gurgaon 05.", sourceUpdatedAt: "13:44 IST", laneTarget: { screen: "Living", subsection: "fono" }, evidence: ["612 of 640 Nests occupied", "96% occupancy", "14-day activation pace ahead of plan"] },
]

export const fonoSupply = [
  { stage: "Studios visited", studios: 68, nests: 5800, conversion: null, owner: "Sandeep Jain" },
  { stage: "Agreed", studios: 31, nests: 2740, conversion: 46, owner: "Sandeep Jain" },
  { stage: "Contracted", studios: 18, nests: 1620, conversion: 58, owner: "Priya Menon" },
  { stage: "KYC", studios: 11, nests: 1020, conversion: 61, owner: "Priya Menon" },
  { stage: "Live", studios: 7, nests: 920, conversion: 64, owner: "Anand Shah" },
]

export const fonoOccupancy = [
  ["Gurgaon 05", "Rajputana (NCR)", "640", "612", "96%", "14", "Karthik Rao"],
  ["Chakan 04", "Deccan (Pune)", "128", "0", "0%", "5", "Vikram Singh"],
  ["Hosur 01", "Wellington (Karnataka)", "96", "82", "85%", "3", "Aditi Rao"],
  ["Sriperumbudur 02", "Coromandel (Tamil Nadu)", "56", "48", "86%", "2", "Meera Nair"],
]

export const shramDemand = [
  ["Hosur Components", "150", "Wellington (Karnataka)", "16 Jul", "Aditi Rao", "13 Jul · 09:00", "Matched"],
  ["Chakan Auto", "128", "Deccan (Pune)", "18 Jul", "Vikram Singh", "12 Jul · 15:00", "2 days unmatched"],
  ["SIP Industrial", "282", "Coromandel (Tamil Nadu)", "17 Jul", "Meera Nair", "12 Jul · 11:00", "2 days unmatched"],
  ["Manesar Assembly", "300", "Rajputana (NCR)", "15 Jul", "Kabir Sethi", "11 Jul · 10:00", "Matched"],
]

export const shramSupply = [
  ["Hosur Components", "Aditi Rao", "Nisha Patel", "Hosur 01", "1.4 km", "9h", "Pass"],
  ["Chakan Auto", "Vikram Singh", "Arjun Dev", "Chakan 04", "2.6 km", "19h", "Fail · radius"],
  ["SIP Industrial", "Meera Nair", "Leena Das", "Sriperumbudur 02", "1.8 km", "27h", "Fail · SLA"],
]

export type SupplyOption = { id: string; name: string; distanceKm: number; angle: number }
export type DemandProximityNode = { id: string; demandName: string; shortName: string; location: string; members: number; activation: string; activationOrder: number; unmatchedDays: number; owner: string; status: string; options: SupplyOption[] }

function fanAngles(count: number) {
  return Array.from({ length: count }, (_, index) => Math.round((360 / count) * index + 18))
}

export const demandProximityNodes: DemandProximityNode[] = [
  { id: "hosur-components", demandName: "Hosur Components", shortName: "Hosur", location: "Hosur", members: 150, activation: "16 Jul", activationOrder: 16, unmatchedDays: 0, owner: "Aditi Rao", status: "Matched", options: [{ id: "hosur-01", name: "Hosur 01", distanceKm: 1.4, angle: 35 }] },
  { id: "manesar-assembly", demandName: "Manesar Assembly", shortName: "Manesar", location: "Manesar", members: 300, activation: "15 Jul", activationOrder: 15, unmatchedDays: 0, owner: "Kabir Sethi", status: "Matched", options: [{ id: "manesar-03", name: "Manesar 03", distanceKm: 1.6, angle: 55 }] },
  { id: "chakan-auto", demandName: "Chakan Auto", shortName: "Chakan", location: "Pune", members: 128, activation: "18 Jul", activationOrder: 18, unmatchedDays: 4, owner: "Vikram Singh", status: "Open", options: [
    { id: "chakan-04", name: "Chakan 04", distanceKm: 2.6, angle: 25 },
    { id: "talegaon-nest", name: "Talegaon Nest", distanceKm: 3.2, angle: 132 },
    { id: "akurdi-house", name: "Akurdi House", distanceKm: 4.4, angle: 235 },
    { id: "bhosari-living", name: "Bhosari Living", distanceKm: 4.8, angle: 315 },
  ] },
  { id: "sip-industrial", demandName: "SIP Industrial", shortName: "Sriperumbudur", location: "Chennai", members: 282, activation: "17 Jul", activationOrder: 17, unmatchedDays: 2, owner: "Meera Nair", status: "Open", options: [
    { id: "sriperumbudur-02", name: "Sriperumbudur 02", distanceKm: 1.8, angle: 18 },
    { id: "oragadam-nest", name: "Oragadam Nest", distanceKm: 2.5, angle: 112 },
    { id: "mambakkam-house", name: "Mambakkam House", distanceKm: 3.7, angle: 205 },
    { id: "irungattukottai", name: "Irungattukottai", distanceKm: 4.6, angle: 298 },
  ] },
  ...generatedNodes(),
]

function generatedNodes(): DemandProximityNode[] {
  const specs: Array<{ name: string; short: string; location: string; members: number; day: number; unmatched: number; owner: string; nearest: number; count: number; base: string }> = [
    { name: "Oragadam Press", short: "Oragadam", location: "Chennai", members: 214, day: 19, unmatched: 5, owner: "Rohan Iyer", nearest: 3.1, count: 3, base: "Oragadam" },
    { name: "Bawal Motors", short: "Bawal", location: "Rewari", members: 176, day: 20, unmatched: 6, owner: "Sana Kapoor", nearest: 3.4, count: 4, base: "Bawal" },
    { name: "Sanand Works", short: "Sanand", location: "Ahmedabad", members: 240, day: 18, unmatched: 3, owner: "Devika Menon", nearest: 1.9, count: 4, base: "Sanand" },
    { name: "Sriperumbudur East", short: "SIP East", location: "Chennai", members: 198, day: 21, unmatched: 4, owner: "Meera Nair", nearest: 2.2, count: 3, base: "SIP East" },
    { name: "Pantnagar Line", short: "Pantnagar", location: "Rudrapur", members: 132, day: 22, unmatched: 7, owner: "Arjun Dev", nearest: 3.8, count: 4, base: "Pantnagar" },
    { name: "Hosur Coil", short: "Hosur Coil", location: "Hosur", members: 160, day: 19, unmatched: 2, owner: "Aditi Rao", nearest: 1.6, count: 3, base: "Hosur Coil" },
    { name: "Chakan Forge", short: "Chakan Forge", location: "Pune", members: 205, day: 23, unmatched: 8, owner: "Vikram Singh", nearest: 4.1, count: 4, base: "Chakan Forge" },
    { name: "Manesar South", short: "Manesar S", location: "Manesar", members: 270, day: 20, unmatched: 5, owner: "Kabir Sethi", nearest: 2.7, count: 3, base: "Manesar S" },
    { name: "Sricity Assembly", short: "Sricity", location: "Chittoor", members: 315, day: 24, unmatched: 9, owner: "Leena Das", nearest: 4.5, count: 4, base: "Sricity" },
    { name: "Halol Stamping", short: "Halol", location: "Vadodara", members: 148, day: 18, unmatched: 1, owner: "Devika Menon", nearest: 1.4, count: 3, base: "Halol" },
    { name: "Tada Components", short: "Tada", location: "Nellore", members: 189, day: 21, unmatched: 4, owner: "Rohan Iyer", nearest: 2.9, count: 4, base: "Tada" },
    { name: "Bidadi Motors", short: "Bidadi", location: "Bengaluru", members: 256, day: 22, unmatched: 6, owner: "Nisha Patel", nearest: 3.3, count: 3, base: "Bidadi" },
    { name: "Neemrana Line", short: "Neemrana", location: "Alwar", members: 178, day: 25, unmatched: 3, owner: "Sana Kapoor", nearest: 1.7, count: 4, base: "Neemrana" },
    { name: "Pithampur Works", short: "Pithampur", location: "Indore", members: 143, day: 23, unmatched: 7, owner: "Arjun Dev", nearest: 4.2, count: 3, base: "Pithampur" },
    { name: "Ranjangaon Auto", short: "Ranjangaon", location: "Pune", members: 221, day: 24, unmatched: 5, owner: "Vikram Singh", nearest: 2.4, count: 4, base: "Ranjangaon" },
    { name: "Jamshedpur Press", short: "Jamshedpur", location: "Jamshedpur", members: 167, day: 26, unmatched: 2, owner: "Kabir Sethi", nearest: 1.5, count: 3, base: "Jamshedpur" },
  ]
  return specs.map((spec, specIndex) => {
    const angles = fanAngles(spec.count)
    const options: SupplyOption[] = Array.from({ length: spec.count }, (_, index) => {
      const distanceKm = index === 0 ? spec.nearest : Math.min(4.9, spec.nearest + index * 0.9)
      return { id: `${spec.base.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`, name: `${spec.base} 0${index + 1}`, distanceKm: Math.round(distanceKm * 10) / 10, angle: angles[index] }
    })
    return { id: `gen-${specIndex}-${spec.short.toLowerCase().replace(/\s+/g, "-")}`, demandName: spec.name, shortName: spec.short, location: spec.location, members: spec.members, activation: `${spec.day} Jul`, activationOrder: spec.day, unmatchedDays: spec.unmatched, owner: spec.owner, status: "Open", options }
  })
}

export function nearestDistanceKm(node: DemandProximityNode) {
  return node.options.reduce((min, option) => Math.min(min, option.distanceKm), Infinity)
}

export function sortDemandNodes(nodes: DemandProximityNode[], mode: "priority" | "activation" | "members") {
  const list = [...nodes]
  if (mode === "activation") return list.sort((a, b) => a.activationOrder - b.activationOrder || b.members - a.members)
  if (mode === "members") return list.sort((a, b) => b.members - a.members || a.activationOrder - b.activationOrder)
  return list.sort((a, b) => {
    const aNoNear = nearestDistanceKm(a) > 2 ? 0 : 1
    const bNoNear = nearestDistanceKm(b) > 2 ? 0 : 1
    if (aNoNear !== bNoNear) return aNoNear - bNoNear
    if (b.unmatchedDays !== a.unmatchedDays) return b.unmatchedDays - a.unmatchedDays
    return a.activationOrder - b.activationOrder
  })
}

export const essentialsHeadline = [
  ["Eligible Members", "3,760", "Essentials Demand · Marketing"], ["Attach rate", "41%", "1,542 of 3,760 · Marketing"], ["GMV", "₹26.3L", "Essentials Demand · Marketing"], ["ARPU", "₹699", "vs ₹700 · Amrita Prasad"], ["CM%", "18.6%", "vs 20% · Amrita Prasad"], ["Member savings", "11.4%", "vs 10% · Merchandising"], ["Working capital", "₹6.8L", "Owned inventory · Finance"],
]

export const essentialsCohorts = [
  ["Apr 2026", "720", "351", "49%", "₹6.4L", "₹182", "2.4", "44%", "36%", "29%", "8%", "4.1"],
  ["May 2026", "860", "379", "44%", "₹6.8L", "₹179", "2.1", "39%", "31%", "No data", "11%", "3.6"],
  ["Jun 2026", "1,020", "401", "39%", "₹7.1L", "₹177", "1.8", "32%", "No data", "No data", "14%", "3.0"],
  ["Jul 2026", "1,160", "411", "35%", "₹6.0L", "₹146", "1.3", "No data", "No data", "No data", "7%", "2.4"],
]

export const essentialsInventory = [
  ["Shampoo sachet", "Hosur 01", "Consigned", "₹10", "₹9", "10%", "81%", "6h", "0.8", "No", "EAE · Rohan Iyer"],
  ["Mobile recharge", "Sriperumbudur 02", "Demand-pooled", "₹100", "₹88", "12%", "100%", "0h", "∞", "No", "EAE · Lakshmi S"],
  ["Work footwear", "Chakan 04", "Made-to-order", "₹900", "₹790", "12.2%", "92%", "0h", "5.0", "Yes", "EAE · Neha Kulkarni"],
  ["Detergent bar", "Gurgaon 05", "Owned", "₹35", "₹32", "8.6%", "96%", "0h", "2.4", "No", "EAE · Arif Khan"],
]

export const teamBlocks: TeamBlock[] = [
  { name: "Śram Park Demand", owner: "JCO team", route: { screen: "Living", subsection: "demand" }, stages: [{ label: "Security heads spoken", today: 18, mtd: 164, todayConversion: 56, mtdConversion: 49, delta: "+4 vs MTD daily average", signal: "positive", reason: "Today conversion is above the previous daily high.", diagnosticContext: mismatchContextById("m-sram-resolved-hosur") }, { label: "Needs captured", today: 10, mtd: 81, todayConversion: 40, mtdConversion: 52, delta: "−1 vs MTD daily average" }, { label: "Contracted", today: 4, mtd: 42, todayConversion: null, mtdConversion: null, delta: "+1 vs MTD daily average" }], people: [{ name: "Aditi Rao", conversion: 31, lastUpdated: "18 min ago" }, { name: "Meera Nair", conversion: 24, lastUpdated: "52 min ago" }, { name: "Vikram Singh", conversion: 9, lastUpdated: "5h ago" }] },
  { name: "FONO Demand", owner: "Theatre ops team", route: { screen: "Living", subsection: "fono" }, stages: [{ label: "Named requirements", today: 12, mtd: 106, todayConversion: 67, mtdConversion: 62, delta: "+2 vs MTD daily average" }, { label: "Members activated", today: 8, mtd: 66, todayConversion: null, mtdConversion: null, delta: "+1 vs MTD daily average", reason: "Chakan 04 has live Nests but no named Member demand.", diagnosticContext: mismatchContextById("m-fono-idle-chakan") }], people: [{ name: "Karthik Rao", conversion: 78, lastUpdated: "12 min ago" }, { name: "Aditi Rao", conversion: 64, lastUpdated: "34 min ago" }, { name: "Vikram Singh", conversion: 0, lastUpdated: "6h ago" }] },
  { name: "Essentials Demand", owner: "Marketing team", route: { screen: "Essentials" }, stages: [{ label: "Eligible reached", today: 820, mtd: 8200, todayConversion: 45, mtdConversion: 41, delta: "+34 vs MTD daily average", signal: "positive", reason: "Today's conversion is above the MTD average. The CM it can add in 24 hours is verified.", diagnosticContext: mismatchContextById("m-ess-resolved-recharge-sriperumbudur") }, { label: "Purchasers", today: 369, mtd: 3362, todayConversion: 38, mtdConversion: 35, delta: "+21 vs MTD daily average" }, { label: "Repeat purchasers", today: 140, mtd: 1177, todayConversion: null, mtdConversion: null, delta: "+9 vs MTD daily average" }], people: [{ name: "Naina Joseph", conversion: 46, lastUpdated: "automatic feed · 2 min ago" }, { name: "Rahul Bose", conversion: 41, lastUpdated: "automatic feed · 2 min ago" }, { name: "Shreya Shah", conversion: 34, lastUpdated: "automatic feed · 2 min ago" }] },
  { name: "Śram Park Supply", owner: "RM team", route: { screen: "Living", subsection: "supply" }, stages: [{ label: "Broker leads", today: 14, mtd: 132, todayConversion: 43, mtdConversion: 48, delta: "−1 vs MTD daily average" }, { label: "Viable inside 2km", today: 6, mtd: 63, todayConversion: 0, mtdConversion: 57, delta: "−4 vs MTD daily average", signal: "issue", reason: "New viable options entered today with zero exits; backlog is forming.", diagnosticContext: mismatchContextById("m-sram-shortfall-sriperumbudur") }, { label: "Contracted", today: 0, mtd: 36, todayConversion: null, mtdConversion: null, delta: "−3 vs MTD daily average" }], people: [{ name: "Nisha Patel", conversion: 39, lastUpdated: "20 min ago" }, { name: "Leena Das", conversion: 24, lastUpdated: "1h ago" }, { name: "Arjun Dev", conversion: 8, lastUpdated: "7h ago" }] },
  { name: "FONO Supply", owner: "Franchise Acquisition team", route: { screen: "Living", subsection: "fono" }, stages: [{ label: "Studios visited", today: 5, mtd: 68, todayConversion: 60, mtdConversion: 46, delta: "+1 vs MTD daily average" }, { label: "Agreed", today: 3, mtd: 31, todayConversion: 67, mtdConversion: 58, delta: "+1 vs MTD daily average" }, { label: "Contracted", today: 2, mtd: 18, todayConversion: 50, mtdConversion: 61, delta: "At MTD daily average" }, { label: "Live", today: 1, mtd: 7, todayConversion: null, mtdConversion: null, delta: "At MTD daily average" }], people: [{ name: "Sandeep Jain", conversion: 18, lastUpdated: "25 min ago" }, { name: "Priya Menon", conversion: 12, lastUpdated: "48 min ago" }, { name: "Anand Shah", conversion: 7, lastUpdated: "4h ago" }] },
  { name: "Essentials Supply", owner: "EAE / merchandiser team", route: { screen: "Essentials" }, stages: [{ label: "Purchase orders", today: 24, mtd: 226, todayConversion: 79, mtdConversion: 82, delta: "−1 vs MTD daily average" }, { label: "Inbound GRN", today: 19, mtd: 185, todayConversion: 84, mtdConversion: 88, delta: "−1 vs MTD daily average" }, { label: "Studio filled", today: 16, mtd: 163, todayConversion: null, mtdConversion: null, delta: "−1 vs MTD daily average", reason: "Hosur 01 fill remains below safety stock for a high-repeat SKU.", diagnosticContext: mismatchContextById("m-ess-stockout-hosur") }], people: [{ name: "Lakshmi S", conversion: 78, lastUpdated: "11 min ago" }, { name: "Rohan Iyer", conversion: 71, lastUpdated: "55 min ago" }, { name: "Neha Kulkarni", conversion: 58, lastUpdated: "5h ago" }] },
]

/*
 * STEP 8 : PLANNED, OUT OF SCOPE FOR THIS PASS
 * - WhatsApp pull-based field reporting → Google Sheet → hourly sync
 * - WhatsApp Essentials order ingestion → near-real-time order events
 * - WhatsApp escalation push messages back to staff
 */
