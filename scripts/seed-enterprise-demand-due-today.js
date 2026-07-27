require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const rows = {
  Incident_Log: {
    "incident id": "ENT-CALL-INC-TEST-001",
    domain: "Enterprise Demand",
    "incident type": "Due-today readiness call",
    "event at": "2026-07-27T10:00:00+05:30",
    "theatre id": "THR-CHN",
    "studio id": "STU-SRI-01",
    "short description": "TEST DATA - confirm remaining enterprise demand readiness today",
    "impacted nests": 24,
    severity: "Medium",
    "severity reason": "Named enterprise arrival requires a current readiness confirmation",
    "owner actor id": "ACT-PRIYA",
    "due at": "2026-07-27T16:00:00+05:30",
    "action required": "TRUE",
    "approval required": "FALSE",
    state: "Open",
    "reported by actor id": "ACT-PRIYA",
    "reported at": "2026-07-27T10:00:00+05:30",
  },
  Action_Log: {
    "action id": "ENT-CALL-ACTION-TEST-001",
    "incident id": "ENT-CALL-INC-TEST-001",
    "operating objective": "Call Studio for enterprise demand readiness confirmation",
    "expected metric": "Activation ready nests",
    "baseline value": 96,
    "target value": 120,
    "expected financial impact inr": 36000,
    confidence: "Confirmed",
    "owner actor id": "ACT-PRIYA",
    "due at": "2026-07-27T16:00:00+05:30",
    "required evidence": "Current Studio readiness confirmation",
    "approval tier": "None",
    state: "Detected",
    "proposed at": "2026-07-27T10:00:00+05:30",
  },
}

const identityByTab = { Incident_Log: "incident id", Action_Log: "action id" }

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
  const result = {}

  for (const [tab, seed] of Object.entries(rows)) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` })
    const values = response.data.values || []
    const headers = values[0] || []
    const identity = identityByTab[tab]
    const identityIndex = headers.indexOf(identity)
    if (identityIndex < 0) throw new Error(`${tab} is missing existing identity header '${identity}'`)
    const rowIndex = values.slice(1).findIndex((row) => String(row[identityIndex] || "").trim() === seed[identity])
    const rowValues = headers.map((header) => seed[header] ?? "")
    if (rowIndex >= 0) {
      const sheetRow = rowIndex + 2
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A${sheetRow}:${columnLabel(headers.length)}${sheetRow}`, valueInputOption: "USER_ENTERED", requestBody: { values: [rowValues] } })
      result[tab] = { operation: "updated", row: sheetRow, id: seed[identity] }
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A:${columnLabel(headers.length)}`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [rowValues] } })
      result[tab] = { operation: "added", id: seed[identity] }
    }
  }

  const verification = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ["Incident_Log!A:AZ", "Action_Log!A:AZ"] })
  for (const range of verification.data.valueRanges || []) {
    const tab = String(range.range || "").split("!")[0].replaceAll("'", "")
    const values = range.values || []
    const headers = values[0] || []
    const identity = identityByTab[tab]
    const identityIndex = headers.indexOf(identity)
    const seed = rows[tab]
    const found = values.slice(1).find((row) => String(row[identityIndex] || "").trim() === seed[identity])
    if (!found) throw new Error(`Read-back verification failed for ${tab} ${seed[identity]}`)
    result[tab].verified = true
    result[tab].dueAt = found[headers.indexOf("due at")] || ""
    result[tab].state = found[headers.indexOf("state")] || ""
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
