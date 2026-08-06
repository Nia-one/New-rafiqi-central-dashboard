require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }
const MANAGED = "RAFIQI_FRESH_INPUT_MANAGED"
const norm = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

const guides = ["00_READ_ME", "TEAM_DATA_ENTRY_HOME", "SELF_DRIVE_LEARN_GUIDE", "DATA_ENTRY_GUIDE"]
const uiTabs = [
  "UI_Occupancy", "UI_FONO_Supply", "UI_Shrampark_Supply", "UI_Enterprise_Demand",
  "UI_Enterprise_Supply", "UI_Finance", "UI_Collections", "UI_People", "UI_Actions",
  "UI_Approvals", "UI_Evidence", "UI_Targets",
]
const uniqueTeamTabs = [
  "TEAM_MEMBER_ACTIVATION", "TEAM_MEMBER_FEEDBACK", "TEAM_ENTERPRISE_OUTCOMES",
  "TEAM_NIA_GROWTH", "TEAM_OWNER_REGISTRY", "TEAM_LEARNING_HISTORY",
]
const manualTabs = [...uiTabs, ...uniqueTeamTabs]

// Empty set means every populated header is user-entered except the red/system set below.
const editableOverrides = new Map([
  ["UI_FONO_Supply", new Set(["member adds"])],
  ["TEAM_MEMBER_ACTIVATION", new Set(["member token", "activated at", "theatre id", "studio id", "nest id", "demand id", "enterprise id", "work assignment id", "membership billed inr", "membership collected inr", "activation evidence url", "verified at", "verified by", "verification status", "reporting month"])],
  ["TEAM_MEMBER_FEEDBACK", new Set(["member token", "score", "feedback", "collected at", "theatre", "studio", "pillar", "category", "exit risk", "action id", "raw conversation ref", "reporting month"])],
  ["TEAM_ENTERPRISE_OUTCOMES", new Set(["demand reference", "action / outcome", "owner actor id", "due at", "state", "proof reference", "verified by actor id", "verified at", "notes", "reporting month"])],
  ["TEAM_NIA_GROWTH", new Set(["readiness sla days", "nia filled nests", "readiness verified at", "action due at", "evidence url", "verification status", "approval decision", "policy status", "policy approved by actor id", "learning observation", "learning proposal", "notes", "reporting month"])],
  ["TEAM_OWNER_REGISTRY", new Set(["assignment id", "vertical", "scope", "theatre", "role type", "owner name", "business responsibility", "effective from", "effective to", "status", "reporting month"])],
  ["TEAM_LEARNING_HISTORY", new Set(["domain", "observed", "proposed change", "expected effect", "attribution", "confidence", "disposition", "owner actor id", "notes", "reporting month"])],
])
const alwaysSystem = new Set(["last updated", "vacant nests", "occupancy pct", "collection leakage inr", "source submission id", "updated at", "actual loaded cac inr", "payback days", "growth record id", "supply model", "required nests", "gap nests", "owner actor id", "signed contract covered nests", "readiness status", "id"])

const consumers = {
  UI_Occupancy: "Living > Existing Occupancy",
  UI_FONO_Supply: "Living FONO; Member Adds; Nia Growth",
  UI_Shrampark_Supply: "Living Shram Park; Enterprise Demand; Nia Growth",
  UI_Enterprise_Demand: "Enterprise Demand; Nia Growth",
  UI_Enterprise_Supply: "Living; Enterprise Demand; Member Adds",
  UI_Finance: "Cash & Control; Nia Margins; Overview",
  UI_Collections: "Cash & Control; Nia Margins",
  UI_People: "People; Despatch; ownership labels",
  UI_Actions: "All action cards; Despatch; Sign-Off",
  UI_Approvals: "Your Sign-Off; governed decisions",
  UI_Evidence: "Evidence/proof states across pages",
  UI_Targets: "Targets and KPI comparisons across pages",
  TEAM_MEMBER_ACTIVATION: "Member Adds; Member Engagement; Overview",
  TEAM_MEMBER_FEEDBACK: "Member NPS; Member Engagement",
  TEAM_ENTERPRISE_OUTCOMES: "Enterprise Demand; Actions; Evidence",
  TEAM_NIA_GROWTH: "Nia Growth; Sign-Off; Learning",
  TEAM_OWNER_REGISTRY: "Owner labels and routing across pages",
  TEAM_LEARNING_HISTORY: "Learning History; Overview",
}

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

function headerInfo(rows) {
  return rows.reduce((best, row, index) => {
    const count = row.filter((cell) => String(cell || "").trim()).length
    return count > best.count ? { index, values: row.map(String), count } : best
  }, { index: 0, values: [], count: 0 })
}

