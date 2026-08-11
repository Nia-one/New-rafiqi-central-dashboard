import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildLiveEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildNiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import { selectApprovedMarginTarget } from "@/lib/live-mappers/margin-target"
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
import { getLatestFreshEnterpriseDemandRows } from "@/lib/freshDashboardInputSync"
import { unstable_cache } from "next/cache"

export const dynamic = "force-dynamic"

// Share the last successful governed snapshot across serverless invocations.
// The Sheets client already retries transient failures; retrying the complete
// 38-range dashboard read here multiplied quota usage and could turn a 429 into
// a full-page outage on a freshly deployed instance.
const buildCachedOpsData = unstable_cache(
  () => buildOpsData(),
  ["governed-dashboard-ops-data-v2"],
  { revalidate: 60, tags: ["governed-ops-data"] },
)

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
  const liveOpsData = await buildCachedOpsData()
  const liveSnapshot = buildLiveSelfDriveSnapshot(liveOpsData)
  // Enterprise Demand is governed by the explicit UI_Enterprise_Demand input
  // lane. Retain SP-BOT only as a backwards-compatible fallback while an older
  // payload refreshes, so the workspace and Business Report never diverge.
  const freshlySyncedEnterpriseRows = getLatestFreshEnterpriseDemandRows()
  const lineageEnterpriseRows = liveSnapshot.enterpriseDemand.filter((row) => {
    const demandId = String(row["demand id"] ?? "").toUpperCase()
    const sourceId = String(row["source submission id"] ?? "").toUpperCase()
    return demandId.startsWith("UI-ENTERPRISE-DEMAND-") || sourceId.startsWith("UI-ENTERPRISE-DEMAND-")
  })
  const compatibilityEnterpriseRows = liveSnapshot.enterpriseDemand.filter((row) => {
    const role = String(row["role required"] ?? "").trim().toLowerCase()
    const stage = String(row.certainty ?? row.status ?? "").trim().toLowerCase()
    return role !== "member adds" && /lead|interest|proposal|propsal|propsaal|contract|drop/.test(stage)
  })
  const uiEnterpriseDemandRows = freshlySyncedEnterpriseRows.length ? [...freshlySyncedEnterpriseRows] : lineageEnterpriseRows.length ? lineageEnterpriseRows : compatibilityEnterpriseRows
  const enterpriseWorkspaceRows = uiEnterpriseDemandRows.length ? uiEnterpriseDemandRows : liveSnapshot.enterpriseDemand.filter((row) => {
    const demandId = String(row["demand id"] ?? "").toUpperCase()
    return demandId.startsWith("SP-BOT-")
  })
  const enterpriseDemandPreview = buildLiveEnterpriseDemandLoopPreview(enterpriseWorkspaceRows, liveSnapshot.asOf)
  // Keep the complete governed demand ledger available to Living/Growth while
  // Enterprise receives its explicit operator-owned UI lane.
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
  const marginTargetPolicy = selectApprovedMarginTarget(liveSnapshot.policies)
  const recordedMarginTarget = Number(String(marginTargetPolicy?.["policy value"] ?? "").replace(/[^0-9.-]/g, "")) || 0
  const recordedOccupancyPolicy = liveSnapshot.policies.find((row) => {
    const descriptor = `${String(row["policy id"] ?? "")} ${String(row["policy name"] ?? "")} ${String(row["source note"] ?? "")}`.toLowerCase()
    return /occupancy/.test(descriptor) && /target|control|floor/.test(descriptor) && String(row.status ?? "").toLowerCase() === "approved"
  })
  const recordedOccupancyTarget = Number(String(recordedOccupancyPolicy?.["policy value"] ?? "").replace(/[^0-9.-]/g, "")) || 0
  const pillarTarget = (pillar: string) => {
    const policy = liveSnapshot.policies.find((row) => {
      const descriptor = `${String(row["policy id"] ?? "")} ${String(row["policy name"] ?? "")} ${String(row["source note"] ?? "")}`.toLowerCase()
      return descriptor.includes(pillar) && /margin|cm2/.test(descriptor) && String(row.status ?? "").toLowerCase() === "approved"
    })
    return Number(String(policy?.["policy value"] ?? "").replace(/[^0-9.-]/g, "")) || 0
  }
  const marginTargets = { living: pillarTarget("living"), work: pillarTarget("work"), essentials: pillarTarget("essential"), fullUse: recordedMarginTarget, occupancyPct: recordedOccupancyTarget }
  const calculatedMargins = buildNiaMarginsPreview(marginInputs, liveSnapshot.asOf, [], marginTargets)
  const marginActions = liveSnapshot.actions.filter((row) => /margin|cm2/.test(`${String(row["operating objective"] ?? "")} ${String(row["expected metric"] ?? "")}`.toLowerCase()) && String(row["source submission id"] ?? "").trim())
  const marginActionIds = new Set(marginActions.map((row) => String(row["action id"] ?? "")).filter(Boolean))
  const marginEvidence = liveSnapshot.evidence.filter((row) => marginActionIds.has(String(row["linked id"] ?? "")))
  const verifiedMarginEvidence = marginEvidence.filter((row) => /verified|approved|accepted/.test(String(row["verification status"] ?? "").toLowerCase())).length
  const marginLoopHealth = buildLoopHealth({ asOf: liveSnapshot.asOf, feeds: [], clocks: [], verification: { claimed: marginEvidence.length, verified: verifiedMarginEvidence, awaiting: Math.max(0, marginEvidence.length - verifiedMarginEvidence), reopened: 0, oldestAwaitingAt: null } })
  const niaMarginsPreview = {
    ...calculatedMargins,
    measures: { ...calculatedMargins.measures, negativeContributionStudios: calculatedMargins.diagnoses.filter((row) => row.fullUseUnitCm2Inr < 0).length },
    loopHealth: marginLoopHealth,
    liveTargetRecorded: recordedMarginTarget > 0,
  } as unknown as typeof calculatedMargins & { liveTargetRecorded: boolean }
  const controlledAutonomyPreview = buildLiveControlledAutonomyPreview(liveSnapshot)
  const memberFeedbackModel = buildLiveMemberFeedbackModel(liveSnapshot)
  return <ControlTowerShell liveOpsData={dashboardOpsData} memberFeedbackItems={memberFeedbackModel.items} memberNpsResponses={memberFeedbackModel.responses} enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={null} controlledAutonomyPreview={controlledAutonomyPreview} niaMarginsPreview={niaMarginsPreview} newAddsPreview={newAddsPreview} memberEngagementPreview={memberEngagementPreview} memberSavingsPreview={memberSavingsPreview} niaGrowthPreview={niaGrowthPreview} cashControlPreview={null} financeAllowed={false} />
}
