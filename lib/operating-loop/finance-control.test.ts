import assert from "node:assert/strict"
import test from "node:test"
import { POLICY_REGISTRY, type PolicyDefinition } from "@/lib/operating-loop/contracts"
import {
  FINANCIAL_APPROVAL_CATEGORIES,
  appendFinancialApprovalEvidence,
  buildGovernedStudioOptions,
  createFinancialApprovalRequest,
  decideFinancialApproval,
  evaluateFinancialGuardrails,
  financialControlPoliciesAt,
  type ExpansionAssumptions,
} from "@/lib/operating-loop/finance-control"
import { syntheticImportInput } from "@/lib/operating-loop/fixtures"
import { importOperatingRows } from "@/lib/operating-loop/ingestion"
import { rankStudiosForDemand } from "@/lib/operating-loop/matching"

const assumptions: Readonly<Record<string, ExpansionAssumptions>> = {
  "ST-SIP-02": { expectedOccupiedNests: 132, commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 1, unresolvedDependencyDays: 0, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
  "ST-ORA-01": { expectedOccupiedNests: 240, commercialAgreementDays: 1, complianceReadinessDays: 1, physicalReadinessDays: 1, unresolvedDependencyDays: 0, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
  "ST-MAM-01": { expectedOccupiedNests: 180, commercialAgreementDays: 2, complianceReadinessDays: 2, physicalReadinessDays: 1, unresolvedDependencyDays: 1, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
}

test("financial controls are effective-dated and select the latest active version", () => {
  const nextOpexPolicy: PolicyDefinition = { ...POLICY_REGISTRY.find((policy) => policy.policyId === "POL-OPEX-CAP")!, value: 6_500_000, effectiveFrom: "2026-08-01", version: 2 }
  const registry = [...POLICY_REGISTRY, nextOpexPolicy]
  assert.equal(financialControlPoliciesAt("2026-07-31T23:59:00+05:30", registry).monthlyOpexCap.value, 6_000_000)
  const august = financialControlPoliciesAt("2026-08-01T00:01:00+05:30", registry)
  assert.equal(august.monthlyOpexCap.value, 6_500_000)
  assert.equal(august.monthlyOpexCap.version, 2)
  assert.equal(august.minimumCash.value, 15_000_000)
  assert.equal(august.hiringState.value, "Frozen")
  assert.equal(august.financialApprover.value, "Pushkar")
})

test("governed Studio options expose capital, friction, recurring cost, and explicit 90-day CM assumptions", () => {
  const data = importOperatingRows(syntheticImportInput()).canonical
  const matches = rankStudiosForDemand(data.demands[0], data.studios, assumptions)
  const options = buildGovernedStudioOptions(data.studios, matches, assumptions)
  const selected = options[0]
  assert.equal(selected.studioId, "ST-ORA-01")
  assert.equal(selected.refundableDepositInr, 1_200_000)
  assert.equal(selected.nonrefundableDepositInr, 150_000)
  assert.equal(selected.niaFundedCapexInr, 360_000)
  assert.equal(selected.launchWorkingCapitalInr, 160_000)
  assert.equal(selected.upfrontCapitalInr, 1_870_000)
  assert.equal(selected.activationFriction.totalDays, 3)
  assert.equal(selected.projected90DayContributionMarginInr, 216_000)
  assert.equal(selected.contributionMarginAssumption.scope, "Living CM2 only")
  assert.match(selected.contributionMarginAssumption.exclusions, /not amortised into CM/)
})

test("₹60 lakh opex, ₹150 lakh cash, and frozen hiring controls create governed breaches", () => {
  const policies = financialControlPoliciesAt("2026-07-17T08:00:00+05:30")
  const result = evaluateFinancialGuardrails({
    period: "2026-07",
    currentMonthlyOpexInr: 4_800_000,
    forecastMonthlyOpexInr: 6_180_000,
    currentCashInr: 17_200_000,
    pendingCommitmentsInr: 500_000,
    proposedUpfrontCapitalInr: 1_870_000,
    proposedNewHires: 1,
    sourceRowIdentity: "Finance_Daily:F-1",
    asOf: "2026-07-17T08:00:00+05:30",
    synthetic: true,
  }, policies)
  assert.equal(result.projectedCashAfterCommitmentInr, 14_830_000)
  assert.deepEqual(result.breaches.map((breach) => breach.kind), ["Opex forecast breach", "Cash guardrail breach", "Hiring freeze breach"])
  assert.equal(result.approver, "Pushkar")
  assert.equal(result.approvalRequired, true)
  assert.equal(result.executionPermitted, false)
})

test("every locked financial category requires protected evidence and a Pushkar decision", () => {
  const policies = financialControlPoliciesAt("2026-07-17T08:00:00+05:30")
  for (const [index, category] of FINANCIAL_APPROVAL_CATEGORIES.entries()) {
    let request = createFinancialApprovalRequest({
      requestId: `REQ-${index}`,
      category,
      studioId: "ST-ORA-01",
      amountInr: 1_000,
      requestedBy: "ACT-FINANCE",
      requestedAt: "2026-07-17T08:00:00+05:30",
      reason: `Review ${category}`,
      policyRefs: ["POL-FIN-APPROVER@v1"],
      synthetic: true,
    }, policies)
    assert.throws(() => decideFinancialApproval(request, { decision: "Approved", actorId: "ACT-FINANCE", occurredAt: "2026-07-17T08:01:00+05:30", note: "approve", expectedVersion: request.version }), /Pushkar/)
    request = appendFinancialApprovalEvidence(request, `protected://approval/${index}`, "ACT-FINANCE", "2026-07-17T08:02:00+05:30", request.version)
    const decided = decideFinancialApproval(request, { decision: "Approved", actorId: "Pushkar", occurredAt: "2026-07-17T08:03:00+05:30", note: "Synthetic workflow approval only.", expectedVersion: request.version })
    assert.equal(decided.status, "Approved")
    assert.equal(decided.decisionBy, "Pushkar")
    assert.equal(request.status, "Requested")
    assert.equal(Object.isFrozen(decided.history), true)
    assert.throws(() => decideFinancialApproval(decided, { decision: "Rejected", actorId: "Pushkar", occurredAt: "2026-07-17T08:04:00+05:30", note: "second decision", expectedVersion: decided.version }), /only once/)
  }
})
