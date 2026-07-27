require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const FROM_STUDIO_ID = "STU-SRI-01"
const TO_STUDIO_ID = "CRM-SRI-D01-S01"
const TARGETS = Object.freeze([
  { tab: "Living_Hourly", idHeader: "living hourly id", ids: new Set(["LIV-TEST-001"]), studioHeader: "studio id" },
  { tab: "Member_Activation", idHeader: "activation id", ids: new Set(["ACTV-TEST-001"]), studioHeader: "studio id" },
  { tab: "Incident_Log", idHeader: "incident id", ids: new Set(["INC-TEST-001", "ENT-CALL-INC-TEST-001"]), studioHeader: "studio id" },
])

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
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured.")

  const studioResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Studio_Master!A:AZ" })
  const studioValues = studioResponse.data.values || []
  const studioHeaders = studioValues[0] || []
  const studioIdIndex = studioHeaders.indexOf("studio id")
  const activeIndex = studioHeaders.indexOf("active")
  const officialStudio = studioValues.slice(1).find((row) => String(row[studioIdIndex] || "").trim() === TO_STUDIO_ID)
  if (!officialStudio) throw new Error(`${TO_STUDIO_ID} is missing from Studio_Master.`)
  if (activeIndex >= 0 && !["true", "yes", "1", "active"].includes(String(officialStudio[activeIndex] || "").trim().toLowerCase())) {
    throw new Error(`${TO_STUDIO_ID} is not active in Studio_Master.`)
  }

  const updates = []
  for (const target of TARGETS) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${target.tab}!A:AZ` })
    const values = response.data.values || []
    const headers = values[0] || []
    const idIndex = headers.indexOf(target.idHeader)
    const studioIndex = headers.indexOf(target.studioHeader)
    if (idIndex < 0 || studioIndex < 0) throw new Error(`${target.tab} is missing an existing required header.`)

    values.slice(1).forEach((row, index) => {
      const id = String(row[idIndex] || "").trim()
      const studioId = String(row[studioIndex] || "").trim()
      if (!target.ids.has(id)) return
      if (studioId !== FROM_STUDIO_ID && studioId !== TO_STUDIO_ID) {
        throw new Error(`${target.tab} ${id} has unexpected Studio ID ${studioId}; refusing to overwrite it.`)
      }
      if (studioId === TO_STUDIO_ID) return
      updates.push({ range: `${target.tab}!${columnLabel(studioIndex + 1)}${index + 2}`, values: [[TO_STUDIO_ID]] })
    })
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    })
  }

  const verification = []
  for (const target of TARGETS) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${target.tab}!A:AZ` })
    const values = response.data.values || []
    const headers = values[0] || []
    const idIndex = headers.indexOf(target.idHeader)
    const studioIndex = headers.indexOf(target.studioHeader)
    for (const row of values.slice(1)) {
      const id = String(row[idIndex] || "").trim()
      if (!target.ids.has(id)) continue
      const studioId = String(row[studioIndex] || "").trim()
      if (studioId !== TO_STUDIO_ID) throw new Error(`${target.tab} ${id} did not remap successfully.`)
      verification.push({ tab: target.tab, id, studioId })
    }
  }

  console.log(JSON.stringify({ updatedCells: updates.length, officialStudioId: TO_STUDIO_ID, verification }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
