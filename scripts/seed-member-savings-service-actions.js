require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const records = {
  Action_Log: {
    identity: "action id",
    row: {
      "action id": "SD-ACTION-SAV-TEST-001",
      "studio id": "CRM-SRI-D01-S01",
      "operating objective": "Approve Essentials pricing exception",
      "expected metric": "Member savings INR",
      "baseline value": 18000,
      "target value": 25000,
      "expected financial impact inr": 25000,
      confidence: "Confirmed",
      "owner actor id": "ACT-PRIYA",
      "due at": "2026-07-27T14:00:00+05:30",
      "next action": "Complete and submit Essentials pricing evidence",
      "required evidence": "Essentials pricing approval",
      "approval tier": "Finance",
      state: "Proposed",
      "proposed at": "2026-07-26T14:00:00+05:30",
    },
  },
  Evidence_Log: {
    identity: "evidence id",
    row: {
      "evidence id": "SD-EVD-SAV-TEST-001",
      "linked type": "Action",
      "linked id": "SD-ACTION-SAV-TEST-001",
      "evidence type": "Essentials pricing evidence",
      "uploaded by actor id": "ACT-PRIYA",
      "uploaded at": "2026-07-27T10:00:00+05:30",
      description: "Member Savings pricing evidence awaiting independent verification",
      notes: "Essentials pricing evidence awaiting independent verification",
      "verification status": "Pending",
      "updated at": "2026-07-27T10:00:00+05:30",
    },
  },
}

function columnName(index) {
  let value = index + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

async function main() {
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured")

  const result = {}
  for (const [tab, config] of Object.entries(records)) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` })
    const values = response.data.values || []
    const headers = [...(values[0] || [])]
    const missingHeaders = Object.keys(config.row).filter((header) => !headers.includes(header))
    if (missingHeaders.length > 0) {
      const startColumn = columnName(headers.length)
      const endColumn = columnName(headers.length + missingHeaders.length - 1)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!${startColumn}1:${endColumn}1`,
        valueInputOption: "RAW",
        requestBody: { values: [missingHeaders] },
      })
      headers.push(...missingHeaders)
    }
    const identityIndex = headers.indexOf(config.identity)
    if (identityIndex < 0) throw new Error(`${tab} is missing '${config.identity}'`)
    const identityValue = config.row[config.identity]
    const existingIndex = values.slice(1).findIndex((row) => String(row[identityIndex] || "").trim() === identityValue)
    const existingRow = existingIndex >= 0 ? values[existingIndex + 1] || [] : []
    const row = headers.map((header, index) =>
      Object.prototype.hasOwnProperty.call(config.row, header)
        ? config.row[header]
        : existingRow[index] ?? "",
    )

    if (existingIndex >= 0) {
      const rowNumber = existingIndex + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A${rowNumber}:${columnName(headers.length - 1)}${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      })
      result[tab] = { updated: identityValue, row: rowNumber, addedHeaders: missingHeaders }
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tab}!A:${columnName(headers.length - 1)}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      })
      result[tab] = { added: identityValue, addedHeaders: missingHeaders }
    }
  }

  console.log(JSON.stringify({
    component: "Self Drive > Member Savings > Services needing action",
    studioMasterId: "CRM-SRI-D01-S01",
    ...result,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.response?.data || error)
  process.exitCode = 1
})
