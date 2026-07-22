import type { CanonicalDemand, CanonicalStudio } from "@/lib/operating-loop/contracts"

export type CapacityContext = {
  expectedOccupiedNests: number
  commercialAgreementDays: number
  complianceReadinessDays: number
  physicalReadinessDays: number
  unresolvedDependencyDays: number
}

export type StudioMatch = {
  rank: number
  studioId: string
  studioName: string
  theatreId: string
  distanceKm: number
  direction: string
  canMeetHeadcount: boolean
  canMeetActivationDate: boolean
  activationReadyNests: number
  contractedNests: number
  expectedOccupiedNests: number
  availableAt: string
  upfrontCapitalInr: number
  depositAndCapexInr: number
  capitalPerReadyNestInr: number
  recurringCostPerContractedNestInr: number
  recurringCostPerExpectedOccupiedNestInr: number
  activationFrictionDays: number
  projected90DayContributionMarginInr: number
  why: readonly string[]
  source: { rowIdentity: string; updatedAt: string; synthetic: boolean }
}

const EARTH_RADIUS_KM = 6371

function radians(value: number) {
  return value * Math.PI / 180
}

function haversineKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const left = Math.sin(latitudeDelta / 2) ** 2
  const right = Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(left + right), Math.sqrt(1 - left - right))
}

function bearing(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const fromLatitude = radians(from.latitude)
  const toLatitude = radians(to.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude)
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude) - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta)
  const degrees = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8]
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : Number.POSITIVE_INFINITY
}

function booleanDesc(left: boolean, right: boolean) {
  return Number(right) - Number(left)
}

function numericAsc(left: number, right: number) {
  return left - right
}

function numericDesc(left: number, right: number) {
  return right - left
}

export function compareStudioMatches(left: StudioMatch, right: StudioMatch) {
  return booleanDesc(left.canMeetHeadcount, right.canMeetHeadcount)
    || booleanDesc(left.canMeetActivationDate, right.canMeetActivationDate)
    || numericAsc(left.distanceKm, right.distanceKm)
    || numericAsc(left.capitalPerReadyNestInr, right.capitalPerReadyNestInr)
    || numericAsc(left.depositAndCapexInr, right.depositAndCapexInr)
    || numericAsc(left.recurringCostPerExpectedOccupiedNestInr, right.recurringCostPerExpectedOccupiedNestInr)
    || numericAsc(left.activationFrictionDays, right.activationFrictionDays)
    || numericDesc(left.projected90DayContributionMarginInr, right.projected90DayContributionMarginInr)
    || left.studioId.localeCompare(right.studioId)
}

export function rankStudiosForDemand(
  demand: CanonicalDemand,
  studios: readonly CanonicalStudio[],
  contextByStudio: Readonly<Record<string, CapacityContext>>,
  livingCm2PerOccupiedNestPerMonthInr = 300,
) {
  const remainingHeadcount = demand.headcountRequired - demand.headcountMatched
  const matches = studios.filter((studio) => studio.active).map((studio): StudioMatch => {
    const context = contextByStudio[studio.studioId] ?? {
      expectedOccupiedNests: studio.activationReadyNests,
      commercialAgreementDays: 0,
      complianceReadinessDays: 0,
      physicalReadinessDays: 0,
      unresolvedDependencyDays: 0,
    }
    const distanceKm = haversineKm(demand, studio)
    const direction = bearing(demand, studio)
    const upfrontCapitalInr = studio.refundableDepositInr + studio.nonrefundableDepositInr + studio.niaCapexInr + studio.launchWorkingCapitalInr
    const depositAndCapexInr = studio.refundableDepositInr + studio.nonrefundableDepositInr + studio.niaCapexInr
    const capitalPerReadyNestInr = ratio(upfrontCapitalInr, studio.activationReadyNests)
    const recurringCostPerContractedNestInr = ratio(studio.monthlyPartnerCostInr, studio.contractedNests)
    const recurringCostPerExpectedOccupiedNestInr = ratio(studio.monthlyPartnerCostInr, context.expectedOccupiedNests)
    const activationFrictionDays = context.commercialAgreementDays + context.complianceReadinessDays + context.physicalReadinessDays + context.unresolvedDependencyDays
    const canMeetHeadcount = studio.activationReadyNests >= remainingHeadcount
    const canMeetActivationDate = Date.parse(studio.availableAt) <= Date.parse(demand.activationRequiredAt)
    const projected90DayContributionMarginInr = context.expectedOccupiedNests * livingCm2PerOccupiedNestPerMonthInr * 3

    return {
      rank: 0,
      studioId: studio.studioId,
      studioName: studio.name,
      theatreId: studio.theatreId,
      distanceKm: Number(distanceKm.toFixed(1)),
      direction,
      canMeetHeadcount,
      canMeetActivationDate,
      activationReadyNests: studio.activationReadyNests,
      contractedNests: studio.contractedNests,
      expectedOccupiedNests: context.expectedOccupiedNests,
      availableAt: studio.availableAt,
      upfrontCapitalInr,
      depositAndCapexInr,
      capitalPerReadyNestInr: Number(capitalPerReadyNestInr.toFixed(2)),
      recurringCostPerContractedNestInr: Number(recurringCostPerContractedNestInr.toFixed(2)),
      recurringCostPerExpectedOccupiedNestInr: Number(recurringCostPerExpectedOccupiedNestInr.toFixed(2)),
      activationFrictionDays,
      projected90DayContributionMarginInr,
      why: Object.freeze([
        `${canMeetHeadcount ? "Meets" : "Does not meet"} the ${remainingHeadcount}-Member remaining demand with ${studio.activationReadyNests} activation-ready Nests.`,
        `${canMeetActivationDate ? "Available by" : "Available after"} the required activation date; ${activationFrictionDays} readiness-friction days remain.`,
        `${distanceKm.toFixed(1)} km ${direction}; ₹${Math.round(capitalPerReadyNestInr).toLocaleString("en-IN")} upfront capital per ready Nest.`,
        `90-day CM uses expected occupied Nests only; deposits and capex are shown separately and never amortised into CM.`,
      ]),
      source: Object.freeze({ rowIdentity: studio.lineage.rowIdentity, updatedAt: studio.updatedAt, synthetic: studio.lineage.synthetic }),
    }
  }).toSorted(compareStudioMatches)

  return Object.freeze(matches.map((match, index) => Object.freeze({ ...match, rank: index + 1 })))
}
