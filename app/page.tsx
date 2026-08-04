import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildLiveEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildNiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import { cookies } from "next/headers"
import { AUTH_COOKIE, loginConfigurationFromEnvironment, readSessionEmail, sessionSecretFromEnvironment } from "@/lib/auth"
import { financeAccessAllowed, roleAssignments } from "@/lib/access-control"
import { buildOpsData } from "@/lib/opsDataMapper"
import { buildAllocationData } from "@/lib/allocation-data-live"
import { buildLiveDespatchEscalations } from "@/lib/live-mappers/despatch"
import { buildLiveHeartbeatSnapshot } from "@/lib/live-mappers/heartbeat"
import {
  buildLiveMarginInputs,
  buildLiveSelfDriveSnapshot,
} from "@/lib/live-mappers/self-drive"
import {
  buildLiveCashControlPreview,
  buildLiveControlledAutonomyPreview,
  buildLiveFinanceExpansionPreview,
  buildLiveMemberEngagementPreview,
  buildLiveMemberFeedbackModel,
  buildLiveMemberSavingsPreview,
  buildLiveNewAddsPreview,
  buildLiveNiaGrowthPreview,
} from "@/lib/live-mappers/final-ui-previews"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams?: Promise<{ period?: string }> } = {}) {
  if (!selfDrivePlatformEnabled()) return <LegacyNiaDashboard />

  const { NiaDashboard } = await import("@/components/nia-dashboard")
  const cookieStore = await cookies()
  const loginConfiguration = loginConfigurationFromEnvironment()
  const sessionEmail = await readSessionEmail(cookieStore.get(AUTH_COOKIE)?.value, sessionSecretFromEnvironment())
  const configuredEmail = loginConfiguration?.email
  const role = sessionEmail ? roleAssignments().get(sessionEmail) ?? (process.env.NODE_ENV !== "production" && sessionEmail === configuredEmail ? "administrator" : null) : null
  const hasFinanceRole = financeAccessAllowed(role)
  const financeAllowed = hasFinanceRole && financeExpansionControlEnabled()
  const requestedPeriod = (await searchParams)?.period ?? "latest"
  let liveOpsData: Awaited<ReturnType<typeof buildOpsData>> | null = null
  let allocationData: Awaited<ReturnType<typeof buildAllocationData>> | null = null
  try {
    ;[liveOpsData, allocationData] = await Promise.all([buildOpsData(requestedPeriod), buildAllocationData(requestedPeriod)])
  } catch (error) {
    console.warn("Live dashboard snapshot unavailable; rendering explicit no-data states.", error instanceof Error ? error.message : error)
  }
  const liveSelfDriveData = liveOpsData ? buildLiveSelfDriveSnapshot(liveOpsData) : null
  const enterpriseDemandPreview = liveSelfDriveData
    ? buildLiveEnterpriseDemandLoopPreview(liveSelfDriveData.enterpriseDemand, liveSelfDriveData.asOf)
    : null
  const liveMarginInputs = liveSelfDriveData ? buildLiveMarginInputs(liveSelfDriveData) : []
  const niaMarginsPreview = liveSelfDriveData && liveMarginInputs.length > 0
    ? buildNiaMarginsPreview(liveMarginInputs, liveSelfDriveData.asOf, [])
    : null
  const newAddsPreview = liveSelfDriveData ? buildLiveNewAddsPreview(liveSelfDriveData) : null
  const memberEngagementPreview = liveSelfDriveData ? buildLiveMemberEngagementPreview(liveSelfDriveData) : null
  const memberSavingsPreview = liveSelfDriveData ? buildLiveMemberSavingsPreview(liveSelfDriveData) : null
  const niaGrowthPreview = liveSelfDriveData ? buildLiveNiaGrowthPreview(liveSelfDriveData) : null
  const cashControlPreview = financeAllowed && liveSelfDriveData ? buildLiveCashControlPreview(liveSelfDriveData) : null
  const financeExpansionPreview = financeAllowed && liveSelfDriveData ? buildLiveFinanceExpansionPreview(liveSelfDriveData) : null
  const controlledAutonomyPreview = liveSelfDriveData ? buildLiveControlledAutonomyPreview(liveSelfDriveData) : null
  const memberFeedbackModel = liveSelfDriveData ? buildLiveMemberFeedbackModel(liveSelfDriveData) : { items: [], responses: [] }
  const liveDespatchEscalations = liveOpsData ? buildLiveDespatchEscalations({ actionLog: liveOpsData.actionLog, incidentLog: liveOpsData.incidentLog, people: liveOpsData.people }) : []
  const liveHeartbeatSnapshot = liveOpsData ? buildLiveHeartbeatSnapshot({ people: liveOpsData.people, actionLog: liveOpsData.actionLog, essentials: liveOpsData.essentials }) : null
  return <NiaDashboard enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={financeExpansionPreview} controlledAutonomyPreview={controlledAutonomyPreview} niaMarginsPreview={niaMarginsPreview} newAddsPreview={newAddsPreview} memberEngagementPreview={memberEngagementPreview} memberSavingsPreview={memberSavingsPreview} niaGrowthPreview={niaGrowthPreview} cashControlPreview={cashControlPreview} memberFeedbackItems={memberFeedbackModel.items} memberNpsResponses={memberFeedbackModel.responses} financeAllowed={financeAllowed} liveOpsData={liveOpsData} allocationData={allocationData} liveDespatchEscalations={liveDespatchEscalations} liveDespatchCommitments={liveOpsData?.executionActions ?? []} liveHeartbeatSnapshot={liveHeartbeatSnapshot} />
}
