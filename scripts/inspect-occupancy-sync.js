require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const result = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: process.env.GOOGLE_TEAM_INPUT_SHEET_ID,
    ranges: ["Studios!A1:W160", "TEAM_OCCUPANCY!A1:W160"],
  })
  const [studios = [], occupancy = []] = (result.data.valueRanges || []).map((range) => range.values || [])
  const backend = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "Living_Hourly!A1:AZ" })
  const backendRows = backend.data.values || []
  const backendHeaders = backendRows[0] || []
  const backendIdIndex = backendHeaders.indexOf("living hourly id")
  const backendSupplyIndex = backendHeaders.indexOf("supply model")
  const occupancyBackendRows = backendRows.slice(1).filter((row) => String(row[backendIdIndex] || "").startsWith("OPS-RPT-OCC"))
  const activeSourceRows = studios.slice(3).filter((row) => String(row[2] || "").trim() && String(row[4] || "").trim().toLowerCase() === "active")
  console.log(JSON.stringify({
    studiosRows: studios.length,
    occupancyRows: occupancy.length,
    sourceRecords: studios.slice(3).filter((row) => String(row[2] || "").trim()).length,
    activeSourceRecords: activeSourceRows.length,
    mirroredRecords: occupancy.slice(1).filter((row) => String(row[2] || "").trim()).length,
    nonExistingMirrorRows: occupancy.slice(1).filter((row) => String(row[2] || "").trim() && String(row[20] || "") !== "EXISTING").length,
    backendOccupancyRecords: occupancyBackendRows.length,
    nonExistingBackendRows: occupancyBackendRows.filter((row) => String(row[backendSupplyIndex] || "") !== "EXISTING").length,
    missingAutomatedIds: occupancy.slice(1).filter((row) => String(row[2] || "").trim() && !String(row[17] || "").trim()).length,
    manualActivationReadyValues: occupancy.slice(1).filter((row) => String(row[22] || "").trim()).length,
    firstSource: (studios[3] || []).slice(0, 17),
    firstMirror: (occupancy[1] || []).slice(0, 17),
    studioCodes: studios.slice(3).map((row, index) => ({ row: index + 4, a: row[0], b: row[1], c: row[2], d: row[3] })).filter((row) => row.c),
    occupancyTail: occupancy.slice(60).map((row, index) => ({ row: index + 61, theatre: row[1], code: row[2], name: row[3] })),
  }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
