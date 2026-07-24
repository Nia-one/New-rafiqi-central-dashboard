require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const MANUAL_COLUMNS = {
  Theatre_Master: ["theatre id", "theatre name", "theatre code", "active", "lead actor id", "geography", "updated at"],
  Studio_Master: ["studio id", "theatre id", "studio name", "address", "latitude", "longitude", "operating model", "supply model", "contract status", "readiness status", "contracted nests", "activation ready nests", "active", "updated at"],
  People_Roster: ["actor id", "display name", "role", "theatre id", "studio id", "manager actor id", "active shift", "shift start at", "shift end at", "language", "last heartbeat at", "next heartbeat due at", "updated at"],
  Enterprise_Demand: ["demand id", "enterprise id", "enterprise name", "plant id", "plant name", "latitude", "longitude", "role required", "skill required", "shift", "headcount required", "headcount matched", "activation required at", "certainty", "status", "owner actor id", "opened at", "updated at"],
  Member_Activation: ["activation id", "member token", "activated at", "theatre id", "studio id", "nest id", "demand id", "enterprise id", "membership billed inr", "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status"],
  Hourly_Heartbeat: ["heartbeat id", "actor id", "role", "theatre id", "studio id", "window start at", "window end at", "captured at", "trigger type", "new or changed demand", "open headcount", "matched headcount", "contracted nests", "activation ready nests", "occupied nests", "activations last hour", "membership ends last hour", "primary blocker", "next action", "next action owner actor id", "next action due at"],
  Incident_Log: ["incident id", "domain", "incident type", "event at", "theatre id", "studio id", "short description", "impacted members", "impacted nests", "amount at risk inr", "severity", "severity reason", "owner actor id", "due at", "action required", "approval required", "state", "reported by actor id", "reported at"],
  Action_Log: ["action id", "incident id", "operating objective", "expected metric", "baseline value", "target value", "expected financial impact inr", "confidence", "owner actor id", "due at", "required evidence", "approval tier", "state", "proposed at"],
  Evidence_Log: ["evidence id", "linked type", "linked id", "evidence type", "protected url", "uploaded by actor id", "uploaded at", "description", "verification status"],
  Approval_Log: ["approval id", "linked action id", "decision type", "amount inr", "current terms", "proposed terms", "business reason", "expected result", "approver role", "decision", "decision reason", "decided at"],
  Living_Hourly: ["living hourly id", "heartbeat id", "theatre id", "studio id", "supply model", "contracted nests", "activation ready nests", "occupied nests", "activations last hour", "membership ends last hour", "living billed inr", "living collected inr", "collection leakage inr", "occupancy ratio", "open service requests", "primary blocker", "next action", "next action owner actor id", "next action due at"],
  Work_Hourly: ["work hourly id", "heartbeat id", "theatre id", "enterprise id", "demand id", "open headcount", "matched headcount", "members joined last hour", "attendance exceptions", "work exits", "redeployment needed", "work billed inr", "work collected inr", "direct delivery cost inr", "primary blocker", "next action", "next action owner actor id", "next action due at", "captured at"],
  Essentials_Hourly: ["essentials hourly id", "heartbeat id", "theatre id", "studio id", "eligible members", "buying members", "orders placed", "orders fulfilled", "current stockouts", "zero sale skus", "essentials billed inr", "essentials collected inr", "product cogs inr", "direct fulfilment cost inr", "member savings inr", "nia margin inr", "primary blocker", "next action", "next action owner actor id", "next action due at", "updated at", "captured at"],
  Finance_Daily: ["finance daily id", "business date", "theatre id", "living billed inr", "living collected inr", "work billed inr", "work collected inr", "essentials billed inr", "essentials collected inr", "opex mtd inr", "opex forecast inr", "opex cap status", "cash balance inr", "cash guardrail status", "pending pushkar approvals", "settlement exceptions", "reconciliation status", "cm1 inr", "cm2 inr", "reported by actor id", "reported at", "updated at"],
}

