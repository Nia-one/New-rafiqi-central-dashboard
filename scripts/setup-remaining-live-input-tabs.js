require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const sourceId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const backendId = process.env.GOOGLE_SHEET_ID
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const RED = { red: 0.8, green: 0.02, blue: 0.02 }
const WHITE = { red: 1, green: 1, blue: 1 }

const specs = [
  {
    source: "TEAM_MEMBER_ACTIVATION", target: "Member_Activation",
    manual: new Set(["member token", "activated at", "theatre id", "studio id", "nest id", "demand id", "enterprise id", "work assignment id", "membership billed inr", "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status"]),
    help: "One row per billing-live Member activation. Use anonymised member token; verification requires evidence reference and verifier."
  },
  {
    source: "TEAM_REQ_PEOPLE_ROSTER", target: "People_Roster",
    manual: new Set(["display name", "role", "theatre id", "studio id", "manager actor id", "active shift", "shift start at", "shift end at", "language"]),
    help: "One row per active owner/person. Maintain identity, role, reporting line, location and shift only; heartbeat/status timestamps remain automated."
  },
  {
    source: "TEAM_LEARNING_HISTORY", target: "Learning_History",
    manual: new Set(["domain", "observed", "proposed change", "expected effect", "attribution", "evidence", "confidence", "disposition", "notes"]),
    help: "Record only evidence-backed learning. Proposed changes and disposition require governed human review; system IDs and timestamps are automatic."
  },
]
const normal = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const ranges = specs.map((spec) => `${spec.target}!1:1`)
  const [backend, metadata] = await Promise.all([
    sheets.spreadsheets.values.batchGet({ spreadsheetId: backendId, ranges }),
    sheets.spreadsheets.get({ spreadsheetId: sourceId, fields: "sheets.properties(sheetId,title,index)" }),
  ])
  const existing = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties]))
  const missing = specs.filter((spec) => !existing.has(spec.source))
  if (missing.length) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId: sourceId, requestBody: { requests: missing.map((spec) => ({ addSheet: { properties: { title: spec.source, tabColor: BLACK, gridProperties: { frozenRowCount: 3 } } } })) } })
    missing.forEach((spec, index) => existing.set(spec.source, added.data.replies[index].addSheet.properties))
  }
  const requests = []
  for (const [index, spec] of specs.entries()) {
    const headers = (backend.data.valueRanges[index].values?.[0] || []).map(String)
    if (!headers.length) throw new Error(`${spec.target} has no canonical headers`)
    const properties = existing.get(spec.source)
    const labels = headers.map((header) => `${header.replaceAll("_", " ").toUpperCase()}\n${spec.manual.has(normal(header)) ? "USER INPUT" : "AUTOMATED — DO NOT EDIT"}`)
    const descriptions = headers.map((header) => spec.manual.has(normal(header)) ? `BLACK — user enters ${header.replaceAll("_", " ")}. ${spec.help}` : `RED — automated/system field: ${header.replaceAll("_", " ")}. Do not edit.`)
    await sheets.spreadsheets.values.update({ spreadsheetId: sourceId, range: `'${spec.source}'!A1`, valueInputOption: "RAW", requestBody: { values: [labels, descriptions, headers] } })
    requests.push({ updateSheetProperties: { properties: { sheetId: properties.sheetId, tabColor: BLACK, gridProperties: { frozenRowCount: 3 } }, fields: "tabColor,gridProperties.frozenRowCount" } })
    headers.forEach((header, column) => {
      const manual = spec.manual.has(normal(header))
      requests.push({ repeatCell: { range: { sheetId: properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: manual ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: descriptions[column] }, fields: "userEnteredFormat,note" } })
      requests.push({ repeatCell: { range: { sheetId: properties.sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: manual ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: descriptions[column] }, fields: "userEnteredFormat,note" } })
      const key = normal(header)
      if (["activated at", "verified at", "shift start at", "shift end at"].includes(key)) requests.push({ repeatCell: { range: { sheetId: properties.sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } })
      if (["membership billed inr", "membership collected inr", "collection leakage inr"].includes(key)) requests.push({ repeatCell: { range: { sheetId: properties.sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } })
      const choices = key === "verification status" ? ["Pending", "Verified", "Rejected"] : key === "active shift" ? ["TRUE", "FALSE"] : key === "confidence" ? ["Low", "Medium", "High"] : key === "disposition" ? ["Proposed", "Approved", "Rejected", "Rolled back"] : null
      if (choices) requests.push({ setDataValidation: { range: { sheetId: properties.sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: choices.map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } })
    })
    requests.push({ updateDimensionProperties: { range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length }, properties: { pixelSize: 155 }, fields: "pixelSize" } })
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sourceId, requestBody: { requests } })
  await sheets.spreadsheets.values.update({ spreadsheetId: sourceId, range: "TEAM_DATA_ENTRY_HOME!A1:B12", valueInputOption: "RAW", requestBody: { values: [
    ["RAFIQI LIVE DATA ENTRY", "BLACK = enter data · RED = automated/do not edit"],
    ["Daily report", "Import the updated Business Performance Report tabs; no manual dashboard copy/paste."],
    ["Automatic sync", "Source sheets synchronize every 5 minutes. Dashboard reads the backend snapshot every minute. Refresh data forces an immediate end-to-end synchronization."],
    ["Finance", "Use TEAM_FINANCE_DAILY for cash, OPEX, CM target and approval inputs."],
    ["Member activation", "Use TEAM_MEMBER_ACTIVATION only for genuine billing-live, evidence-backed activations."],
    ["People", "Use TEAM_REQ_PEOPLE_ROSTER for active owners, roles, locations and shifts."],
    ["Learning", "Use TEAM_LEARNING_HISTORY only for evidence-backed observations and governed disposition."],
    ["Essentials bot", "Automated from Essentials bot source; do not duplicate bot transactions manually."],
    ["Shrampark bot", "Requires genuine company/location, headcount, activation date and valid latitude/longitude."],
    ["IDs", "Use the same Theatre, Studio and Actor IDs across all tabs."],
    ["Safety", "Never rename tabs/technical headers and never edit red columns."],
    ["Demo readiness", "All four required black tabs must contain valid production rows before full-mode verification."],
  ] } })
  console.log(JSON.stringify({ amended: specs.map((spec, index) => ({ tab: spec.source, target: spec.target, columns: backend.data.valueRanges[index].values?.[0]?.length || 0 })) }, null, 2))
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
