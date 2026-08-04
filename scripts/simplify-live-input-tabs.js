require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const RED = { red: 0.8, green: 0.02, blue: 0.02 }
const WHITE = { red: 1, green: 1, blue: 1 }
const normal = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

const specs = [
  { source: "TEAM_FINANCE_DAILY", target: "Finance_Daily", manual: new Set(["business date", "reporting month", "theatre id", "studio id", "opex mtd inr", "opex forecast inr", "opex cap inr", "cash balance inr", "cash target inr", "cm target inr", "destination approved", "destination owner actor id", "decision due at", "cm1 inr", "cm2 inr", "reported by actor id", "notes"]) },
  { source: "TEAM_MEMBER_ACTIVATION", target: "Member_Activation", manual: new Set(["member token", "activated at", "reporting month", "theatre id", "studio id", "nest id", "demand id", "enterprise id", "work assignment id", "membership billed inr", "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status"]) },
  { source: "TEAM_REQ_PEOPLE_ROSTER", target: "People_Roster", manual: new Set(["display name", "role", "reporting month", "theatre id", "studio id", "manager actor id", "active shift", "shift start at", "shift end at", "language"]) },
  { source: "TEAM_LEARNING_HISTORY", target: "Learning_History", manual: new Set(["reporting month", "domain", "observed", "proposed change", "expected effect", "attribution", "evidence", "confidence", "disposition", "notes"]) },
]

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const backendId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId || !backendId) throw new Error("Google Sheet IDs are not configured")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const [metadata, backend] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties)" }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId: backendId, ranges: specs.map((s) => `'${s.target}'!1:1`) }),
  ])
  const props = new Map((metadata.data.sheets || []).map((s) => [s.properties.title, s.properties]))
  const results = []

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const property = props.get(spec.source)
    if (!property) throw new Error(`Missing tab ${spec.source}`)
    const canonical = (backend.data.valueRanges[i].values?.[0] || []).map(String)
    if (!canonical.length) throw new Error(`Missing canonical headers for ${spec.target}`)
    const sample = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${spec.source}'!A1:AZ8` })).data.values || []
    let headerIndex = sample.findIndex((row) => {
      const found = new Set(row.map(normal))
      return canonical.filter((header) => found.has(normal(header))).length >= Math.min(4, canonical.length)
    })
    if (headerIndex < 0) throw new Error(`Canonical header row not found in ${spec.source}`)
    if (headerIndex > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId: property.sheetId, dimension: "ROWS", startIndex: 0, endIndex: headerIndex } } }] } })
    }
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${spec.source}'!A1`, valueInputOption: "RAW", requestBody: { values: [canonical] } })
    const requests = [
      { clearBasicFilter: { sheetId: property.sheetId } },
      { updateSheetProperties: { properties: { sheetId: property.sheetId, tabColor: BLACK, gridProperties: { frozenRowCount: 1 } }, fields: "tabColor,gridProperties.frozenRowCount" } },
      { updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 54 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: canonical.length }, properties: { pixelSize: 155 }, fields: "pixelSize" } },
      { setBasicFilter: { filter: { range: { sheetId: property.sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: canonical.length } } } },
    ]
    canonical.forEach((header, column) => {
      const manual = spec.manual.has(normal(header))
      requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: manual ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: manual ? "BLACK = USER INPUT. Enter only this field." : "RED = AUTOMATED / SYSTEM. Do not edit this field." }, fields: "userEnteredFormat,note" } })
      const key = normal(header)
      if (["business date", "decision due at"].includes(key)) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } })
      if (["activated at", "verified at", "shift start at", "shift end at"].includes(key)) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } })
      if (key.endsWith(" inr")) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } })
      const choices = key === "destination approved" ? ["Yes", "No"] : key === "verification status" ? ["Pending", "Verified", "Rejected"] : key === "active shift" ? ["TRUE", "FALSE"] : key === "confidence" ? ["Low", "Medium", "High"] : key === "disposition" ? ["Proposed", "Approved", "Rejected", "Rolled back"] : null
      if (choices) requests.push({ setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: choices.map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } })
    })
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
    results.push({ tab: spec.source, removedExtraHeaderRows: headerIndex, black: canonical.filter((h) => spec.manual.has(normal(h))), red: canonical.filter((h) => !spec.manual.has(normal(h))) })
  }
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
