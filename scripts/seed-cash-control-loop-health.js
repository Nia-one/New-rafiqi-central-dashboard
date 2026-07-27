require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const seeds = {
  Action_Log: [
    {
      "action id": "CC-ACTION-TEST-001",
      "operating objective": "Verify cash collection leakage recovery",
      "expected metric": "Current due INR",
      "baseline value": 6400,
      "target value": 0,
      "expected financial impact inr": 6400,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-25T11:30:00+05:30",
      "required evidence": "Finance_Daily reconciliation",
      "approval tier": "None",
      state: "Verified",
      "proposed at": "2026-07-25T09:30:00+05:30",
      "proof submitted at": "2026-07-25T11:00:00+05:30",
      "proof evidence id": "CC-EVD-TEST-001",
      "verified at": "2026-07-25T11:30:00+05:30",
      "verified by": "ACT-PRIYA",
      "verification result": "Cash leakage recovery independently checked",
      "closed at": "2026-07-25T11:30:00+05:30",
    },
    {
      "action id": "CC-ACTION-TEST-002",
      "operating objective": "Approve monthly cash destination",
      "expected metric": "Cash target INR",
      "baseline value": 245000,
      "target value": 300000,
      "expected financial impact inr": 55000,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-26T14:00:00+05:30",
      "required evidence": "Authorised destination approval",
      "approval tier": "Finance",
      state: "Proposed",
      "proposed at": "2026-07-25T12:00:00+05:30",
    },
    {
      "action id": "CC-ACTION-TEST-003",
      "operating objective": "Reconcile cash collection exception",
      "expected metric": "Collection leakage INR",
      "baseline value": 6400,
      "target value": 0,
      "expected financial impact inr": 6400,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-26T16:00:00+05:30",
      "required evidence": "Reconciliation proof",
      "approval tier": "None",
      state: "Reopened",
      "proposed at": "2026-07-25T10:00:00+05:30",
      "reopened at": "2026-07-25T12:00:00+05:30",
      "reopen reason": "Submitted proof did not reconcile the full collection difference",
    },
    ...[
      ["ENT", "Approve enterprise demand SLA exception", "Matched headcount", 400, 500, 180000, "Commercial", "Named-demand activation approval"],
      ["ADD", "Approve billing-live activation cost exception", "Verified activations", 1, 24, 36000, "Finance", "Billing-live activation cost approval"],
      ["ENG", "Approve member engagement recovery policy", "Recovered Members", 8, 20, 24000, "Operations", "Member engagement recovery approval"],
      ["SAV", "Approve Essentials pricing exception", "Member savings INR", 18000, 25000, 25000, "Finance", "Essentials pricing approval"],
      ["MAR", "Approve Nia margin recovery target", "CM2 INR", 43000, 65000, 22000, "Finance", "Nia margin target approval"],
      ["GRW", "Approve FONO expansion readiness commitment", "Activation ready nests", 246, 320, 115000, "Commercial", "FONO growth commitment approval"],
    ].map(([code, objective, metric, baseline, target, impact, tier, evidence]) => ({
      "action id": `SD-ACTION-${code}-TEST-001`,
      "operating objective": objective,
      "expected metric": metric,
      "baseline value": baseline,
      "target value": target,
      "expected financial impact inr": impact,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-27T14:00:00+05:30",
      "required evidence": evidence,
      "approval tier": tier,
      state: "Proposed",
      "proposed at": "2026-07-26T14:00:00+05:30",
    })),
  ],
  Evidence_Log: [
    {
      "evidence id": "CC-EVD-TEST-001",
      "linked type": "Action",
      "linked id": "CC-ACTION-TEST-001",
      "evidence type": "Finance reconciliation",
      "protected url": "test://evidence/cash-control-001",
      "uploaded by actor id": "ACT-PRIYA",
      "uploaded at": "2026-07-25T11:00:00+05:30",
      description: "TEST DATA - cash leakage recovery evidence",
      "verification status": "Verified",
      "updated at": "2026-07-25T11:30:00+05:30",
    },
  ],
  Approval_Log: [
    {
      "approval id": "CC-APR-TEST-001",
      "linked action id": "CC-ACTION-TEST-002",
      "decision type": "Monthly cash destination",
      "amount inr": 300000,
      "current terms": "Destination pending",
      "proposed terms": "Approve monthly collected-cash target",
      "business reason": "Unlock the governed monthly cascade",
      "expected result": "Cash target approved",
      "approver role": "Finance",
      "approver actor id": "ACT-PRIYA",
      decision: "Pending",
      "decision reason": "TEST DATA - awaiting authorised decision",
      "updated at": "2026-07-25T12:00:00+05:30",
    },
    ...[
      ["ENT", "Enterprise demand SLA exception", 180000, "Current demand SLA", "Approve temporary activation exception", "Activate named enterprise demand without losing the governed SLA", "500 matched Members"],
      ["ADD", "Member activation cost exception", 36000, "Approved activation cost rule", "Approve temporary billing-live cost exception", "Recover verified FONO vacancy fill", "24 billing-live activations"],
      ["ENG", "Member engagement recovery policy", 24000, "Current recovery playbook", "Approve targeted engagement recovery", "Recover at-risk Members using verified evidence", "20 Members recovered"],
      ["SAV", "Essentials pricing exception", 25000, "Current approved price rule", "Approve temporary savings-led price exception", "Protect Member savings and Nia contribution", "₹25,000 verified Member savings"],
      ["MAR", "Nia margin recovery target", 22000, "Current CM2 baseline", "Approve governed CM2 recovery target", "Close the verified margin gap", "₹65,000 CM2"],
      ["GRW", "FONO expansion readiness commitment", 115000, "Current FONO readiness plan", "Approve evidence-ranked FONO growth commitment", "Add capacity only where demand and readiness are verified", "320 activation-ready Nests"],
    ].map(([code, decisionType, amount, currentTerms, proposedTerms, businessReason, expectedResult]) => ({
      "approval id": `SD-APR-${code}-TEST-001`,
      "linked action id": `SD-ACTION-${code}-TEST-001`,
      "decision type": decisionType,
      "amount inr": amount,
      "current terms": currentTerms,
      "proposed terms": proposedTerms,
      "business reason": businessReason,
      "expected result": expectedResult,
      "approver role": code === "ENG" ? "Operations" : code === "ENT" || code === "GRW" ? "Commercial" : "Finance",
      "approver actor id": "ACT-PRIYA",
      decision: "Pending",
      "decision reason": "TEST DATA - awaiting authorised decision",
      "updated at": "2026-07-26T14:00:00+05:30",
    })),
  ],
}