async function main() {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description))" })
  const tabs = metadata.data.sheets || []
  const byTitle = new Map(tabs.map((sheet) => [sheet.properties.title, sheet]))
  for (const title of [...guides, ...manualTabs]) if (!byTitle.has(title)) throw new Error(`Required tab missing: ${title}`)

  const read = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: manualTabs.map((title) => `'${title}'!1:10`) })
  const headers = new Map(manualTabs.map((title, index) => [title, headerInfo(read.data.valueRanges?.[index]?.values || [])]))
  const requests = []

  for (const sheet of tabs) {
    for (const protection of sheet.protectedRanges || []) if (String(protection.description || "").startsWith(MANAGED)) {
      requests.push({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } })
    }
    const title = sheet.properties.title
    const manual = manualTabs.includes(title)
    const guide = guides.includes(title)
    requests.push({ updateSheetProperties: { properties: {
      sheetId: sheet.properties.sheetId,
      hidden: !(manual || guide),
      tabColorStyle: { rgbColor: manual ? BLACK : RED },
    }, fields: "hidden,tabColorStyle" } })
    if (!manual) continue

    const header = headers.get(title)
    const override = editableOverrides.get(title)
    const automatedColumns = []
    header.values.forEach((value, column) => {
      const key = norm(value)
      const editable = override ? override.has(key) : !alwaysSystem.has(key)
      if (!editable) automatedColumns.push(column)
      requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: header.index, endRowIndex: header.index + 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: {
        userEnteredFormat: { backgroundColor: editable ? BLACK : RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" },
        note: editable ? "BLACK = USER INPUT. Fill this field; connected dashboard pages update after sync." : "RED = AUTOMATED / DERIVED. Do not edit.",
      }, fields: "userEnteredFormat,note" } })
    })
    for (const column of automatedColumns) requests.push({ addProtectedRange: { protectedRange: {
      description: `${MANAGED}: ${title} column ${column + 1}`,
      range: { sheetId: sheet.properties.sheetId, startRowIndex: header.index, endRowIndex: sheet.properties.gridProperties?.rowCount || 1000, startColumnIndex: column, endColumnIndex: column + 1 },
      warningOnly: true,
    } } })
  }

  const order = [...guides, ...manualTabs, ...tabs.map((sheet) => sheet.properties.title).filter((title) => !guides.includes(title) && !manualTabs.includes(title))]
  for (const title of [...order].reverse()) requests.push({ updateSheetProperties: { properties: { sheetId: byTitle.get(title).properties.sheetId, index: 0 }, fields: "index" } })
  for (let index = 0; index < requests.length; index += 300) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 300) } })

  const guideRows = [["TAB", "COLUMN", "FIELD", "OWNERSHIP", "WHAT TO ENTER", "DASHBOARD CONSUMERS"]]
  for (const title of manualTabs) {
    const header = headers.get(title)
    const override = editableOverrides.get(title)
    header.values.forEach((field, index) => {
      const editable = override ? override.has(norm(field)) : !alwaysSystem.has(norm(field))
      guideRows.push([title, index + 1, field, editable ? "BLACK — USER INPUT" : "RED — AUTOMATED / DO NOT EDIT", editable ? "Enter the verified source value in the required format." : "Calculated, imported or system-managed.", consumers[title]])
    })
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A1", valueInputOption: "RAW", requestBody: { values: guideRows } })
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1:D100" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1", valueInputOption: "RAW", requestBody: { values: [
    ["RAFIQI USER INPUT — READY", "BLACK tabs/columns are user input. RED tabs/columns are automated or derived; do not edit."],
    ["Rule", "Enter every fact once in its owning visible tab. Do not unhide system or bot tabs."],
    ["Visible inputs", manualTabs.join(", ")],
    ["Automated sources", "Essentials, Shram Park demand, FONO demand and backend/system mirrors remain hidden and excluded from manual entry."],
    ["Sync", "Save the row with valid Record_ID, Sample_Live = Live and Reporting_Date where those columns exist, then use Refresh data."],
    ["Verification", "Check the named dashboard consumer shown in DATA_ENTRY_GUIDE after sync."],
  ] } })

  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index,hidden,tabColorStyle)" })
  console.log(JSON.stringify({ spreadsheetId, visibleTabs: (verified.data.sheets || []).filter((sheet) => !sheet.properties.hidden).sort((a, b) => a.properties.index - b.properties.index).map((sheet) => sheet.properties.title), manualTabs, guideRows: guideRows.length - 1 }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
