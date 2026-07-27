require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TABLES = {
  Constraints: {
    key: "id",
    columns: ["theatre", "stalledBlocks", "impact", "detail", "idleUnits", "cmPerUnit", "riskHours", "ageHours", "thresholdHours", "deadlineAt", "recoverableShare", "confidence"],
    rows: {
      c001: { theatre: "Deccan (Pune)", stalledBlocks: 7, impact: 100000, detail: "200 live Nests unoccupied without enterprise demand", idleUnits: 200, cmPerUnit: 500, riskHours: 24, ageHours: 12, thresholdHours: 24, deadlineAt: "2026-07-25T18:00:00+05:30", recoverableShare: 0.6, confidence: "High" },
      c002: { theatre: "Coromandel (Tamil Nadu)", stalledBlocks: 1, impact: 286000, detail: "Supply response breached 24h SLA", idleUnits: 282, cmPerUnit: 1014.1843971631205, riskHours: 24, ageHours: 27, thresholdHours: 24, deadlineAt: "2026-07-25T17:00:00+05:30", recoverableShare: 0.5, confidence: "Medium" },
      c003: { theatre: "Wellington (Karnataka)", stalledBlocks: 0, impact: 182000, detail: "Inventory below safety level", idleUnits: 700, cmPerUnit: 260, riskHours: 24, ageHours: 6, thresholdHours: 8, deadlineAt: "2026-07-25T18:00:00+05:30", recoverableShare: 0.7, confidence: "High" },
    },
  },
  rootCause: {
    key: "constraintId",
    columns: ["evidence", "why1", "why2", "why3", "why4", "why5", "reviewStatus", "reviewedBy", "reviewedAt"],
    rows: {
      c001: {
        evidence: "200 live Nests without enterprise demand",
        why1: "200 live Nests are unoccupied.",
        why2: "No named enterprise requirement is linked to the available Nests.",
        why3: "The capacity remained unmatched beyond the operating review window.",
        why4: "The demand link was not completed before the idle threshold.",
        why5: "Operations must verify the missing demand link and record the failed-match reason.",
        reviewStatus: "Evidence-backed authored (TEST DATA)", reviewedBy: "Operations Review (TEST)", reviewedAt: "2026-07-25T12:00:00+05:30",
      },
      c002: {
        evidence: "Supply response breached SLA",
        why1: "Named demand has no viable supply inside the SLA.",
        why2: "The available response breached the 24-hour sourcing limit.",
        why3: "The breached response window made the option ineligible.",
        why4: "No replacement option was confirmed within the review window.",
        why5: "Operations must escalate replacement supply and document the SLA breach.",
        reviewStatus: "Evidence-backed authored (TEST DATA)", reviewedBy: "Operations Review (TEST)", reviewedAt: "2026-07-25T12:00:00+05:30",
      },
      c003: {
        evidence: "Inventory below level",
        why1: "A high-repeat SKU is below its safety-stock level.",
        why2: "Available inventory cannot cover the recorded demand requirement.",
        why3: "Replenishment was not completed before stock reached the threshold.",
        why4: "The shortage remains open in the Essentials action register.",
        why5: "Operations must replenish the SKU and verify restored availability.",
        reviewStatus: "Evidence-backed authored (TEST DATA)", reviewedBy: "Operations Review (TEST)", reviewedAt: "2026-07-25T12:00:00+05:30",
      },
    },
  },
  executionQueue: {
    key: "constraintId",
    columns: ["cmRisk", "alertStatus", "alertQueuedAt"],
    rows: {
      c001: { cmRisk: 100000, alertStatus: "Alert queued (TEST DATA)", alertQueuedAt: "2026-07-25T12:05:00+05:30" },
      c002: { cmRisk: 286000, alertStatus: "Alert queued (TEST DATA)", alertQueuedAt: "2026-07-25T12:06:00+05:30" },
      c003: { cmRisk: 182000, alertStatus: "Alert queued (TEST DATA)", alertQueuedAt: "2026-07-25T12:07:00+05:30" },
    },
  },
}

function columnName(index) {
  let value = index + 1
  let name = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties(rowCount))" })
  const properties = new Map((workbook.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties]))
  const formattingRequests = []

  for (const [sheetName, config] of Object.entries(TABLES)) {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A:AZ` })
    const rows = result.data.values || []
    const originalHeaders = rows[0] || []
    const headers = [...originalHeaders, ...config.columns.filter((column) => !originalHeaders.includes(column))]
    const updates = []

    if (headers.length !== originalHeaders.length) {
      updates.push({ range: `'${sheetName}'!A1:${columnName(headers.length - 1)}1`, values: [headers] })
    }

    const keyIndex = headers.indexOf(config.key)
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const seed = config.rows[String(rows[rowIndex][keyIndex] || "")]
      if (!seed) continue
      for (const column of config.columns) {
        updates.push({
          range: `'${sheetName}'!${columnName(headers.indexOf(column))}${rowIndex + 1}`,
          values: [[seed[column]]],
        })
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } })
    }

    const sheet = properties.get(sheetName)
    for (const column of config.columns) {
      const columnIndex = headers.indexOf(column)
      formattingRequests.push({
        repeatCell: {
          range: { sheetId: sheet.sheetId, startRowIndex: 1, endRowIndex: Math.min(sheet.gridProperties?.rowCount || 1000, Math.max(rows.length, 100)), startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.68 } }, note: "Operations input. Current value is TEST DATA and should be replaced when the live process starts." },
          fields: "userEnteredFormat.backgroundColor,note",
        },
      })
    }
  }

  if (formattingRequests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formattingRequests } })
  console.log("Execution Queue live fields added, test-seeded, and highlighted for Operations input.")
}

main().catch((error) => { console.error(error); process.exit(1) })
