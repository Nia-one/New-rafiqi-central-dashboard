import {
  PHASE_ONE_TAB_CONTRACTS,
  SUPPLY_MODELS,
  type CanonicalActivation,
type CanonicalDemand,
type CanonicalPerson,
type CanonicalStudio,
type CanonicalTheatre,
type CanonicalAction,
type CanonicalEvidence,
type CanonicalApproval,
  type IntakeField,
  type IntakeTabContract,
  type OperatingIntakeTab,
  type SourceLineage,
  type SupplyModel,
} from "@/lib/operating-loop/contracts"

export type SheetSourceRow = {
  tab: OperatingIntakeTab
  rowNumber: number
  values: Record<string, unknown>
  sourceUpdatedAt?: string | null
}

export type SheetImportInput = {
  batchId: string
  sourceId: string
  sourceName: string
  googleSheetId: string
  importedAt: string
  synthetic: boolean
  rows: readonly SheetSourceRow[]
}

export type RawImportedRow = {
  lineage: SourceLineage
  values: Readonly<Record<string, unknown>>
  validationStatus: "Imported" | "Quarantined"
}

export type QuarantineReason = {
  code: "missing_column" | "missing_value" | "invalid_type" | "invalid_value" | "duplicate_identity" | "privacy_boundary"
  field?: string
  message: string
}

export type QuarantinedRow = RawImportedRow & { reasons: readonly QuarantineReason[] }

export type CanonicalImport = {
  theatres: CanonicalTheatre[]
  studios: CanonicalStudio[]
  demands: CanonicalDemand[]
  people: CanonicalPerson[]
  activations: CanonicalActivation[]
  actions: CanonicalAction[]
  evidences: CanonicalEvidence[]
  approvals: CanonicalApproval[]
}
export type OperatingIngestionEvent = {
  eventId: string
  type: "source.row.imported" | "source.row.quarantined" | "enterprise.demand.ingested"
  occurredAt: string
  rowIdentity: string
  payload: Readonly<Record<string, string | number | boolean | null>>
}

export type IngestionResult = {
  batchId: string
  rawRows: RawImportedRow[]
  quarantinedRows: QuarantinedRow[]
  canonical: CanonicalImport
  events: OperatingIngestionEvent[]
  stats: {
    submitted: number
    imported: number
    quarantined: number
    duplicatesIgnored: number
    synthetic: boolean
  }
}

const contractByTab = new Map(PHASE_ONE_TAB_CONTRACTS.map((contract) => [contract.tab, contract]))
const prohibitedKeys = /(^|_)(raw_?payroll|kyc_?document|password|bank_?credential|full_?phone|phone_?number)($|_)/i
const capitalInputFields = ["refundable_deposit_inr", "nonrefundable_deposit_inr", "nia_capex_inr", "launch_working_capital_inr"] as const