const identityFields = { Action_Log: "action id", Evidence_Log: "evidence id", Approval_Log: "approval id" }

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const result = {}

  for (const [tab, rows] of Object.entries(seeds)) {
    const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` })).data.values || []
    const headers = current[0] || []
    const identity = identityFields[tab]
    const identityIndex = headers.indexOf(identity)
    if (identityIndex < 0) throw new Error(`${tab} is missing existing identity header '${identity}'`)
    const existingRows = new Map(current.slice(1).map((row, offset) => [String(row[identityIndex] || "").trim(), offset + 2]))
    const missing = rows.filter((row) => !existingRows.has(row[identity]))
    const updates = rows.filter((row) => existingRows.has(row[identity])).map((row) => ({
      range: `${tab}!A${existingRows.get(row[identity])}:${columnName(headers.length - 1)}${existingRows.get(row[identity])}`,
      values: [headers.map((header) => row[header] ?? "")],
    }))
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      })
    }
    if (missing.length) {
      const values = missing.map((row) => headers.map((header) => row[header] ?? ""))
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A:${columnName(headers.length - 1)}`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values } })
    }
    result[tab] = { added: missing.length, updated: updates.length, ids: rows.map((row) => row[identity]) }
  }

  const finance = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Finance_Daily!A1:AZ2" })).data.values || []
  const financeHeaders = finance[0] || []
  const guardrailIndex = financeHeaders.indexOf("cash guardrail status")
  if (guardrailIndex >= 0 && String(finance[1]?.[guardrailIndex] || "").trim().toLowerCase() === "active") {
    const cell = `${columnName(guardrailIndex)}2`
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `Finance_Daily!${cell}`, valueInputOption: "RAW", requestBody: { values: [["Protected"]] } })
    result.Finance_Daily = { updated: "cash guardrail status", from: "Active", to: "Protected" }
  } else {
    result.Finance_Daily = { updated: false, current: guardrailIndex >= 0 ? finance[1]?.[guardrailIndex] || "" : "missing header" }
  }

  result.Approval_Workflow = await configureApprovalWorkflow(sheets, spreadsheetId)

  console.log(JSON.stringify(result, null, 2))
}