const GUIDANCE = [
  ["Theatre_Master", "Theatre setup", "One row per theatre", "Update when a theatre/lead changes", "IDs: text; active: TRUE/FALSE; updated at: ISO timestamp"],
  ["Studio_Master", "Studio supply and readiness", "One row per studio", "Update on readiness or capacity change", "Nests/costs: number; latitude/longitude: decimal; status: approved list"],
  ["People_Roster", "Team ownership and shifts", "One row per active person", "Update at shift/owner change", "Times: ISO timestamp; role/status: approved list"],
  ["Enterprise_Demand", "Signed/live employer demand", "One row per demand", "Update on every demand change", "Headcount: whole number; activation: ISO timestamp"],
  ["Member_Activation", "Verified member activation", "One row per activation", "Append when billing is verified", "Money: INR number; evidence: secure URL/reference"],
  ["Hourly_Heartbeat", "Operations heartbeat", "One row per owner/window", "Every operating hour", "Counts: whole number; captured/due times: ISO timestamp"],
  ["Living_Hourly", "Living performance", "One row per studio/hour", "Every operating hour", "Occupancy ratio: 0–1; money: INR number"],
  ["Work_Hourly", "Work performance", "One row per demand/hour", "Every operating hour", "Counts/money: number; captured at: ISO timestamp"],
  ["Essentials_Hourly", "Essentials performance", "One row per studio/hour", "Every operating hour", "Counts/money: number; captured at: ISO timestamp"],
  ["Finance_Daily", "Finance control", "One row per theatre/day", "Daily after reconciliation", "Money: INR number; business date: YYYY-MM-DD"],
  ["Incident_Log", "Exceptions and blockers", "One row per incident", "Immediately when detected", "Severity/state: approved list; due/event at: ISO timestamp"],
  ["Action_Log", "Action ownership and proof", "One row per action", "Append/update with each state change", "Metric values: number; due at: ISO timestamp"],
  ["Evidence_Log", "Independent proof", "One row per evidence item", "Append when proof is submitted", "Use protected URL/reference; uploaded at: ISO timestamp"],
  ["Approval_Log", "Human decisions", "One row per decision", "Append when decided", "Amounts: INR number; decision: Approved/Rejected"],
]

