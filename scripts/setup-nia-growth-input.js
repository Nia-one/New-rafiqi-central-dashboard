require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "TEAM_NIA_GROWTH"
const headers = [
  "growth_record_id", "supply_model", "required_nests", "activation_ready_nests", "gap_nests",
  "owner_actor_id", "readiness_sla_days", "nia_filled_nests", "signed_contract_covered_nests",
  "readiness_status", "readiness_verified_at", "action_due_at", "evidence_url",
  "approval_decision", "policy_status", "policy_approved_by_actor_id",
  "learning_observation", "learning_proposal", "notes",
]
const manualHeaders = new Set([
  "readiness_sla_days", "nia_filled_nests", "readiness_verified_at", "action_due_at", "evidence_url",
  "verification_status", "approval_decision", "policy_status", "policy_approved_by_actor_id",
  "learning_proposal", "notes",
])
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const WHITE = { red: 1, green: 1, blue: 1 }
const GREY = { red: 0.88, green: 0.9, blue: 0.93 }

function credentials() {
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  let sheet = (metadata.data.sheets || []).find((entry) => entry.properties?.title === TAB)
  if (!sheet) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 200, columnCount: headers.length, frozenRowCount: 3 }, tabColorStyle: { rgbColor: BLACK } } } }] } })
    sheet = added.data.replies?.[0]?.addSheet
  }
  const sheetId = sheet?.properties?.sheetId
  if (sheetId == null) throw new Error(`${TAB} could not be resolved`)

  const values = [
    ["NIA GROWTH — LIVE INPUT", "Black cells are the only manual inputs. Grey cells calculate from Fono Funnel and Shram Park demand."],
    ["Flow", "User Input → automated sync → backend logs → Nia Growth dashboard. Do not enter data directly in the backend workbook."],
    headers,
    ["NIA-GROWTH-FONO", "FONO", "=SUM('Fono Funnel'!H3:H)", "=SUM('Fono Funnel'!J3:J)", "=MAX(0,C4-D4)", "=IFERROR(\"ACT-\"&REGEXREPLACE(UPPER(INDEX(FILTER(TEAM_OWNER_REGISTRY!F:F,TEAM_OWNER_REGISTRY!B:B=\"FONO Supply\",TEAM_OWNER_REGISTRY!E:E=\"Owner\",TEAM_OWNER_REGISTRY!J:J=\"Active\"),1)),\"[^A-Z0-9]+\",\"-\"),\"ACT-UNASSIGNED\")", "", "", "", "=IF(C4=0,\"Not reviewed\",IF(E4=0,\"Ready\",\"In progress\"))", "=IF(N4=\"Verified\",TODAY(),\"\")", "", "", "=IF(AND(C4>0,D4>=C4,O4=\"Approved\"),\"Verified\",\"Pending\")", "Pending", "Draft", "", "=\"FONO has \"&E4&\" Nest gap: \"&D4&\" activation-ready against \"&C4&\" required.\"", "", ""],
    ["NIA-GROWTH-SP", "SP", "=SUMIF('TEAM_SHRAMPARK_DEMAND'!O2:O,\"Y\",'TEAM_SHRAMPARK_DEMAND'!R2:R)", "=SUMIF('TEAM_SHRAMPARK_DEMAND'!O2:O,\"Y\",'TEAM_SHRAMPARK_DEMAND'!X2:X)", "=MAX(0,C5-D5)", "=IF(COUNTIFS(TEAM_OWNER_REGISTRY!B:B,\"SP Supply\",TEAM_OWNER_REGISTRY!E:E,\"Owner\",TEAM_OWNER_REGISTRY!J:J,\"Active\")>0,\"ACT-SP-THEATRE-OWNERS\",\"ACT-UNASSIGNED\")", "", "", "=IFERROR(SUM(FILTER('TEAM_SHRAMPARK_DEMAND'!R2:R,REGEXMATCH(LOWER('TEAM_SHRAMPARK_DEMAND'!S2:S),\"won|contracted|agreement signed\"),REGEXMATCH(LOWER('TEAM_SHRAMPARK_DEMAND'!O2:O),\"^y(es)?$\"))),0)", "=IF(C5=0,\"Not reviewed\",IF(E5=0,\"Ready\",\"In progress\"))", "=IF(N5=\"Verified\",TODAY(),\"\")", "", "", "=IF(AND(C5>0,D5>=C5,O5=\"Approved\"),\"Verified\",\"Pending\")", "Pending", "Draft", "", "=\"SP has \"&E5&\" Nest gap: \"&D5&\" activation-ready against \"&C5&\" required.\"", "", ""],
  ]
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${TAB}'!A1`, valueInputOption: "USER_ENTERED", requestBody: { values } })

  const manualColumns = headers.map((header, index) => ({ header, index })).filter(({ header }) => manualHeaders.has(header))
  const autoColumns = headers.map((header, index) => ({ header, index })).filter(({ header }) => !manualHeaders.has(header))
  const requests = [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 3 }, tabColorStyle: { rgbColor: BLACK } }, fields: "gridProperties.frozenRowCount,tabColorStyle" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 12 }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    ...manualColumns.map(({ header, index }) => ({ repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE }, wrapStrategy: "WRAP" }, note: `BLACK = USER INPUT. Enter ${header === "nia_filled_nests" ? "Nia target / planned fill Nests (not verified actuals)" : header.replaceAll("_", " ")} here; never edit the backend workbook.` }, fields: "userEnteredFormat,note" } })),
    ...autoColumns.map(({ index }) => ({ repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: GREY }, note: "AUTOMATED / DO NOT TYPE. Calculated from connected User Input tabs." }, fields: "userEnteredFormat.backgroundColor,note" } })),
    { setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: headers.indexOf("readiness_status"), endColumnIndex: headers.indexOf("readiness_status") + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Not reviewed", "Blocked", "In progress", "Ready"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: headers.indexOf("verification_status"), endColumnIndex: headers.indexOf("verification_status") + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Pending", "Verified", "Rejected", "Stale"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: headers.indexOf("approval_decision"), endColumnIndex: headers.indexOf("approval_decision") + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Pending", "Approved", "Declined"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: headers.indexOf("policy_status"), endColumnIndex: headers.indexOf("policy_status") + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Draft", "Approved", "Inactive"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length } } },
  ]
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ spreadsheetId, tab: TAB, rows: ["FONO", "SP"], automated: [...autoColumns.map((item) => item.header)], manualBlack: [...manualColumns.map((item) => item.header)] }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