async function configureApprovalWorkflow(sheets, spreadsheetId) {
  const approvalValues = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Approval_Log!A:AZ" })).data.values || []
  const headers = approvalValues[0] || []
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const approvalSheet = metadata.data.sheets?.find((sheet) => sheet.properties.title === "Approval_Log")
  if (!approvalSheet || !headers.length) throw new Error("Approval_Log was not found or has no headers")

  const humanInput = new Set(["decision", "decision reason", "decided at"])
  const formatHelp = {
    decision: "Authorised approver selects Pending, Approved or Rejected.",
    "decision reason": "Authorised approver records a short reason for the decision.",
    "decided at": "Authorised approver records ISO 8601 date-time, for example 2026-07-26T14:00:00+05:30.",
  }
  const requests = headers.flatMap((header, index) => {
    const editable = humanInput.has(header)
    const note = editable
      ? `HUMAN APPROVER INPUT. ${formatHelp[header]}`
      : "AUTO-DERIVED / SYSTEM LINK. Reused across every dashboard mode; Operations should not enter this value again."
    return [
      { repeatCell: { range: { sheetId: approvalSheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { note }, fields: "note" } },
      { repeatCell: { range: { sheetId: approvalSheet.properties.sheetId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: editable ? { red: 1, green: 0.949, blue: 0.8 } : { red: 0.88, green: 0.93, blue: 1 } } }, fields: "userEnteredFormat.backgroundColor" } },
    ]
  })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  const guide = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K" })).data.values || []
  const guideRows = headers.map((header) => {
    const editable = humanInput.has(header)
    return [
      "Approval_Log",
      header,
      "One row per governed decision; linked action id must match Action_Log",
      editable ? "When the authorised approver decides" : "Created automatically with the approval request",
      editable ? formatHelp[header] : "System-generated or copied from the linked Action_Log/source record",
      "All modes",
      "Your Sign-Off; Human approvals; Finance approvals; governed approval tables",
      editable ? "HUMAN APPROVER INPUT" : "AUTO-DERIVED / SYSTEM",
      editable ? formatHelp[header] : "Do not fill again. The same Approval_Log row drives every matching dashboard component.",
      editable ? (header === "decision" ? "Approved" : header === "decision reason" ? "Approved within cash guardrail" : "2026-07-26T14:00:00+05:30") : "Generated from the approval request",
      editable ? "Visible and highlighted yellow" : "Visible/read-only and highlighted blue",
    ]
  })
  const existing = new Map(guide.slice(1).map((row, offset) => [`${row[0]}|${row[1]}`, offset + 2]))
  const updates = guideRows.filter((row) => existing.has(`${row[0]}|${row[1]}`)).map((row) => ({ range: `DATA_ENTRY_GUIDE!A${existing.get(`${row[0]}|${row[1]}`)}:K${existing.get(`${row[0]}|${row[1]}`)}`, values: [row] }))
  const missing = guideRows.filter((row) => !existing.has(`${row[0]}|${row[1]}`))
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: updates } })
  if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: missing } })
  return { humanInputColumns: [...humanInput], systemColumns: headers.filter((header) => !humanInput.has(header)), guideRowsAdded: missing.length, guideRowsUpdated: updates.length }
}

function columnName(index) {
  let value = index + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

main().catch((error) => {
  console.error(error?.response?.data || error)
  process.exit(1)
})