const RECORDS = {
  Theatre_Master: [{ "theatre id": "THR-CHN", "theatre name": "Coromandel (Tamil Nadu)", "theatre code": "CHN", active: "TRUE", "lead actor id": "ACT-PRIYA", geography: "Chennai", "updated at": "2026-07-22T14:00:00+05:30", "source id": "SRC-TEST" }],
  Studio_Master: [
    { "studio id": "STU-SRI-01", "theatre id": "THR-CHN", "studio name": "Sriperumbudur 01", address: "Sriperumbudur Industrial Area", latitude: "12.9676", longitude: "79.9428", "operating model": "Managed", "supply model": "FONO", "contract status": "Signed", "readiness status": "In progress", "contracted nests": "120", "activation ready nests": "96", active: "TRUE", "updated at": "2026-07-22T14:00:00+05:30", "source id": "SRC-TEST" },

    { "studio id": "STU-SP-01", "theatre id": "THR-CHN", "studio name": "Sriperumbudur SP 01", address: "Sriperumbudur Industrial Area", latitude: "12.9680", longitude: "79.9435", "operating model": "Managed", "supply model": "SP", "contract status": "Signed", "readiness status": "Ready", "contracted nests": "200", "activation ready nests": "150", active: "TRUE", "updated at": "2026-07-22T14:00:00+05:30", "source id": "SRC-TEST" }
  ],
  People_Roster: [{ "actor id": "ACT-PRIYA", "display name": "Priya Rao (Test)", role: "Demand JCO", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "active shift": "Day", "shift start at": "2026-07-22T09:00:00+05:30", "shift end at": "2026-07-22T18:00:00+05:30", language: "English", "last heartbeat at": "2026-07-22T13:45:00+05:30", "next heartbeat due at": "2026-07-22T14:45:00+05:30", "updated at": "2026-07-22T14:00:00+05:30" }],
  Enterprise_Demand: [{ "demand id": "DEM-TEST-001", "enterprise id": "ENT-TEST-001", "enterprise name": "Test Manufacturing Co.", "plant id": "PLANT-TEST-001", "plant name": "Sriperumbudur Test Plant", latitude: "12.9650", longitude: "79.9430", "role required": "Assembly operator", "skill required": "General", shift: "Day", "headcount required": "80", "headcount matched": "54", "headcount remaining": "26", "wage inr": "18000", "activation required at": "2026-07-29T09:00:00+05:30", certainty: "Confirmed", status: "Open", "owner actor id": "ACT-PRIYA", "opened at": "2026-07-22T10:00:00+05:30", "age hours": "4", "updated at": "2026-07-22T14:00:00+05:30" }],
  Member_Activation: [{ "activation id": "ACTV-TEST-001", "member token": "TEST-MEMBER-001", "activated at": "2026-07-22T13:00:00+05:30", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "nest id": "NEST-001", "demand id": "DEM-TEST-001", "enterprise id": "ENT-TEST-001", "membership billed inr": "1500", "membership collected inr": "1500", "activation evidence url": "test://evidence/activation-001", "verified at": "2026-07-22T13:30:00+05:30", "verified by": "ACT-PRIYA", "verification status": "Verified" }],
  Hourly_Heartbeat: [{ "heartbeat id": "HB-TEST-001", "actor id": "ACT-PRIYA", role: "Demand JCO", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "window start at": "2026-07-22T13:00:00+05:30", "window end at": "2026-07-22T14:00:00+05:30", "captured at": "2026-07-22T14:00:00+05:30", "trigger type": "Hourly", "new or changed demand": "26", "open headcount": "26", "matched headcount": "54", "contracted nests": "120", "activation ready nests": "96", "occupied nests": "72", "activations last hour": "3", "membership ends last hour": "1", "primary blocker": "26 arrivals need matched beds", "next action": "Confirm nearby readiness", "next action owner actor id": "ACT-PRIYA", "next action due at": "2026-07-22T16:00:00+05:30" }],
  Living_Hourly: [
    { "living hourly id": "LIV-TEST-001", "heartbeat id": "HB-TEST-001", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "supply model": "FONO", "contracted nests": "120", "activation ready nests": "96", "occupied nests": "72", "activations last hour": "3", "membership ends last hour": "1", "living billed inr": "108000", "living collected inr": "105000", "collection leakage inr": "3000", "occupancy ratio": "0.75", "open service requests": "2", "primary blocker": "24 ready nests remain vacant", "next action": "Allocate demand to ready nests", "next action owner actor id": "ACT-PRIYA", "next action due at": "2026-07-22T16:00:00+05:30" },

    { "living hourly id": "LIV-TEST-002", "heartbeat id": "HB-TEST-001", "theatre id": "THR-CHN", "studio id": "STU-SP-01", "supply model": "SP", "contracted nests": "200", "activation ready nests": "150", "occupied nests": "110", "activations last hour": "6", "membership ends last hour": "2", "living billed inr": "165000", "living collected inr": "160000", "collection leakage inr": "5000", "occupancy ratio": "0.73", "open service requests": "1", "primary blocker": "Hardware readiness", "next action": "Complete park readiness", "next action owner actor id": "ACT-PRIYA", "next action due at": "2026-07-22T18:00:00+05:30" }
  ],
  Work_Hourly: [{ "work hourly id": "WRK-TEST-001", "heartbeat id": "HB-TEST-001", "theatre id": "THR-CHN", "enterprise id": "ENT-TEST-001", "demand id": "DEM-TEST-001", "open headcount": "26", "matched headcount": "54", "members joined last hour": "3", "attendance exceptions": "2", "work exits": "1", "redeployment needed": "2", "work billed inr": "54000", "work collected inr": "51000", "direct delivery cost inr": "12000", "primary blocker": "Two attendance exceptions", "next action": "Contact shift supervisor", "next action owner actor id": "ACT-PRIYA", "next action due at": "2026-07-22T15:00:00+05:30", "captured at": "2026-07-22T14:00:00+05:30" }],
  Essentials_Hourly: [{ "essentials hourly id": "ESS-TEST-001", "heartbeat id": "HB-TEST-001", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "eligible members": "72", "buying members": "31", "orders placed": "38", "orders fulfilled": "35", "current stockouts": "1", "zero sale skus": "4", "essentials billed inr": "9500", "essentials collected inr": "9100", "product cogs inr": "4800", "direct fulfilment cost inr": "1200", "member savings inr": "2400", "nia margin inr": "3500", "primary blocker": "One essential SKU stockout", "next action": "Replenish high-demand SKU", "next action owner actor id": "ACT-PRIYA", "next action due at": "2026-07-22T17:00:00+05:30", "updated at": "2026-07-22T14:00:00+05:30", "captured at": "2026-07-22T14:00:00+05:30" }],
  Finance_Daily: [{ "finance daily id": "FIN-TEST-001", "business date": "2026-07-22", "theatre id": "THR-CHN", "living billed inr": "108000", "living collected inr": "105000", "work billed inr": "54000", "work collected inr": "51000", "essentials billed inr": "9500", "essentials collected inr": "9100", "total billed inr": "171500", "total collected inr": "165100", "current due inr": "6400", "overdue inr": "2000", "opex mtd inr": "69000", "opex forecast inr": "98000", "opex cap status": "Active", "cash balance inr": "245000", "cash guardrail status": "Active", "pending pushkar approvals": "1", "settlement exceptions": "1", "reconciliation status": "Pending", "cm1 inr": "62500", "cm2 inr": "43000", "reported by actor id": "ACT-PRIYA", "reported at": "2026-07-22T14:00:00+05:30", "updated at": "2026-07-22T14:00:00+05:30" }],
  Incident_Log: [{ "incident id": "INC-TEST-001", domain: "Living", "incident type": "Readiness gap", "event at": "2026-07-22T14:00:00+05:30", "theatre id": "THR-CHN", "studio id": "STU-SRI-01", "short description": "24 ready nests are vacant", "impacted members": "26", "impacted nests": "24", "amount at risk inr": "36000", severity: "High", "severity reason": "Arrival date within seven days", "owner actor id": "ACT-PRIYA", "due at": "2026-07-22T16:00:00+05:30", "action required": "TRUE", "approval required": "FALSE", state: "Open", "reported by actor id": "ACT-PRIYA", "reported at": "2026-07-22T14:00:00+05:30" }],
  Action_Log: [{ "action id": "ACTION-TEST-001", "incident id": "INC-TEST-001", "operating objective": "Allocate demand to ready nests", "expected metric": "Occupied nests", "baseline value": "72", "target value": "96", "expected financial impact inr": "36000", confidence: "Confirmed", "owner actor id": "ACT-PRIYA", "due at": "2026-07-22T16:00:00+05:30", "required evidence": "Verified activation records", "approval tier": "Auto", state: "Detected", "proposed at": "2026-07-22T14:00:00+05:30" }],
  Evidence_Log: [{ "evidence id": "EVD-TEST-001", "linked type": "Action", "linked id": "ACTION-TEST-001", "evidence type": "Document reference", "protected url": "test://evidence/readiness-001", "uploaded by actor id": "ACT-PRIYA", "uploaded at": "2026-07-22T14:00:00+05:30", description: "Test readiness confirmation", "verification status": "Pending" }],
  Approval_Log: [{ "approval id": "APR-TEST-001", "linked action id": "ACTION-TEST-001", "decision type": "Financial exception", "amount inr": "36000", "current terms": "Existing allocation", "proposed terms": "Temporary reallocation", "business reason": "Close readiness gap", "expected result": "24 nests occupied", "approver role": "Pushkar", decision: "Approved", "decision reason": "Test approval", "decided at": "2026-07-22T14:00:00+05:30" }],
}

