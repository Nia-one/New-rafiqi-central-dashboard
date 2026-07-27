require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const expectedHidden = new Set([
  "Lists", "Source_Registry", "Policy_Registry", "Member_Activation", "Hourly_Heartbeat",
  "Incident_Log", "Evidence_Log", "Approval_Log", "Previous_Block", "actions", "executionQueue",
])

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(title,hidden),protectedRanges(description))" })
  const tabs = metadata.data.sheets || []
  const actualHidden = tabs.filter((sheet) => sheet.properties.hidden).map((sheet) => sheet.properties.title)
  const visibilityOk = [...expectedHidden].every((title) => actualHidden.includes(title))
  const protectedCount = tabs.flatMap((sheet) => sheet.protectedRanges || []).filter((range) => String(range.description || "").startsWith("Self Learn Ops")).length

  const ranges = [
    "Enterprise_Demand!M2:T3", "Living_Hourly!N2:O3", "Work_Hourly!V2:AF3",
    "Essentials_Hourly!Q2:Q3", "Essentials_Cohorts!D2:F3", "Essentials_Inventory!F2:F3",
    "People_Follow_Through!I2:I3", "Constraints!D2:D4", "Previous_Block!A2:B2",
    "actions!A2:F4", "executionQueue!A2:H4", "DATA_ENTRY_GUIDE!A1:K500",
  ]
  const rendered = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: "FORMATTED_VALUE" })
  const formulas = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ranges.slice(0, -1), valueRenderOption: "FORMULA" })
  const renderedValues = (rendered.data.valueRanges || []).flatMap((range) => range.values || []).flat()
  const errors = renderedValues.filter((value) => typeof value === "string" && /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|ERROR!)/.test(value))
  const formulaCount = (formulas.data.valueRanges || []).flatMap((range) => range.values || []).flat().filter((value) => typeof value === "string" && value.startsWith("=")).length
  const guideRows = (rendered.data.valueRanges?.at(-1)?.values || []).length - 1

  const sample = Object.fromEntries((rendered.data.valueRanges || []).slice(0, -1).map((range) => [range.range, range.values || []]))
  console.log(JSON.stringify({ visibilityOk, actualHidden, protectedCount, formulaCount, formulaErrors: errors, guideRows, sample }, null, 2))
  if (!visibilityOk || errors.length || guideRows < 300 || formulaCount < 20 || protectedCount < 20) process.exit(2)
}

main().catch((error) => {
  console.error(error?.response?.data || error)
  process.exit(1)
})
