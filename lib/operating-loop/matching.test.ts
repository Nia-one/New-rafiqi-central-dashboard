import assert from "node:assert/strict"
import test from "node:test"
import { syntheticImportInput } from "@/lib/operating-loop/fixtures"
import { importOperatingRows } from "@/lib/operating-loop/ingestion"
import { rankStudiosForDemand } from "@/lib/operating-loop/matching"

test("Studio ranking exposes every governed factor and selects the only capacity-complete option", () => {
  const data = importOperatingRows(syntheticImportInput()).canonical
  const ranking = rankStudiosForDemand(data.demands[0], data.studios, {
    "ST-SIP-02": { expectedOccupiedNests: 132, commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 1, unresolvedDependencyDays: 0 },
    "ST-ORA-01": { expectedOccupiedNests: 240, commercialAgreementDays: 1, complianceReadinessDays: 1, physicalReadinessDays: 1, unresolvedDependencyDays: 0 },
    "ST-MAM-01": { expectedOccupiedNests: 180, commercialAgreementDays: 2, complianceReadinessDays: 2, physicalReadinessDays: 1, unresolvedDependencyDays: 1 },
  })
  assert.equal(ranking[0].studioId, "ST-ORA-01")
  assert.equal(ranking[0].canMeetHeadcount, true)
  assert.equal(ranking[0].upfrontCapitalInr, 1_870_000)
  assert.equal(ranking[0].projected90DayContributionMarginInr, 216_000)
  assert.match(ranking[0].why.join(" "), /deposits and capex.+never amortised/i)
  assert.ok(ranking.every((match) => Number.isFinite(match.distanceKm) && match.why.length === 4))
})

test("ranking is deterministic", () => {
  const data = importOperatingRows(syntheticImportInput()).canonical
  const contexts = Object.fromEntries(data.studios.map((studio) => [studio.studioId, { expectedOccupiedNests: studio.activationReadyNests, commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 0, unresolvedDependencyDays: 0 }]))
  assert.deepEqual(rankStudiosForDemand(data.demands[0], data.studios, contexts), rankStudiosForDemand(data.demands[0], data.studios.toReversed(), contexts))
})
