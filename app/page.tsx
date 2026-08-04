import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildLiveEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildFinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import { buildNiaMarginsPreview, NIA_MARGINS_SYNTHETIC_INPUTS } from "@/lib/operating-loop/nia-margins-loop"
import { buildCashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import { cookies } from "next/headers"
import { AUTH_COOKIE, loginConfigurationFromEnvironment, readSessionEmail, sessionSecretFromEnvironment } from "@/lib/auth"
import { financeAccessAllowed, roleAssignments } from "@/lib/access-control"
import { buildOpsData } from "@/lib/opsDataMapper"
import { buildAllocationData } from "@/lib/allocation-data-live"
import { buildLiveDespatchEscalations } from "@/lib/live-mappers/despatch"
import {
  buildLiveMarginInputs,
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
  const financeExpansionPreview = financeAllowed ? buildFinanceExpansionPreview() : null
  let liveOpsData: Awaited<ReturnType<typeof buildOpsData>> | null = null
  let allocationData: Awaited<ReturnType<typeof buildAllocationData>> | null = null
  try {
    ;[liveOpsData, allocationData] = await Promise.all([buildOpsData(), buildAllocationData()])
  } catch (error) {
    // The governed fixtures keep the demo usable while a Sheet connector is
    // unavailable; a failed refresh must never turn a missing value into zero.
    console.warn("Live dashboard snapshot unavailable; using governed fixture fallback.", error instanceof Error ? error.message : error)
  }
  const liveSelfDriveData = liveOpsData ? buildLiveSelfDriveSnapshot(liveOpsData) : null
  const enterpriseDemandPreview = liveSelfDriveData
    ? buildLiveEnterpriseDemandLoopPreview(liveSelfDriveData.enterpriseDemand, liveSelfDriveData.asOf)
    : null
  const liveMarginInputs = liveSelfDriveData ? buildLiveMarginInputs(liveSelfDriveData) : []
  const niaMarginsPreview = liveSelfDriveData && liveMarginInputs.length > 0
    ? buildNiaMarginsPreview(liveMarginInputs, liveSelfDriveData.asOf, [])
    : buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS)
  const cashControlPreview = financeAllowed ? buildCashControlPreview() : null
  const liveDespatchEscalations = liveOpsData ? buildLiveDespatchEscalations({ actionLog: liveOpsData.actionLog, incidentLog: liveOpsData.incidentLog, people: liveOpsData.people }) : []
  return <NiaDashboard enterpriseDemandPreview={enterpriseDemandPreview} financeExpansionPreview={financeExpansionPreview} niaMarginsPreview={niaMarginsPreview} cashControlPreview={cashControlPreview} financeAllowed={financeAllowed} liveOpsData={liveOpsData} allocationData={allocationData} liveDespatchEscalations={liveDespatchEscalations} liveDespatchCommitments={liveOpsData?.executionActions ?? []} />
}
