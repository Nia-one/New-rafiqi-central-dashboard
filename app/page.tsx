import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildFinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { buildNiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
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
import { buildLiveMarginInputs, buildLiveSelfDriveSnapshot } from "@/lib/live-mappers/self-drive"

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
  const liveOpsData = await buildOpsData()
  const liveSelfDriveData = buildLiveSelfDriveSnapshot(liveOpsData)
  const niaMarginsPreview = buildNiaMarginsPreview(buildLiveMarginInputs(liveSelfDriveData))
  const newAddsPreview = buildNewAddsPreview()
  const memberEngagementPreview = buildMemberEngagementPreview()
  const memberSavingsPreview = buildMemberSavingsPreview()
  const niaGrowthPreview = buildNiaGrowthPreview()
  const cashControlPreview = financeAllowed ? buildCashControlPreview() : null
  const learningQueue = buildPlatformLearningQueue({ enterpriseDemand: enterpriseDemandPreview, newAdds: newAddsPreview, memberEngagement: memberEngagementPreview, memberSavings: memberSavingsPreview, niaMargins: niaMarginsPreview, niaGrowth: niaGrowthPreview, cashControl: cashControlPreview })
  const controlledAutonomyPreview = buildControlledAutonomyPreview(learningQueue)
  const allocationData = await buildAllocationData()

  return <NiaDashboard enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={financeExpansionPreview} controlledAutonomyPreview={controlledAutonomyPreview} niaMarginsPreview={niaMarginsPreview} newAddsPreview={newAddsPreview} memberEngagementPreview={memberEngagementPreview} memberSavingsPreview={memberSavingsPreview} niaGrowthPreview={niaGrowthPreview} cashControlPreview={cashControlPreview} financeAllowed={financeAllowed}
liveOpsData={liveOpsData}
liveSelfDriveData={liveSelfDriveData}
allocationData={allocationData}
/>
}