function stableValue(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${key}:${stableValue(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function checksum(value: unknown) {
  let hash = 0x811c9dc5
  for (const character of stableValue(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function supplyModelValue(value: unknown): SupplyModel | null {
  const candidate = text(value)
  return candidate && (SUPPLY_MODELS as readonly string[]).includes(candidate) ? candidate as SupplyModel : null
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "string" && ["true", "false"].includes(value.trim().toLowerCase())) return value.trim().toLowerCase() === "true"
  return null
}

function timestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
}

function isMissing(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && !value.trim())
}

function typeIsValid(field: IntakeField, value: unknown) {
  if (isMissing(value)) return !field.required
  if (field.type === "text" || field.type === "formula:text") return typeof value === "string"
  if (field.type === "boolean") return booleanValue(value) !== null
  if (field.type === "integer") return Number.isInteger(numberValue(value))
  if (field.type === "decimal" || field.type === "formula:number") return numberValue(value) !== null
  return timestamp(value) !== null
}

function validateRow(contract: IntakeTabContract, values: Record<string, unknown>) {
  const reasons: QuarantineReason[] = []
  for (const key of Object.keys(values)) {
    if (prohibitedKeys.test(key)) reasons.push({ code: "privacy_boundary", field: key, message: `${key} is outside the Rafiqi Central operating-data boundary.` })
  }
  for (const field of contract.fields) {
    if (!(field.name in values)) {
      reasons.push({ code: "missing_column", field: field.name, message: `${contract.tab} is missing ${field.name}.` })
      continue
    }
    if (field.required && isMissing(values[field.name])) {
      reasons.push({ code: "missing_value", field: field.name, message: `${field.name} is required.` })
    } else if (!typeIsValid(field, values[field.name])) {
      reasons.push({ code: "invalid_type", field: field.name, message: `${field.name} must be ${field.type}.` })
    }
  }
  const identity = text(values[contract.identityField])
  if (!identity) reasons.push({ code: "invalid_value", field: contract.identityField, message: `${contract.identityField} must be a stable identifier.` })
  return reasons
}

function domainReasons(tab: OperatingIntakeTab, values: Record<string, unknown>, conflictingSupplyModelStudios: ReadonlySet<string>) {
  const reasons: QuarantineReason[] = []
  const latitude = numberValue(values.latitude)
  const longitude = numberValue(values.longitude)
  if ((tab === "Studio_Master" || tab === "Enterprise_Demand") && (latitude === null || latitude < -90 || latitude > 90)) reasons.push({ code: "invalid_value", field: "latitude", message: "Latitude must be between -90 and 90." })
  if ((tab === "Studio_Master" || tab === "Enterprise_Demand") && (longitude === null || longitude < -180 || longitude > 180)) reasons.push({ code: "invalid_value", field: "longitude", message: "Longitude must be between -180 and 180." })

  if (tab === "Studio_Master") {
    const contracted = numberValue(values.contracted_nests)
    const ready = numberValue(values.activation_ready_nests)
    const studioId = text(values.studio_id)
    if (!isMissing(values.supply_model) && !supplyModelValue(values.supply_model)) reasons.push({ code: "invalid_value", field: "supply_model", message: "supply_model must be exactly FONO or SP; it is never inferred from a Studio name." })
    for (const field of capitalInputFields) {
      if (isMissing(values[field])) reasons.push({ code: "missing_value", field, message: `${field} is required for governed capital comparison; missing capital is quarantined and never treated as zero.` })
    }
    if (studioId && conflictingSupplyModelStudios.has(studioId)) reasons.push({ code: "invalid_value", field: "supply_model", message: `Studio ${studioId} has conflicting governed supply_model values across the current Studio Master import history.` })
    if (contracted !== null && ready !== null && (contracted < 0 || ready < 0 || ready > contracted)) reasons.push({ code: "invalid_value", field: "activation_ready_nests", message: "Activation-ready Nests must be between zero and contracted Nests." })
  }

  if (tab === "Enterprise_Demand") {
    const required = numberValue(values.headcount_required)
    const matched = numberValue(values.headcount_matched)
    if (required !== null && matched !== null && (required <= 0 || matched < 0 || matched > required)) reasons.push({ code: "invalid_value", field: "headcount_matched", message: "Matched headcount must be between zero and required headcount." })
  }

  if (tab === "People_Roster") {
    const phoneHash = text(values.whatsapp_phone_hash)
    if (phoneHash && /^\+?\d[\d\s-]{7,}$/.test(phoneHash)) reasons.push({ code: "privacy_boundary", field: "whatsapp_phone_hash", message: "People_Roster must contain a protected hash, never a raw phone number." })
  }

  if (tab === "Member_Activation") {
    const token = text(values.member_token)
    if (token && /^\+?\d[\d\s-]{7,}$/.test(token)) reasons.push({ code: "privacy_boundary", field: "member_token", message: "Member references must use pseudonymous tokens." })
  }
  return reasons
}

function lineage(input: SheetImportInput, row: SheetSourceRow) {
  const rowChecksum = checksum(row.values)
  const sourceUpdatedAt = row.sourceUpdatedAt ?? timestamp(row.values.updated_at) ?? null
  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    tab: row.tab,
    rowNumber: row.rowNumber,
    sourceUpdatedAt,
    importedAt: input.importedAt,
    batchId: input.batchId,
    rowIdentity: `${input.sourceId}:${row.tab}:${row.rowNumber}:${sourceUpdatedAt ?? rowChecksum}`,
    rowChecksum,
    synthetic: input.synthetic,
  } satisfies SourceLineage
}

function canonicalize(row: RawImportedRow, output: CanonicalImport) {
  const values = row.values
  const source = row.lineage
  if (source.tab === "Theatre_Master") output.theatres.push({ theatreId: text(values.theatre_id)!, name: text(values.theatre_name)!, code: text(values.theatre_code)!, active: booleanValue(values.active)!, leadActorId: text(values.lead_actor_id), geography: text(values.geography), updatedAt: timestamp(values.updated_at)!, lineage: source })
  if (source.tab === "Studio_Master") output.studios.push({ studioId: text(values.studio_id)!, theatreId: text(values.theatre_id)!, name: text(values.studio_name)!, address: text(values.address)!, latitude: numberValue(values.latitude)!, longitude: numberValue(values.longitude)!, operatingModel: text(values.operating_model)!, supplyModel: supplyModelValue(values.supply_model)!, studioPartnerId: text(values.studio_partner_id), contractStatus: text(values.contract_status)!, readinessStatus: text(values.readiness_status)!, contractedNests: numberValue(values.contracted_nests)!, activationReadyNests: numberValue(values.activation_ready_nests)!, monthlyPartnerCostInr: numberValue(values.monthly_partner_cost_inr)!, refundableDepositInr: numberValue(values.refundable_deposit_inr)!, nonrefundableDepositInr: numberValue(values.nonrefundable_deposit_inr)!, niaCapexInr: numberValue(values.nia_capex_inr)!, launchWorkingCapitalInr: numberValue(values.launch_working_capital_inr)!, availableAt: timestamp(values.available_at) ?? timestamp(values.updated_at)!, active: booleanValue(values.active)!, updatedAt: timestamp(values.updated_at)!, lineage: source })
  if (source.tab === "Enterprise_Demand") output.demands.push({ demandId: text(values.demand_id)!, enterpriseId: text(values.enterprise_id)!, enterpriseName: text(values.enterprise_name)!, plantId: text(values.plant_id)!, plantName: text(values.plant_name)!, latitude: numberValue(values.latitude)!, longitude: numberValue(values.longitude)!, roleRequired: text(values.role_required)!, skillRequired: text(values.skill_required), shift: text(values.shift), headcountRequired: numberValue(values.headcount_required)!, headcountMatched: numberValue(values.headcount_matched)!, activationRequiredAt: timestamp(values.activation_required_at)!, certainty: text(values.certainty)!, status: text(values.status)!, ownerActorId: text(values.owner_actor_id)!, openedAt: timestamp(values.opened_at)!, updatedAt: timestamp(values.updated_at)!, lineage: source })
  if (source.tab === "People_Roster") output.people.push({ actorId: text(values.actor_id)!, displayName: text(values.display_name)!, whatsappPhoneHash: text(values.whatsapp_phone_hash)!, role: text(values.role)!, theatreId: text(values.theatre_id), studioId: text(values.studio_id), managerActorId: text(values.manager_actor_id), activeShift: booleanValue(values.active_shift)!, shiftStartAt: timestamp(values.shift_start_at), shiftEndAt: timestamp(values.shift_end_at), language: text(values.language)!, updatedAt: timestamp(values.updated_at)!, lineage: source })
  if (source.tab === "Member_Activation") output.activations.push({ activationId: text(values.activation_id)!, memberToken: text(values.member_token)!, activatedAt: timestamp(values.activated_at)!, theatreId: text(values.theatre_id)!, studioId: text(values.studio_id)!, nestId: text(values.nest_id)!, demandId: text(values.demand_id), enterpriseId: text(values.enterprise_id), workAssignmentId: text(values.work_assignment_id), membershipBilledInr: numberValue(values.membership_billed_inr)!, membershipCollectedInr: numberValue(values.membership_collected_inr)!, activationEvidenceUrl: text(values.activation_evidence_url)!, verifiedAt: timestamp(values.verified_at), verifiedBy: text(values.verified_by), verificationStatus: text(values.verification_status)!, sourceSubmissionId: text(values.source_submission_id)!, lineage: source })

  if (source.tab === "Action_Log") output.actions.push({
    actionId: text(values.action_id)!,
    incidentId: text(values.incident_id)!,
    operatingObjective: text(values.operating_objective)!,
    expectedMetric: text(values.expected_metric)!,
    baselineValue: text(values.baseline_value)!,
    targetValue: text(values.target_value)!,
    expectedFinancialImpactInr: numberValue(values.expected_financial_impact_inr)!,
    confidence: text(values.confidence)!,
    ownerActorId: text(values.owner_actor_id)!,
    dueAt: timestamp(values.due_at)!,
    requiredEvidence: text(values.required_evidence)!,
    approvalTier: text(values.approval_tier)!,
    state: text(values.state)!,
    proposedAt: timestamp(values.proposed_at)!,
    approvedAt: timestamp(values.approved_at),
    approvedBy: text(values.approved_by),
    assignedAt: timestamp(values.assigned_at),
    inProgressAt: timestamp(values.in_progress_at),
    proofSubmittedAt: timestamp(values.proof_submitted_at),
    proofEvidenceId: text(values.proof_evidence_id),
    verifiedAt: timestamp(values.verified_at),
    verifiedBy: text(values.verified_by),
    verificationResult: text(values.verification_result),
    closedAt: timestamp(values.closed_at),
    reopenedAt: timestamp(values.reopened_at),
    reopenReason: text(values.reopen_reason),
    escalatedAt: timestamp(values.escalated_at),
    sourceSubmissionId: text(values.source_submission_id)!,
    updatedAt: timestamp(values.updated_at)!,
    lineage: source
    })

  if (source.tab === "Evidence_Log") output.evidences.push({
    evidenceId: text(values.evidence_id)!,
    linkedType: text(values.linked_type)!,
    linkedId: text(values.linked_id)!,
    evidenceType: text(values.evidence_type)!,
    protectedUrl: text(values.protected_url)!,
    uploadedByActorId: text(values.uploaded_by_actor_id)!,
    uploadedAt: timestamp(values.uploaded_at)!,
    description: text(values.description)!,
    geoLat: numberValue(values.geo_lat),
    geoLng: numberValue(values.geo_lng),
    verificationStatus: text(values.verification_status)!,
    rejectedReason: text(values.rejected_reason),
    retentionClass: text(values.retention_class)!,
    sourceSubmissionId: text(values.source_submission_id)!,
    updatedAt: timestamp(values.updated_at)!,
    lineage: source,
  })

  if (source.tab === "Approval_Log") output.approvals.push({
    approvalId: text(values.approval_id)!,
    linkedActionId: text(values.linked_action_id)!,
    decisionType: text(values.decision_type)!,
    amountInr: numberValue(values.amount_inr)!,
    currentTerms: text(values.current_terms)!,
    proposedTerms: text(values.proposed_terms)!,
    businessReason: text(values.business_reason)!,
    expectedResult: text(values.expected_result)!,
    approverRole: text(values.approver_role)!,
    approverActorId: text(values.approver_actor_id),
    decision: text(values.decision)!,
    decisionReason: text(values.decision_reason)!,
    decidedAt: timestamp(values.decided_at)!,
    sourceSubmissionId: text(values.source_submission_id)!,
    updatedAt: timestamp(values.updated_at)!,
    lineage: source,
  })
}

export function importOperatingRows(input: SheetImportInput, previousRows: readonly RawImportedRow[] = []): IngestionResult {
  const studioSupplyModels = new Map<string, Set<SupplyModel>>()
  const recordSupplyModel = (studioId: string | null, supplyModel: SupplyModel | null) => {
    if (!studioId || !supplyModel) return
    const models = studioSupplyModels.get(studioId) ?? new Set<SupplyModel>()
    models.add(supplyModel)
    studioSupplyModels.set(studioId, models)
  }
  for (const row of previousRows) {
    if (row.validationStatus !== "Imported" || row.lineage.tab !== "Studio_Master") continue
    recordSupplyModel(text(row.values.studio_id), supplyModelValue(row.values.supply_model))
  }
  for (const row of input.rows) {
    if (row.tab !== "Studio_Master") continue
    recordSupplyModel(text(row.values.studio_id), supplyModelValue(row.values.supply_model))
  }
  const conflictingSupplyModelStudios = new Set([...studioSupplyModels].flatMap(([studioId, models]) => models.size > 1 ? [studioId] : []))
  const previousIdentities = new Set(previousRows.map((row) => row.lineage.rowIdentity))
  const batchIdentities = new Set<string>()
  const rawRows: RawImportedRow[] = []
  const quarantinedRows: QuarantinedRow[] = []
  const canonical: CanonicalImport = {
  theatres: [],
  studios: [],
  demands: [],
  people: [],
  activations: [],
  actions: [],
  evidences: [],
  approvals: [],
}
  const events: OperatingIngestionEvent[] = []
  let duplicatesIgnored = 0

  for (const sourceRow of input.rows) {
    const contract = contractByTab.get(sourceRow.tab)
    if (!contract) continue
    const sourceLineage = lineage(input, sourceRow)
    if (previousIdentities.has(sourceLineage.rowIdentity) || batchIdentities.has(sourceLineage.rowIdentity)) {
      duplicatesIgnored += 1
      continue
    }
    batchIdentities.add(sourceLineage.rowIdentity)
    const reasons = [...validateRow(contract, sourceRow.values), ...domainReasons(sourceRow.tab, sourceRow.values, conflictingSupplyModelStudios)]
    const raw: RawImportedRow = { lineage: sourceLineage, values: Object.freeze({ ...sourceRow.values }), validationStatus: reasons.length ? "Quarantined" : "Imported" }
    rawRows.push(raw)
    if (reasons.length) {
      quarantinedRows.push({ ...raw, reasons })
      events.push({ eventId: `evt-${input.batchId}-${sourceLineage.rowChecksum}-quarantine`, type: "source.row.quarantined", occurredAt: input.importedAt, rowIdentity: sourceLineage.rowIdentity, payload: { tab: sourceRow.tab, reasonCount: reasons.length, synthetic: input.synthetic } })
      continue
    }
    canonicalize(raw, canonical)
    events.push({ eventId: `evt-${input.batchId}-${sourceLineage.rowChecksum}-import`, type: "source.row.imported", occurredAt: input.importedAt, rowIdentity: sourceLineage.rowIdentity, payload: { tab: sourceRow.tab, synthetic: input.synthetic } })
    if (sourceRow.tab === "Enterprise_Demand") events.push({ eventId: `evt-${input.batchId}-${sourceLineage.rowChecksum}-demand`, type: "enterprise.demand.ingested", occurredAt: input.importedAt, rowIdentity: sourceLineage.rowIdentity, payload: { demandId: text(sourceRow.values.demand_id), enterpriseId: text(sourceRow.values.enterprise_id), synthetic: input.synthetic } })
  }

  return {
    batchId: input.batchId,
    rawRows,
    quarantinedRows,
    canonical,
    events,
    stats: { submitted: input.rows.length, imported: rawRows.length - quarantinedRows.length, quarantined: quarantinedRows.length, duplicatesIgnored, synthetic: input.synthetic },
  }
}



