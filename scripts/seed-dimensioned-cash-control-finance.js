require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TOTALS = {
  "living billed inr": 108000,
  "living collected inr": 105000,
  "work billed inr": 54000,
  "work collected inr": 51000,
  "essentials billed inr": 9500,
  "essentials collected inr": 9100,
  "total billed inr": 171500,
  "total collected inr": 165100,
  "current due inr": 6400,
  "overdue inr": 2000,
  "opex mtd inr": 69000,
  "opex forecast inr": 98000,
  "opex cap inr": 120000,
  "cash balance inr": 245000,
  "cm1 inr": 62500,
  "cm2 inr": 43000,
}

const split = (total, index, count) => Math.floor(total / count) + (index < total % count ? 1 : 0)
const rowFor = (headers, record) => headers.map((header) => record[header] ?? "")
const columnLabel = (oneBasedIndex) => {
  let value = oneBasedIndex
  let label = ""
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + value % 26) + label
    value = Math.floor(value / 26)
  }
  return label
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ["Finance_Daily!A:AZ", "Studio_Master!A:AZ", "People_Roster!A:AZ"] })
  const [financeValues = [], studioValues = [], peopleValues = []] = (response.data.valueRanges || []).map((range) => range.values || [])
  let financeHeaders = financeValues[0] || []
  const studioHeaders = studioValues[0] || []
  const peopleHeaders = peopleValues[0] || []
  const financeIdIndex = financeHeaders.indexOf("finance daily id")
  const existingFinanceIds = financeValues.slice(1).map((row) => String(row[financeIdIndex] || "")).filter(Boolean)
  if (existingFinanceIds.some((id) => !id.includes("TEST"))) throw new Error("Finance_Daily contains non-test rows; refusing to replace them with seed data.")
  if (!financeHeaders.includes("studio id")) {
    const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties.columnCount))" })
    const financeSheet = (workbook.data.sheets || []).find((sheet) => sheet.properties.title === "Finance_Daily")
    if (!financeSheet) throw new Error("Finance_Daily sheet was not found.")
    if (financeSheet.properties.gridProperties.columnCount < financeHeaders.length + 1) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: financeSheet.properties.sheetId, dimension: "COLUMNS", length: 1 } }] } })
    }
    const studioHeaderColumn = columnLabel(financeHeaders.length + 1)
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `Finance_Daily!${studioHeaderColumn}1`, valueInputOption: "RAW", requestBody: { values: [["studio id"]] } })
    financeHeaders = [...financeHeaders, "studio id"]
  }

  const studios = studioValues.slice(1)
    .map((row) => Object.fromEntries(studioHeaders.map((header, index) => [header, row[index] ?? ""])))
    .filter((row) => String(row.active).toUpperCase() === "TRUE")
    .sort((left, right) => String(left["studio id"]).localeCompare(String(right["studio id"])))
  if (!studios.length) throw new Error("No active Studio_Master rows found.")

  const now = new Date().toISOString()
  const businessDate = now.slice(0, 10)
  const records = studios.map((studio, index) => {
    const amounts = Object.fromEntries(Object.entries(TOTALS).map(([field, total]) => [field, split(total, index, studios.length)]))
    return {
      ...amounts,
      "finance daily id": `FIN-TEST-${String(index + 1).padStart(3, "0")}`,
      "business date": businessDate,
      "theatre id": studio["theatre id"],
      "studio id": studio["studio id"],
      "cash guardrail status": "Protected",
      "opex cap status": "Active",
      "pending pushkar approvals": index === 0 ? 1 : 0,
      "settlement exceptions": index === 0 ? 1 : 0,
      "reconciliation status": index === 0 ? "Pending" : "Reconciled",
      "reported by actor id": "ACT-PRIYA",
      "reported at": now,
      "source submission id": "SRC-CASH-CONTROL-DIMENSIONED-TEST",
      "updated at": now,
      notes: "TEST DATA - dimensioned by Studio_Master; replace through the normal Finance_Daily feed",
      "cash target inr": split(300000, index, studios.length),
      "destination approved": "FALSE",
      "destination owner actor id": "ACT-PRIYA",
      "decision due at": "2026-07-26T14:00:00+05:30",
    }
  })

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Finance_Daily!A2:AZ" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "Finance_Daily!A2", valueInputOption: "USER_ENTERED", requestBody: { values: records.map((record) => rowFor(financeHeaders, record)) } })

  const actorIndex = peopleHeaders.indexOf("actor id")
  const studioIndex = peopleHeaders.indexOf("studio id")
  const priyaRow = peopleValues.slice(1).findIndex((row) => String(row[actorIndex] || "") === "ACT-PRIYA")
  if (priyaRow >= 0 && studioIndex >= 0) await sheets.spreadsheets.values.update({ spreadsheetId, range: `People_Roster!${String.fromCharCode(65 + studioIndex)}${priyaRow + 2}`, valueInputOption: "RAW", requestBody: { values: [["CRM-SRI-D01-S01"]] } })

  const verify = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Finance_Daily!A:AZ" })
  const verifiedRows = verify.data.values || []
  const verifiedObjects = verifiedRows.slice(1).map((row) => Object.fromEntries(financeHeaders.map((header, index) => [header, row[index] ?? ""])))
  const sum = (field) => verifiedObjects.reduce((total, row) => total + Number(String(row[field] || 0).replace(/[^0-9.-]/g, "")), 0)
  for (const [field, expected] of Object.entries(TOTALS)) if (sum(field) !== expected) throw new Error(`${field} failed reconciliation: ${sum(field)} vs ${expected}`)
  if (verifiedObjects.length !== studios.length || verifiedObjects.some((row) => !row["studio id"] || !row["theatre id"])) throw new Error("Dimensioned Finance_Daily verification failed.")
  console.log(JSON.stringify({ rows: verifiedObjects.length, theatres: [...new Set(verifiedObjects.map((row) => row["theatre id"]))].sort(), totals: Object.fromEntries(Object.keys(TOTALS).map((field) => [field, sum(field)])), verified: true }))
}

main().catch((error) => { console.error(error); process.exit(1) })
