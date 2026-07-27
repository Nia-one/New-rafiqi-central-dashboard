require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const seeds = [
  {
    tab: "Incident_Log",
    identity: "incident id",
    row: {
      "incident id": "ENT-SPEC-INC-TEST-001",
      domain: "Enterprise Demand",
      "incident type": "Contracted readiness-spec deviation",
      "event at": "2026-07-27T11:00:00+05:30",
      "theatre id": "THR-CHN",
      "studio id": "STU-SP-01",
      "enterprise id": "ENT-TEST-001",
      "demand id": "DEM-TEST-001",
      "short description": "TEST DATA - readiness specification needs corrective evidence",
      "impacted nests": 50,
      severity: "High",
      "severity reason": "Contracted readiness specification is not independently confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-28T12:00:00+05:30",
      "action required": "TRUE",
      "approval required": "FALSE",
      state: "Open",
      "reported by actor id": "ACT-PRIYA",
    },
  },
  {
    tab: "Action_Log",
    identity: "action id",
    row: {
      "action id": "ENT-SPEC-ACTION-TEST-001",
      "incident id": "ENT-SPEC-INC-TEST-001",
      "operating objective": "Collect corrective readiness-spec evidence",
      "expected metric": "Spec-verified nests",
      "baseline value": 0,
      "target value": 50,
      "expected financial impact inr": 75000,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-28T12:00:00+05:30",
      "required evidence": "Contract-matched readiness-spec proof",
      "approval tier": "None",
      state: "In progress",
      "proposed at": "2026-07-27T11:00:00+05:30",
      "assigned at": "2026-07-27T11:05:00+05:30",
      "in progress at": "2026-07-27T11:10:00+05:30",
    },
  },
]

function columnLabel(oneBasedIndex) {
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
  const result = []

  for (const seed of seeds) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${seed.tab}!A:AZ` })
    const values = response.data.values || []
    const headers = values[0] || []
    const identityIndex = headers.indexOf(seed.identity)
    if (identityIndex < 0) throw new Error(`${seed.tab} is missing existing identity header '${seed.identity}'`)
    const existingIndex = values.slice(1).findIndex((row) => String(row[identityIndex] || "").trim() === seed.row[seed.identity])
    const rowValues = headers.map((header) => seed.row[header] ?? "")
    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${seed.tab}!A${sheetRow}:${columnLabel(headers.length)}${sheetRow}`, valueInputOption: "USER_ENTERED", requestBody: { values: [rowValues] } })
      result.push({ tab: seed.tab, operation: "updated", row: sheetRow, id: seed.row[seed.identity] })
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${seed.tab}!A:${columnLabel(headers.length)}`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [rowValues] } })
      result.push({ tab: seed.tab, operation: "added", id: seed.row[seed.identity] })
    }
  }

  for (const seed of seeds) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${seed.tab}!A:AZ` })
    const values = response.data.values || []
    const headers = values[0] || []
    const identityIndex = headers.indexOf(seed.identity)
    const found = values.slice(1).find((row) => String(row[identityIndex] || "").trim() === seed.row[seed.identity])
    if (!found) throw new Error(`Read-back verification failed for ${seed.tab} ${seed.row[seed.identity]}`)
    const resultRow = result.find((item) => item.tab === seed.tab)
    resultRow.verified = true
    resultRow.state = found[headers.indexOf("state")] || ""
    resultRow.dueAt = found[headers.indexOf("due at")] || ""
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
