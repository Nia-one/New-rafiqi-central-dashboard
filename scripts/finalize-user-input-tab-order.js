require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const home = ["TEAM_DATA_ENTRY_HOME"]
const userTabs = [
  "TEAM_OCCUPANCY", "Fono Funnel", "TEAM_REQ_SP_SUPPLY", "TEAM_FINANCE_DAILY",
  "TEAM_MEMBER_ACTIVATION", "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_ENTERPRISE_OUTCOMES", "TEAM_NIA_GROWTH", "TEAM_OWNER_REGISTRY", "TEAM_LEARNING_HISTORY",
]
const guides = ["SELF_DRIVE_LEARN_GUIDE", "DATA_ENTRY_GUIDE"]
const preferredAutomated = ["Studios", "Essentials", "Flow", "CM Actions"]
const removable = new Set([
  "TEAM_ESSENTIALS_SUMMARY", "TEAM_CM", "TEAM_REQ_MEMBER_ENGAGEMENT", "TEAM_BOT_SHRAMPARK_DEMAND",
  "Dashboard", "PROD_CLEAN_ARCHIVE_2026-07-29T09-47-49", "MANUAL_INPUT_ARCHIVE_2026-07-29T11-08-13",
])
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }
const MANAGED_PROTECTION = "RAFIQI_MANAGED_AUTOMATED"
const norm = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

const editableHeaders = new Map([
  ["TEAM_OCCUPANCY", new Set(["activation ready nests"])],
  ["TEAM_REQ_SP_SUPPLY", new Set(["theatre id", "location id", "site name", "contracted nests", "activation ready nests", "occupied nests", "contract coverage status", "capital coverage status", "owner actor id", "as of at"])],
  ["TEAM_FINANCE_DAILY", new Set(["business date", "theatre id", "studio id", "opex mtd inr", "opex forecast inr", "opex cap inr", "cash balance inr", "cash target inr", "cm target inr", "destination approved", "destination owner actor id", "decision due at", "cm1 inr", "cm2 inr", "reported by actor id", "notes"])],
  ["TEAM_MEMBER_ACTIVATION", new Set(["member token", "activated at", "theatre id", "studio id", "nest id", "demand id", "enterprise id", "work assignment id", "membership billed inr", "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status"])],
  ["TEAM_MEMBER_FEEDBACK", new Set(["member token", "score", "feedback", "collected at", "theatre", "studio", "pillar", "category", "exit risk", "raw conversation ref"])],
  ["TEAM_REQ_PEOPLE_ROSTER", new Set(["display name", "role", "theatre id", "studio id", "manager actor id", "active shift", "shift start at", "shift end at", "language"])],
  ["TEAM_ENTERPRISE_OUTCOMES", new Set(["demand reference", "action / outcome", "owner actor id", "due at", "state", "proof reference", "verified by actor id", "verified at", "notes"])],
  ["TEAM_NIA_GROWTH", new Set(["readiness sla days", "nia filled nests", "readiness verified at", "action due at", "evidence url", "verification status", "approval decision", "policy status", "policy approved by actor id", "learning proposal", "notes"])],
  ["TEAM_OWNER_REGISTRY", new Set(["assignment id", "vertical", "scope", "theatre", "role type", "owner name", "business responsibility", "effective from", "effective to", "status"])],
  ["TEAM_LEARNING_HISTORY", new Set(["domain", "observed", "proposed change", "expected effect", "attribution", "confidence", "disposition", "owner actor id", "notes"])],
])

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

function columnRanges(indexes) {
  const sorted = [...indexes].sort((a, b) => a - b)
  const ranges = []
  for (const column of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && last.end === column) last.end = column + 1
    else ranges.push({ start: column, end: column + 1 })
  }
  return ranges
}

