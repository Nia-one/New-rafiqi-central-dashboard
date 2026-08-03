import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildFinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { buildNiaMarginsPreview, NIA_MARGINS_SYNTHETIC_INPUTS } from "@/lib/operating-loop/nia-margins-loop"
import { buildNewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import { buildMemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import { buildMemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import { buildNiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { buildCashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import { buildPlatformLearningQueue } from "@/lib/operating-loop/platform-learning"
import { cookies } from "next/headers"
import { AUTH_COOKIE, loginConfigurationFromEnvironment, readSessionEmail, sessionSecretFromEnvironment } from "@/lib/auth"
import { financeAccessAllowed, roleAssignments } from "@/lib/access-control"
import { buildOpsData } from "@/lib/opsDataMapper"
import { buildAllocationData } from "@/lib/allocation-data-live"
import { syncAllSources } from "@/lib/sourceSync"
import {
  buildLiveMarginInputs,
  buildLiveMemberEngagementHeadlineMeasures,
  buildLiveMemberEngagementLoopHealth,
  buildLiveMemberSavingsHealth,
  buildLiveMemberSavingsTasks,
  buildLiveNewAddsFillStatus,
  buildLiveNewAddsFillTasks,
  buildLiveNewAddsProof,
  buildLiveNewAddsTheatreProgress,
  buildLiveNiaGrowthProjection,
  buildLiveSelfDriveSnapshot,
} from "@/lib/live-mappers/self-drive"

export const dynamic = "force-dynamic"

export default async function Page() {
  if (!selfDrivePlatformEnabled()) return <LegacyNiaDashboard />

  const { NiaDashboard } = await import("@/components/nia-dashboard")
  const cookieStore = await cookies()
  const loginConfiguration = loginConfigurationFromEnvironment()
  const sessionEmail = await readSessionEmail(cookieStore.get(AUTH_COOKIE)?.value, sessionSecretFromEnvironment())
  const configuredEmail = loginConfiguration?.email
  const role = sessionEmail ? roleAssignments().get(sessionEmail) ?? (process.env.NODE_ENV !== "production" && sessionEmail === configuredEmail ? "administrator" : null) : null
  const hasFinanceRole = financeAccessAllowed(role)
  const financeAllowed = hasFinanceRole && financeExpansionControlEnabled()
  const enterpriseDemandPreview = buildEnterpriseDemandLoopPreview()
  const financeExpansionPreview = financeAllowed ? buildFinanceExpansionPreview() : null
  let liveOpsData: Awaited<ReturnType<typeof buildOpsData>> | null = null
  let allocationData: Awaited<ReturnType<typeof buildAllocationData>> | null = null
  try {
    // Treat every authenticated page load as an opportunity to ingest new
    // User Input and bot rows. The synchronizer is single-flight and
    // rate-limited, so navigation stays safe while cold serverless instances
    // still converge without relying on a paid high-frequency cron.
    await syncAllSources({ force: false })
    ;[liveOpsData, allocationData] = await Promise.all([buildOpsData(), buildAllocationData()])
  } catch (error) {
    // The governed fixtures keep the demo usable while a Sheet connector is
    // unavailable; a failed refresh must never turn a missing value into zero.
    console.error("Live dashboard snapshot unavailable; using governed fixture fallback.", error)
  }
  const liveSelfDriveData = liveOpsData ? buildLiveSelfDriveSnapshot(liveOpsData) : null
  const liveMarginInputs = liveSelfDriveData ? buildLiveMarginInputs(liveSelfDriveData) : []
  const niaMarginsPreview = liveSelfDriveData && liveMarginInputs.length > 0
    ? buildNiaMarginsPreview(liveMarginInputs, liveSelfDriveData.asOf, [])
    : buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS)
  const newAddsFixture = buildNewAddsPreview()
  const memberEngagementFixture = buildMemberEngagementPreview()
  const memberSavingsFixture = buildMemberSavingsPreview()
  const niaGrowthFixture = buildNiaGrowthPreview()
  const liveNewAddsStatus = liveSelfDriveData ? buildLiveNewAddsFillStatus(liveSelfDriveData) : null
  const liveNewAddsProof = liveSelfDriveData ? buildLiveNewAddsProof(liveSelfDriveData) : null
  const newAddsPreview = liveSelfDriveData && liveNewAddsStatus?.hasData && liveNewAddsProof
    ? Object.freeze({
      ...newAddsFixture,
      taskSummary: Object.freeze({ target: liveNewAddsStatus.target, current: liveNewAddsStatus.verified, gap: liveNewAddsStatus.gap, owner: liveNewAddsStatus.owner, progressPercent: liveNewAddsStatus.progressPercent, verifiedResult: `${liveNewAddsStatus.verified}/${liveNewAddsStatus.target} billing-live` }),
      measures: liveNewAddsProof.measures,
      theatres: buildLiveNewAddsTheatreProgress(liveSelfDriveData),
      actions: buildLiveNewAddsFillTasks(liveSelfDriveData),
      loopHealth: liveNewAddsProof.loopHealth,
    })
    : newAddsFixture
  const liveEngagement = liveSelfDriveData ? buildLiveMemberEngagementHeadlineMeasures(liveSelfDriveData) : null
  const memberEngagementPreview = liveSelfDriveData && liveEngagement?.hasData
    ? Object.freeze({ ...memberEngagementFixture, measures: liveEngagement.measures, retentionCurves: liveEngagement.retentionCurves, loopHealth: buildLiveMemberEngagementLoopHealth(liveSelfDriveData) })
    : memberEngagementFixture
  const liveSavingsTasks = liveSelfDriveData ? buildLiveMemberSavingsTasks(liveSelfDriveData) : []
  const memberSavingsPreview = liveSelfDriveData && liveSavingsTasks.length > 0
    ? Object.freeze({ ...memberSavingsFixture, tasks: liveSavingsTasks, loopHealth: buildLiveMemberSavingsHealth(liveSelfDriveData) })
    : memberSavingsFixture
  const liveGrowth = liveSelfDriveData ? buildLiveNiaGrowthProjection(liveSelfDriveData) : null
  const niaGrowthPreview = liveSelfDriveData && liveGrowth && liveSelfDriveData.enterpriseDemand.length > 0
    ? Object.freeze({ ...niaGrowthFixture, summary: liveGrowth.summary, measures: liveGrowth.measures })
    : niaGrowthFixture
  const cashControlPreview = financeAllowed ? buildCashControlPreview() : null
  const learningQueue = buildPlatformLearningQueue({ enterpriseDemand: enterpriseDemandPreview, newAdds: newAddsPreview, memberEngagement: memberEngagementPreview, memberSavings: memberSavingsPreview, niaMargins: niaMarginsPreview, niaGrowth: niaGrowthPreview, cashControl: cashControlPreview })
  const controlledAutonomyPreview = buildControlledAutonomyPreview(learningQueue)
  return <NiaDashboard enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={financeExpansionPreview} controlledAutonomyPreview={controlledAutonomyPreview} niaMarginsPreview={niaMarginsPreview} newAddsPreview={newAddsPreview} memberEngagementPreview={memberEngagementPreview} memberSavingsPreview={memberSavingsPreview} niaGrowthPreview={niaGrowthPreview} cashControlPreview={cashControlPreview} financeAllowed={financeAllowed} liveOpsData={liveOpsData} allocationData={allocationData} />
}
