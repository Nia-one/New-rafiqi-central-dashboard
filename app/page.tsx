import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildLiveEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildNiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import { buildOpsData } from "@/lib/opsDataMapper"
import { buildLiveMarginInputs, buildLiveSelfDriveSnapshot } from "@/lib/live-mappers/self-drive"
import {
  buildLiveControlledAutonomyPreview,
  buildLiveMemberFeedbackModel,
  buildLiveMemberEngagementPreview,
  buildLiveMemberSavingsPreview,
  buildLiveNewAddsPreview,
  buildLiveNiaGrowthPreview,
} from "@/lib/live-mappers/final-ui-previews"
import { cookies } from "next/headers"
import { AUTH_COOKIE, loginConfigurationFromEnvironment, readSessionEmail, sessionSecretFromEnvironment } from "@/lib/auth"
import { financeAccessAllowed, roleAssignments } from "@/lib/access-control"

export const dynamic = "force-dynamic"

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function buildOpsDataWithRetry() {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await buildOpsData()
    } catch (error) {
      lastError = error
      if (attempt < 2) await wait(300 * 2 ** attempt)
    }
  }
  throw lastError
}

export default async function Page() {
  if (!selfDrivePlatformEnabled()) return <LegacyNiaDashboard />

  const { ControlTowerShell } = await import("@/components/control-tower-shell")
  const cookieStore = await cookies()
  const loginConfiguration = loginConfigurationFromEnvironment()
  const sessionEmail = await readSessionEmail(cookieStore.get(AUTH_COOKIE)?.value, sessionSecretFromEnvironment())
  const configuredEmail = loginConfiguration?.email
  const role = sessionEmail ? roleAssignments().get(sessionEmail) ?? (process.env.NODE_ENV !== "production" && sessionEmail === configuredEmail ? "administrator" : null) : null
  const hasFinanceRole = financeAccessAllowed(role)
  const financeAllowed = hasFinanceRole && financeExpansionControlEnabled()
  const liveOpsData = await buildOpsDataWithRetry()
  const liveSnapshot = buildLiveSelfDriveSnapshot(liveOpsData)
  // In the current operating model Enterprise Demand mirrors the canonical
  // Shram Park Bot lead ledger across the workspace, report and interlinks.
  // The offline UI_Enterprise_Demand rows remain available in the backend but
  // must not create a second, divergent Enterprise view.
  const enterpriseWorkspaceRows = liveSnapshot.enterpriseDemand.filter((row) => {
    const demandId = String(row["demand id"] ?? "").toUpperCase()
    return demandId.startsWith("SP-BOT-")
  })
  const enterpriseDemandPreview = buildLiveEnterpriseDemandLoopPreview(enterpriseWorkspaceRows, liveSnapshot.asOf)
  // Keep the complete governed demand ledger available to Living/Growth. The
  // Keep the complete governed demand ledger available to Living/Growth while
  // Enterprise receives only its operator-owned offline lane.
  const dashboardOpsData = { ...liveOpsData, enterpriseWorkspaceDemand: enterpriseWorkspaceRows }
  const newAddsPreview = buildLiveNewAddsPreview(liveSnapshot)
  const memberEngagementPreview = buildLiveMemberEngagementPreview(liveSnapshot)
  const memberSavingsPreview = buildLiveMemberSavingsPreview(liveSnapshot)
  const niaGrowthPreview = buildLiveNiaGrowthPreview(liveSnapshot)
  const marginInputs = buildLiveMarginInputs(liveSnapshot)
  if (!newAddsPreview || !memberSavingsPreview || !niaGrowthPreview || !marginInputs.length) {
    console.error("LIVE_PREVIEW_GAP", { enterpriseDemand: Boolean(enterpriseDemandPreview), newAdds: Boolean(newAddsPreview), memberEngagement: Boolean(memberEngagementPreview), memberSavings: Boolean(memberSavingsPreview), niaGrowth: Boolean(niaGrowthPreview), marginInputs: marginInputs.length })
    throw new Error("Required governed live data is unavailable; synthetic dashboard values are disabled.")
  }
  const calculatedMargins = buildNiaMarginsPreview(marginInputs, liveSnapshot.asOf, [])
  const marginTargetPolicy = liveSnapshot.policies.find((row) => {
    const descriptor = `${String(row["policy id"] ?? "")} ${String(row["policy name"] ?? "")} ${String(row["source note"] ?? "")}`.toLowerCase()
    return /margin|cm2/.test(descriptor) && /full.?use|target|control/.test(descriptor) && String(row.status ?? "").toLowerCase() === "approved"
  })
  const recordedMarginTarget = Number(String(marginTargetPolicy?.["policy value"] ?? "").replace(/[^0-9.-]/g, "")) || 0
  const recordedOccupancyPolicy = liveSnapshot.policies.find((row) => {
    const descriptor = `${String(row["policy id"] ?? "")} ${String(row["policy name"] ?? "")} ${String(row["source note"] ?? "")}`.toLowerCase()
    return /occupancy/.test(descriptor) && /target|control|floor/.test(descriptor) && String(row.status ?? "").toLowerCase() === "approved"
  })
  const recordedOccupancyTarget = Number(String(recordedOccupancyPolicy?.["policy value"] ?? "").replace(/[^0-9.-]/g, "")) || 0
  const marginActions = liveSnapshot.actions.filter((row) => /margin|cm2/.test(`${String(row["operating objective"] ?? "")} ${String(row["expected metric"] ?? "")}`.toLowerCase()) && String(row["source submission id"] ?? "").trim())
  const marginActionIds = new Set(marginActions.map((row) => String(row["action id"] ?? "")).filter(Boolean))
  const marginEvidence = liveSnapshot.evidence.filter((row) => marginActionIds.has(String(row["linked id"] ?? "")))
  const verifiedMarginEvidence = marginEvidence.filter((row) => /verified|approved|accepted/.test(String(row["verification status"] ?? "").toLowerCase())).length
  const marginLoopHealth = buildLoopHealth({ asOf: liveSnapshot.asOf, feeds: [], clocks: [], verification: { claimed: marginEvidence.length, verified: verifiedMarginEvidence, awaiting: Math.max(0, marginEvidence.length - verifiedMarginEvidence), reopened: 0, oldestAwaitingAt: null } })
  const niaMarginsPreview = {
    ...calculatedMargins,
    answer: recordedMarginTarget > 0
      ? `Full-use CM2 is ₹${calculatedMargins.measures.fullUseCm2Inr}; approved sheet control is ₹${recordedMarginTarget}.`
      : `Full-use CM2 is ₹${calculatedMargins.measures.fullUseCm2Inr}; approved sheet control is not recorded.`,
    measures: { ...calculatedMargins.measures, fullUseTargetInr: recordedMarginTarget, occupancyTargetPct: recordedOccupancyTarget, negativeContributionStudios: marginInputs.filter((row) => row.previousVerifiedFullUseCm2Inr < 0).length },
    diagnoses: [],
    actions: [],
    despatchEscalations: [],
    loopHealth: marginLoopHealth,
    liveTargetRecorded: recordedMarginTarget > 0,
  } as unknown as typeof calculatedMargins & { liveTargetRecorded: boolean }
  const controlledAutonomyPreview = buildLiveControlledAutonomyPreview(liveSnapshot)
  const memberFeedbackModel = buildLiveMemberFeedbackModel(liveSnapshot)
  return <ControlTowerShell liveOpsData={dashboardOpsData} memberFeedbackItems={memberFeedbackModel.items} memberNpsResponses={memberFeedbackModel.responses} enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={null} controlledAutonomyPreview={controlledAutonomyPreview} niaMarginsPreview={niaMarginsPreview} newAddsPreview={newAddsPreview} memberEngagementPreview={memberEngagementPreview} memberSavingsPreview={memberSavingsPreview} niaGrowthPreview={niaGrowthPreview} cashControlPreview={null} financeAllowed={false} />
}