function rowFor(headers, values) { return headers.map((header) => values[header] ?? "") }

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title),data.rowData.values.effectiveValue)" })
  const sheetByTitle = new Map((workbook.data.sheets || []).map((sheet) => [sheet.properties.title, sheet]))

  for (const [tab, records] of Object.entries(RECORDS)) {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` })
    const rows = values.data.values || []
    const headers = rows[0] || []

const existingIds = new Set(
  rows.slice(1).map(r => r[0]).filter(Boolean)
)

const newRecords = records.filter(r => {
  const id = r[headers[0]]
  return id && !existingIds.has(id)
})

if (!newRecords.length) {
  console.log(`${tab}: nothing to append`)
  continue
}

await sheets.spreadsheets.values.append({
  spreadsheetId,
  range: `${tab}!A2`,
  valueInputOption: "USER_ENTERED",
  requestBody: {
    values: newRecords.map(record => rowFor(headers, record))
  }
})

console.log(`${tab}: appended ${newRecords.length} row(s)`)
continue
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: records.map((record) => rowFor(headers, record)) } })
    console.log(`${tab}: test row added`)
  }

  const guideTitle = "DATA_ENTRY_GUIDE"
  if (!sheetByTitle.has(guideTitle)) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: guideTitle } } }] } })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${guideTitle}!A1`, valueInputOption: "RAW", requestBody: { values: [["TAB", "WHAT OPERATIONS ENTERS", "ROW RULE", "UPDATE RHYTHM", "FORMAT"], ...GUIDANCE] } })

  const requests = []
  for (const [tab, columns] of Object.entries(MANUAL_COLUMNS)) {
    const sheet = sheetByTitle.get(tab)
    if (!sheet) continue
    const headers = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!1:1` })).data.values?.[0] || []
    for (const column of columns) {
      const columnIndex = headers.indexOf(column)
      if (columnIndex >= 0) requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 501, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.65 } } }, fields: "userEnteredFormat.backgroundColor" } })
    }
  }
  const guide = (await sheets.spreadsheets.get({ spreadsheetId, ranges: ["DATA_ENTRY_GUIDE!A1:E20"], includeGridData: false, fields: "sheets.properties" })).data.sheets?.[0]
  if (guide) requests.push({ repeatCell: { range: { sheetId: guide.properties.sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.18, green: 0.36, blue: 0.55 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } })
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log("Yellow columns are Operations-editable test/data-entry fields. DATA_ENTRY_GUIDE explains each tab.")
}

main().catch((error) => { console.error(error); process.exit(1) })




