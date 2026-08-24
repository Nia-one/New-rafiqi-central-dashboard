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
import { loadEnterpriseDemandSupplyMatches } from "@/lib/enterprise-demand-supply-match"
import { unstable_cache } from "next/cache"

export const dynamic = "force-dynamic"

// The governed payload is larger than Next's 2 MB Data Cache item limit.
// Cache it in-process instead, deduplicate concurrent renders, and retain the
// last successful value when Google briefly throttles a refresh. Every warm
// instance refreshes within 45 seconds; cold instances fetch immediately.
let lastOpsData: Awaited<ReturnType<typeof buildOpsData>> | undefined
let lastOpsDataAt = 0
let activeOpsDataBuild: Promise<Awaited<ReturnType<typeof buildOpsData>>> | undefined
// Do not put this payload in Next's persistent Data Cache: the complete
// governed ledger is already larger than the framework's 2 MB item limit.
// buildCachedOpsData below provides the intended in-process TTL, concurrency
// deduplication, and last-successful-value fallback without serializing it.
const buildSharedOpsData = () => buildOpsData()
const loadSharedEnterpriseMatches = unstable_cache(
  () => loadEnterpriseDemandSupplyMatches(),
  ["enterprise-demand-supply-matches-v14-durable-live-requirements"],
  { revalidate: 300 },
)
async function buildCachedOpsData() {
  if (lastOpsData && Date.now() - lastOpsDataAt < 45_000) return lastOpsData
  if (activeOpsDataBuild) return activeOpsDataBuild
  activeOpsDataBuild = buildSharedOpsData()
    .then((data) => {
      lastOpsData = data
      lastOpsDataAt = Date.now()
      return data
    })
    .catch((error) => {
      if (lastOpsData) {
        console.warn("Governed refresh failed; serving the last successful in-process snapshot.", error)
        return lastOpsData
      }
      throw error
    })
    .finally(() => { activeOpsDataBuild = undefined })
  return activeOpsDataBuild
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
  const liveOpsData = await buildCachedOpsData()
  let enterpriseDemandSupplyMatches: Awaited<ReturnType<typeof loadEnterpriseDemandSupplyMatches>> = []
  try {
    enterpriseDemandSupplyMatches = await loadSharedEnterpriseMatches()
  } catch (error) {
    console.warn("Enterprise demand/supply matching source unavailable; showing the governed dashboard without match rows.", error)
  }
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
    return role !== "member adds" && /compaign|campaign|lead|interest|proposal|propsal|propsaal|contract|drop/.test(stage)
  })
  const uiEnterpriseDemandRows = freshlySyncedEnterpriseRows.length ? [...freshlySyncedEnterpriseRows] : lineageEnterpriseRows.length ? lineageEnterpriseRows : compatibilityEnterpriseRows
  const enterpriseWorkspaceRows = uiEnterpriseDemandRows.length ? uiEnterpriseDemandRows : liveSnapshot.enterpriseDemand.filter((row) => {
    const demandId = String(row["demand id"] ?? "").toUpperCase()
    return demandId.startsWith("SP-BOT-")
  })
  const enterpriseDemandPreview = buildLiveEnterpriseDemandLoopPreview(enterpriseWorkspaceRows, liveSnapshot.asOf)
  // Keep the complete governed demand ledger available to Living/Growth while
  // Enterprise receives its explicit operator-owned UI lane.
  const dashboardOpsData = { ...liveOpsData, enterpriseWorkspaceDemand: enterpriseWorkspaceRows, enterpriseDemandSupplyMatches }
  const newAddsPreview = buildLiveNewAddsPreview(liveSnapshot)
  const memberEngagementPreview = buildLiveMemberEngagementPreview(liveSnapshot)
  const memberSavingsPreview = buildLiveMemberSavingsPreview(liveSnapshot)
  const niaGrowthPreview = buildLiveNiaGrowthPreview(liveSnapshot)
  const marginInputs = buildLiveMarginInputs(liveSnapshot)
  // A live lane can legitimately be empty (or briefly unavailable while a
  // Sheet refresh is throttled). Render its governed no-data state instead of
  // taking down every workspace. The preview builders keep synthetic=false,
  // and an empty margin input produces an empty diagnostic rather than values
  // inferred from another lane.
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