async function main() {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description))" })
  const tabs = metadata.data.sheets || []
  const byTitle = new Map(tabs.map((sheet) => [sheet.properties.title, sheet]))
  for (const title of [...home, ...userTabs, ...guides, ...preferredAutomated]) if (!byTitle.has(title)) throw new Error(`Required tab missing: ${title}`)
  const automated = tabs.map((sheet) => sheet.properties.title).filter((title) => !home.includes(title) && !userTabs.includes(title) && !guides.includes(title) && !preferredAutomated.includes(title) && !removable.has(title))
  const obsolete = tabs.map((sheet) => sheet.properties.title).filter((title) => removable.has(title))
  const order = [...home, ...userTabs, ...guides, ...preferredAutomated, ...automated, ...obsolete]
  const headerResponse = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: tabs.map((sheet) => `'${sheet.properties.title.replace(/'/g, "''")}'!1:4`) })
  const headersByTitle = new Map()
  tabs.forEach((sheet, index) => {
    const rows = headerResponse.data.valueRanges?.[index]?.values || []
    const header = rows.reduce((best, row, rowIndex) => {
      const count = row.filter((cell) => String(cell || "").trim()).length
      return count > best.count ? { rowIndex, count, values: row.map(String) } : best
    }, { rowIndex: 0, count: 0, values: [] })
    headersByTitle.set(sheet.properties.title, header)
  })

  const requests = []
  for (const sheet of tabs) for (const protection of sheet.protectedRanges || []) {
    if (String(protection.description || "").startsWith(MANAGED_PROTECTION)) requests.push({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } })
  }
  ;[...order].reverse().forEach((title) => requests.push({ updateSheetProperties: { properties: { sheetId: byTitle.get(title).properties.sheetId, index: 0 }, fields: "index" } }))

  tabs.forEach((sheet) => {
    const title = sheet.properties.title
    const isManualTab = userTabs.includes(title)
    const isObsolete = removable.has(title)
    const rowCount = sheet.properties.gridProperties?.rowCount || 1000
    const columnCount = sheet.properties.gridProperties?.columnCount || 26
    const header = headersByTitle.get(title)
    const editable = editableHeaders.get(title) || (title === "Fono Funnel" ? new Set(header.values.map(norm)) : new Set())
    const editableIndexes = new Set(header.values.map((value, index) => editable.has(norm(value)) ? index : -1).filter((index) => index >= 0))
    const automatedIndexes = new Set(Array.from({ length: header.values.length }, (_, index) => index).filter((index) => !editableIndexes.has(index)))

    requests.push({ updateSheetProperties: { properties: { sheetId: sheet.properties.sheetId, hidden: isObsolete, tabColorStyle: { rgbColor: isManualTab ? BLACK : RED } }, fields: "hidden,tabColorStyle" } })
    header.values.forEach((value, column) => {
      const manual = isManualTab && editableIndexes.has(column)
      requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: header.rowIndex, endRowIndex: header.rowIndex + 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: manual ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: manual ? "BLACK = USER INPUT. Fill once; derived pages update automatically." : "RED = AUTOMATED / IMPORTED / SYSTEM. Do not edit." }, fields: "userEnteredFormat,note" } })
    })

    if (!isObsolete) {
      if (!isManualTab) {
        requests.push({ addProtectedRange: { protectedRange: { description: `${MANAGED_PROTECTION}: ${title}`, range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount }, warningOnly: false, editors: { users: [account.client_email] } } } })
      } else {
        for (const columns of columnRanges(automatedIndexes)) requests.push({ addProtectedRange: { protectedRange: { description: `${MANAGED_PROTECTION}: ${title} automated columns`, range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: columns.start, endColumnIndex: columns.end }, warningOnly: false, editors: { users: [account.client_email] } } } })
      }
    }
  })

  for (let index = 0; index < requests.length; index += 350) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 350) } })
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(title,index,hidden,tabColorStyle),protectedRanges(description))" })
  const finalTabs = (verified.data.sheets || []).sort((a, b) => a.properties.index - b.properties.index)
  console.log(JSON.stringify({
    manualTabs: userTabs,
    visibleOrder: finalTabs.filter((sheet) => !sheet.properties.hidden).map((sheet) => sheet.properties.title),
    hiddenObsolete: finalTabs.filter((sheet) => sheet.properties.hidden).map((sheet) => sheet.properties.title),
    managedProtections: finalTabs.reduce((sum, sheet) => sum + (sheet.protectedRanges || []).filter((item) => String(item.description || "").startsWith(MANAGED_PROTECTION)).length, 0),
  }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
