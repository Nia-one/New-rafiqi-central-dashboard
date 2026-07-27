require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TEST_STUDIOS = {
  "CRM-SRI-D01-S01": {
    latitude: "12.9660", longitude: "79.9440", "operating model": "FONO", "supply model": "FONO",
    "contract status": "Signed", "readiness status": "Verified ready", "contracted nests": "60", "activation ready nests": "40",
  },
  "CRM-SRI-D01-S09": {
    latitude: "12.9700", longitude: "79.9500", "operating model": "SP", "supply model": "SP",
    "contract status": "Signed", "readiness status": "Verified ready", "contracted nests": "50", "activation ready nests": "30",
  },
  "CRM-SRI-D01-S08": {
    latitude: "12.9900", longitude: "79.9700", "operating model": "FONO", "supply model": "FONO",
    "contract status": "Signed", "readiness status": "Activation ready", "contracted nests": "80", "activation ready nests": "50",
  },
}

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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Studio_Master!A:AZ" })
  const values = response.data.values || []
  const headers = values[0] || []
  const required = ["studio id", "latitude", "longitude", "operating model", "supply model", "contract status", "readiness status", "contracted nests", "activation ready nests", "updated at"]
  for (const header of required) if (!headers.includes(header)) throw new Error(`Studio_Master is missing required existing header: ${header}`)

  const updates = []
  const updatedAt = new Date().toISOString()
  for (let index = 1; index < values.length; index += 1) {
    const row = [...values[index]]
    const studioId = String(row[headers.indexOf("studio id")] || "").trim()
    const seed = TEST_STUDIOS[studioId]
    if (!seed) continue
    for (const [header, value] of Object.entries(seed)) row[headers.indexOf(header)] = value
    row[headers.indexOf("updated at")] = updatedAt
    updates.push({ range: `Studio_Master!A${index + 1}:${columnLabel(headers.length)}${index + 1}`, values: [headers.map((_, column) => row[column] ?? "")] })
  }
  if (updates.length !== Object.keys(TEST_STUDIOS).length) throw new Error(`Expected ${Object.keys(TEST_STUDIOS).length} matching studios; found ${updates.length}.`)
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: updates } })
  console.log(JSON.stringify({ updated: updates.length, studios: Object.keys(TEST_STUDIOS), updatedAt }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
