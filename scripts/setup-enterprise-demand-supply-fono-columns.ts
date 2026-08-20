import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE"
const tab = "Fono Funnel"
const required = ["Property For", "Enterprise Demand ID", "Enterprise ID", "Enterprise Name", "Property Status", "Match Status"]
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:AZ` })
  const demandValues = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'UI_Enterprise_Demand'!A:AZ" })
  const rows = values.data.values || []
  const headerIndex = rows.findIndex((row) => row.map(norm).includes("stage after") && row.map(norm).includes("nests potential"))
  if (headerIndex < 0) throw new Error(`${tab} header row not found`)
  const headers = (rows[headerIndex] || []).map(String)
  const missing = required.filter((name) => !headers.some((header) => norm(header) === norm(name)))
  if (missing.length) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!${columnName(headers.length + 1)}${headerIndex + 1}`, valueInputOption: "RAW", requestBody: { values: [missing] } })
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  const property = meta.data.sheets?.find((sheet) => sheet.properties?.title === tab)?.properties
  if (property?.sheetId == null) throw new Error(`${tab} not found`)
  const fullHeaders = [...headers, ...missing]
  const demandRows = demandValues.data.values || []
  const demandHeaderIndex = demandRows.findIndex((row) => row.map(norm).includes("enterprise name") && row.map(norm).includes("record id"))
  if (demandHeaderIndex < 0) throw new Error("UI_Enterprise_Demand header row not found")
  const demandHeaders = (demandRows[demandHeaderIndex] || []).map(String)
  const demandNameIndex = demandHeaders.findIndex((header) => norm(header) === "enterprise name")
  const demandRecordIndex = demandHeaders.findIndex((header) => norm(header) === "record id")
  const demandEnterpriseIndex = demandHeaders.findIndex((header) => norm(header) === "enterprise id")
  if ([demandNameIndex, demandRecordIndex, demandEnterpriseIndex].some((index) => index < 0)) throw new Error("UI_Enterprise_Demand requires Record_ID, Enterprise_ID and Enterprise_Name")
  const requests: any[] = required.map((name) => {
    const index = fullHeaders.findIndex((header) => norm(header) === norm(name))
    const manual = name === "Enterprise Name" || name === "Property For"
    const note = name === "Property For" ? "USER INPUT: Select FONO or Enterprise. Only Enterprise rows enter the Enterprise Demand vs Supply report." : name === "Enterprise Name" ? "USER INPUT: For Enterprise properties, select the company. The IDs and statuses fill automatically." : `AUTOMATIC: ${name} is derived from Enterprise Name or Stage After. Do not type in this column.`
    return { repeatCell: { range: { sheetId: property.sheetId!, startRowIndex: headerIndex, endRowIndex: headerIndex + 1, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { note, userEnteredFormat: { backgroundColor: manual ? { red: 0.03, green: 0.03, blue: 0.03 } : { red: 0.75, green: 0.05, blue: 0.05 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" } }, fields: "note,userEnteredFormat" } }
  })
  const propertyForIndex = fullHeaders.findIndex((header) => norm(header) === "property for")
  const enterpriseNameIndex = fullHeaders.findIndex((header) => norm(header) === "enterprise name")
  const demandIdIndex = fullHeaders.findIndex((header) => norm(header) === "enterprise demand id")
  const enterpriseIdIndex = fullHeaders.findIndex((header) => norm(header) === "enterprise id")
  const propertyStatusIndex = fullHeaders.findIndex((header) => norm(header) === "property status")
  const matchStatusIndex = fullHeaders.findIndex((header) => norm(header) === "match status")
  const stageAfterIndex = fullHeaders.findIndex((header) => norm(header) === "stage after")
  const dataRow = headerIndex + 2
  const lastRow = property.gridProperties?.rowCount || 1000
  const fonoNameRange = `${columnName(enterpriseNameIndex + 1)}${dataRow}:${columnName(enterpriseNameIndex + 1)}`
  const demandNames = `'UI_Enterprise_Demand'!${columnName(demandNameIndex + 1)}${demandHeaderIndex + 2}:${columnName(demandNameIndex + 1)}`
  const demandIds = `'UI_Enterprise_Demand'!${columnName(demandRecordIndex + 1)}${demandHeaderIndex + 2}:${columnName(demandRecordIndex + 1)}`
  const enterpriseIds = `'UI_Enterprise_Demand'!${columnName(demandEnterpriseIndex + 1)}${demandHeaderIndex + 2}:${columnName(demandEnterpriseIndex + 1)}`
  requests.push({ setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: headerIndex + 1, endRowIndex: lastRow, startColumnIndex: enterpriseNameIndex, endColumnIndex: enterpriseNameIndex + 1 }, rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `=${demandNames}` }] }, strict: true, showCustomUi: true } } })
  requests.push({ setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: headerIndex + 1, endRowIndex: lastRow, startColumnIndex: propertyForIndex, endColumnIndex: propertyForIndex + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: ["FONO", "Enterprise"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } })
  const formulas = [
    [demandIdIndex, `=ARRAYFORMULA(IF(${fonoNameRange}="","",IFNA(XLOOKUP(${fonoNameRange},${demandNames},${demandIds}),"")))`],
    [enterpriseIdIndex, `=ARRAYFORMULA(IF(${fonoNameRange}="","",IFNA(XLOOKUP(${fonoNameRange},${demandNames},${enterpriseIds}),"")))`],
    [propertyStatusIndex, `=ARRAYFORMULA(IF(${columnName(stageAfterIndex + 1)}${dataRow}:${columnName(stageAfterIndex + 1)}="","",${columnName(stageAfterIndex + 1)}${dataRow}:${columnName(stageAfterIndex + 1)}))`],
    [matchStatusIndex, `=ARRAYFORMULA(IF(${fonoNameRange}="","Unmapped",IF(${columnName(demandIdIndex + 1)}${dataRow}:${columnName(demandIdIndex + 1)}="","Unmapped",IF(REGEXMATCH(LOWER(${columnName(propertyStatusIndex + 1)}${dataRow}:${columnName(propertyStatusIndex + 1)}),"contracted|onboarded"),"Closed","Mapped"))))`],
  ] as const
  for (const [index, formula] of formulas) {
    requests.push({ updateCells: { range: { sheetId: property.sheetId, startRowIndex: headerIndex + 1, endRowIndex: headerIndex + 2, startColumnIndex: index, endColumnIndex: index + 1 }, rows: [{ values: [{ userEnteredValue: { formulaValue: formula } }] }], fields: "userEnteredValue" } })
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ tab, addedColumns: missing, manualColumns: ["Property For", "Enterprise Name"], automaticColumns: required.filter((name) => !["Property For", "Enterprise Name"].includes(name)) }, null, 2))
}

function columnName(column: number) {
  let value = column, result = ""
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26) }
  return result
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
