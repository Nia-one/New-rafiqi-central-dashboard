/**
 * Normalised, server-only read model for the Self Drive workspaces.
 *
 * It deliberately retains the original Sheet row alongside each calculated
 * value, so every visible value can be traced back to an Operations entry.
 */
type SheetRow = Record<string, unknown>
import type { MarginStudioInput } from "@/lib/operating-loop/nia-margins-loop"

const text = (row: SheetRow, key: string) => String(row[key] ?? "").trim()
const number = (row: SheetRow, key: string) => {
  const parsed = Number(String(row[key] ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export type LiveSelfDriveSnapshot = Readonly<{
  asOf: string
  enterpriseDemand: readonly SheetRow[]
  activations: readonly SheetRow[]
  incidents: readonly SheetRow[]
  actions: readonly SheetRow[]
  evidence: readonly SheetRow[]
  approvals: readonly SheetRow[]
  living: readonly SheetRow[]
  work: readonly SheetRow[]
  essentials: readonly SheetRow[]
  finance: readonly SheetRow[]
  summary: Readonly<{
    openDemand: number
    remainingHeadcount: number
    verifiedActivations: number
    openIncidents: number
    openActions: number
    readyNests: number
    occupiedNests: number
    cm2Inr: number
  }>
}>

export function buildLiveSelfDriveSnapshot(ops: any): LiveSelfDriveSnapshot {
  const rows = (name: string): SheetRow[] => Array.isArray(ops?.[name]) ? ops[name] : []
  const enterpriseDemand = rows("enterpriseDemand")
  const activations = rows("memberActivation")
  const incidents = rows("incidentLog")
  const actions = rows("actionLog")
  const evidence = rows("evidenceLog")
  const approvals = rows("approvalLog")
  const living = rows("living")
  const work = rows("work")
  const essentials = rows("essentials")
  const finance = rows("finance")

  return {
    asOf: ops?.meta?.updatedAt || new Date().toISOString(),
    enterpriseDemand, activations, incidents, actions, evidence, approvals, living, work, essentials, finance,
    summary: {
      openDemand: enterpriseDemand.filter((row) => text(row, "status").toLowerCase() !== "closed").length,
      remainingHeadcount: enterpriseDemand.reduce((sum, row) => sum + number(row, "headcount remaining"), 0),
      verifiedActivations: activations.filter((row) => text(row, "verification status").toLowerCase() === "verified").length,
      openIncidents: incidents.filter((row) => !["closed", "resolved"].includes(text(row, "state").toLowerCase())).length,
      openActions: actions.filter((row) => !["closed", "verified"].includes(text(row, "state").toLowerCase())).length,
      readyNests: living.reduce((sum, row) => sum + number(row, "activation ready nests"), 0),
      occupiedNests: living.reduce((sum, row) => sum + number(row, "occupied nests"), 0),
      cm2Inr: finance.reduce((sum, row) => sum + number(row, "cm2 inr"), 0),
    },
  }
}

export function buildLiveMarginInputs(snapshot: LiveSelfDriveSnapshot): readonly MarginStudioInput[] {
  return snapshot.living.map((row) => {
    const finance = snapshot.finance.find((entry) => text(entry, "theatre id") === text(row, "theatre id")) || {}
    const occupied = number(row, "occupied nests")
    const billedLiving = number(row, "living billed inr")
    const workBilled = number(snapshot.work.find((entry) => text(entry, "theatre id") === text(row, "theatre id")) || {}, "work billed inr")
    const essentialsBilled = number(snapshot.essentials.find((entry) => text(entry, "studio id") === text(row, "studio id")) || {}, "essentials billed inr")
    return {
      studioId: text(row, "studio id"), studioName: text(row, "studio id"), theatreId: text(row, "theatre id"),
      supplyModel: text(row, "supply model") === "SP" ? "SP" : "FONO",
      contractedNests: number(row, "contracted nests"), occupiedNests: occupied, rampDay: 30,
      billedLivingArpuInr: occupied ? billedLiving / occupied : 0,
      livingPartnerCostInr: 0, livingUtilitiesInr: 0,
      billedWorkArpuInr: occupied ? workBilled / occupied : 0, workDirectDeliveryCostInr: 0,
      billedEssentialsArpuInr: occupied ? essentialsBilled / occupied : 0, essentialsDirectDeliveryCostInr: 0,
      studioGrossMarginPct: 0, previousVerifiedFullUseCm2Inr: number(finance, "cm2 inr"),
      ownerActorId: text(row, "next action owner actor id") || "Operations", sourceUpdatedAt: snapshot.asOf,
      sourceRowIdentity: text(row, "living hourly id") || text(row, "studio id"), synthetic: false,
    }
  })
}
