require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const normal = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const RED = { red: 0.8, green: 0.02, blue: 0.02 }
const WHITE = { red: 1, green: 1, blue: 1 }

const guides = ["TEAM_DATA_ENTRY_HOME", "SELF_DRIVE_LEARN_GUIDE", "DATA_ENTRY_GUIDE"]
const verticalInputs = ["TEAM_OCCUPANCY", "TEAM_FONO_SUPPLY_DEMAND", "TEAM_ESSENTIALS_SUMMARY"]
const required = {
  TEAM_FINANCE_DAILY: new Set([
    "business date", "theatre id", "opex mtd inr", "opex forecast inr", "opex cap inr",
    "cash balance inr", "cash target inr", "cm target inr", "destination approved",
    "destination owner actor id", "decision due at", "cm1 inr", "cm2 inr", "reported by actor id",
  ]),
  TEAM_MEMBER_ACTIVATION: new Set([
    "member token", "activated at", "theatre id", "studio id", "nest id",
    "demand id", "enterprise id", "work assignment id", "membership billed inr",
    "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status",
  ]),
  TEAM_REQ_PEOPLE_ROSTER: new Set([
    "display name", "role", "theatre id", "studio id", "manager actor id",
    "active shift", "shift start at", "shift end at", "language",
  ]),
  TEAM_LEARNING_HISTORY: new Set([
    "domain", "observed", "proposed change", "expected effect", "attribution",
    "evidence", "confidence", "disposition", "notes",
  ]),
}

async function main() {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index,gridProperties)" })
  const tabs = metadata.data.sheets || []
  const byTitle = new Map(tabs.map((tab) => [tab.properties.title, tab]))
  const requiredTitles = Object.keys(required)
  for (const title of [...guides, ...requiredTitles]) if (!byTitle.has(title)) throw new Error(`Required tab missing: ${title}`)

  const headerResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: requiredTitles.map((title) => `'${title}'!3:3`),
  })
  const availableVerticalInputs = verticalInputs.filter((title) => byTitle.has(title))
  const visible = new Set([...guides, ...availableVerticalInputs, ...requiredTitles])
  const requests = []

  tabs.forEach((tab) => requests.push({
    updateSheetProperties: {
      properties: { sheetId: tab.properties.sheetId, hidden: !visible.has(tab.properties.title) },
      fields: "hidden",
    },
  }))

  requiredTitles.forEach((title, tabIndex) => {
    const tab = byTitle.get(title)
    const headers = (headerResponse.data.valueRanges?.[tabIndex]?.values?.[0] || []).map(String)
    if (!headers.length) throw new Error(`${title} header row is missing`)
    const requiredHeaders = required[title]
    const missing = [...requiredHeaders].filter((header) => !headers.some((actual) => normal(actual) === header))
    if (missing.length) throw new Error(`${title} missing required columns: ${missing.join(", ")}`)

    requests.push({ updateSheetProperties: { properties: { sheetId: tab.properties.sheetId, tabColor: BLACK, gridProperties: { frozenRowCount: 3 } }, fields: "tabColor,gridProperties.frozenRowCount" } })
    headers.forEach((header, column) => {
      const mandatory = requiredHeaders.has(normal(header))
      requests.push({ updateDimensionProperties: {
        range: { sheetId: tab.properties.sheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 },
        properties: { hiddenByUser: !mandatory, pixelSize: mandatory ? 165 : 120 },
        fields: "hiddenByUser,pixelSize",
      } })
      for (const [startRowIndex, endRowIndex] of [[0, 1], [2, 3]]) requests.push({ repeatCell: {
        range: { sheetId: tab.properties.sheetId, startRowIndex, endRowIndex, startColumnIndex: column, endColumnIndex: column + 1 },
        cell: {
          userEnteredFormat: { backgroundColor: mandatory ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" },
          note: mandatory
            ? `MANDATORY USER INPUT — ${header}. Complete this field for every submitted row.`
            : `HIDDEN / DO NOT EDIT — ${header} is optional, derived, or system-managed.`,
        },
        fields: "userEnteredFormat,note",
      } })
      if (mandatory) requests.push({ addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: tab.properties.sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=AND(COUNTA($A4:$ZZ4)>0,${columnLetter(column)}4=\"\")` }] },
            format: { backgroundColor: { red: 1, green: 0.78, blue: 0.78 }, textFormat: { foregroundColor: { red: 0.55, green: 0, blue: 0 }, bold: true } },
          },
        },
        index: 0,
      } })
    })
  })

  const ordered = [...guides, ...availableVerticalInputs, ...requiredTitles]
  ordered.forEach((title, index) => requests.push({ updateSheetProperties: { properties: { sheetId: byTitle.get(title).properties.sheetId, index }, fields: "index" } }))
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "TEAM_DATA_ENTRY_HOME!A1:B14",
    valueInputOption: "RAW",
    requestBody: { values: [
      ["RAFIQI REQUIRED DATA ENTRY", "Only black columns require user input; red columns are calculated/system-managed"],
      ["Daily report import", "File → Import → Upload → Insert new sheet(s). Imported report tabs are system sources and may be hidden after processing."],
      ["1. Finance", "MANDATORY: complete every visible column in TEAM_FINANCE_DAILY."],
      ["2. Member activation", "Manual activations only. Essentials Bot orders create activation rows automatically."],
      ["3. People roster", "MANDATORY: complete every visible column in TEAM_REQ_PEOPLE_ROSTER."],
      ["4. Learning history", "MANDATORY: complete every visible column in TEAM_LEARNING_HISTORY."],
      ["Hidden tabs/columns", "Optional, automated, bot-owned or backend/system-managed. Do not unhide/edit for routine entry."],
      ["Essentials bot", "Orders, items, delivery and inventory always come from the Essentials bot workbook."],
      ["Shrampark bot", "Demand visits always come from the Shrampark bot workbook; test/incomplete rows are quarantined."],
      ["Flow", "Business report / bots → this input workbook → backend workbook → dashboard."],
      ["Sync", "Sources auto-sync every 5 minutes; dashboard snapshot refreshes every minute; Refresh data forces immediate end-to-end sync."],
      ["IDs", "Use governed Theatre, Studio and Actor IDs consistently."],
      ["Required blanks", "After starting a row, blank mandatory cells are highlighted light red."],
      ["Safety", "Never rename technical headers or edit hidden/red fields."],
    ] },
  })

  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index,hidden)" })
  console.log(JSON.stringify({
    visibleTabs: (verified.data.sheets || []).filter((tab) => !tab.properties.hidden).sort((a, b) => a.properties.index - b.properties.index).map((tab) => tab.properties.title),
    hiddenTabs: (verified.data.sheets || []).filter((tab) => tab.properties.hidden).length,
    mandatoryColumns: Object.fromEntries(requiredTitles.map((title) => [title, [...required[title]]])),
  }, null, 2))
}

function columnLetter(index) {
  let out = ""
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) out = String.fromCharCode(65 + ((value - 1) % 26)) + out
  return out
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
