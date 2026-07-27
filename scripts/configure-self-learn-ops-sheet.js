require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const INPUT = { red: 1, green: 0.949, blue: 0.8 }
const CALCULATED = { red: 0.851, green: 0.918, blue: 0.969 }
const SYSTEM = { red: 0.91, green: 0.91, blue: 0.91 }
const HEADER = { red: 0.122, green: 0.286, blue: 0.514 }
const WHITE = { red: 1, green: 1, blue: 1 }

const hiddenTabs = new Set([
  "Lists",
  "Source_Registry",
  "Policy_Registry",
  "Member_Activation",
  "Hourly_Heartbeat",
  "Incident_Log",
  "Evidence_Log",
  "Approval_Log",
  "Previous_Block",
  "actions",
  "executionQueue",
])

const tabPurpose = {
  Theatre_Master: ["All Self Learn pages", "Theatre names and owner/reference joins"],
  Studio_Master: ["Living, Work, Essentials, Overview", "Studio identity, supply model, capacity, readiness and governed cost context"],
  People_Roster: ["All Self Learn pages", "Owner names, roles, shifts and accountability"],
  Enterprise_Demand: ["Living and Overview", "Demand funnel, matched headcount, proximity and demand ownership"],
  Action_Log: ["Overview and Learning & History", "Execution state, closures and overdue owners"],
  Living_Hourly: ["Living and Overview", "Live capacity, occupancy, revenue and operating blockers"],
  Work_Hourly: ["Work and Overview", "Work ARPU, employer share, allocation action and Work demand/supply"],
  Essentials_Hourly: ["Essentials and Overview", "Buying, fulfilment, revenue, savings, margin and exceptions"],
  Finance_Daily: ["Overview and Living", "CM, collections and governed financial measures"],
  Dashboard_Overview: ["Overview", "Approved plan/target values only; actuals are calculated from source tabs"],
  CM_History: ["Overview", "CM trajectory and last two-hour comparison snapshots"],
  Constraints: ["Overview", "Execution queue, priority scoring and Theatre action grid"],
  rootCause: ["Overview", "Root-cause drawer, evidence and reviewed 5-Whys"],
  Dashboard_Content: ["All Self Learn pages", "Editable headings, sentences and component copy"],
  Living_Dashboard: ["Living", "Living component values and editable narrative tokens"],
  Work_Dashboard: ["Work", "Work component headings and editable narrative tokens"],
  Essentials_Dashboard: ["Essentials", "Essentials component headings and editable narrative tokens"],
  Essentials_Cohorts: ["Essentials", "Member buying journey, attach, AOV and cohort behaviour"],
  Essentials_Inventory: ["Essentials", "Pricing, savings, stock, fill and product-action detail"],
  Member_NPS_Dashboard: ["Members & NPS", "Component headings, connector status and narrative tokens"],
  Member_NPS_Feedback: ["Members & NPS", "Early warning, patterns and drill-down feedback"],
  Member_NPS_Responses: ["Members & NPS", "NPS scores, trends and response detail"],
  People_Dashboard: ["People", "People component headings and narrative tokens"],
  People_Performance: ["People", "Team/lane performance, attainment, review and reporting status"],
  People_Follow_Through: ["People and Overview", "Commitments, verification, carry-forward and action progress"],
  Learning_History: ["Learning & History", "Observed learning, proposed change, confidence and disposition"],
}

const calculatedColumns = {
  Enterprise_Demand: new Set(["headcount remaining", "age hours"]),
  Living_Hourly: new Set(["occupancy ratio", "billed arpu"]),
  Work_Hourly: new Set(["Studio ID", "Theatre", "enterprise or employer", "active Members", "Work revenue", "period start", "period end"]),
  Essentials_Hourly: new Set(["nia margin inr"]),
  Essentials_Cohorts: new Set(["attach", "aov"]),
  Essentials_Inventory: new Set(["savings"]),
  People_Follow_Through: new Set(["progress pct"]),
  Constraints: new Set(["impact"]),
  Previous_Block: new Set(["snapshot_time", "cm"]),
  actions: new Set(["id", "constraintId", "action", "owner", "status", "dueDate"]),
  executionQueue: new Set(["id", "constraintId", "priority", "cmRisk", "owner", "status", "alertStatus", "alertQueuedAt"]),
}

const hiddenColumns = {
  Theatre_Master: new Set(["source id"]),
  Studio_Master: new Set(["source id"]),
  Enterprise_Demand: new Set(["source submission id"]),
  Action_Log: new Set(["source submission id"]),
  Living_Hourly: new Set(["source submission id"]),
  Work_Hourly: new Set(["source submission id"]),
  Essentials_Hourly: new Set(["source submission id"]),
  Finance_Daily: new Set(["source submission id"]),
  Member_NPS_Feedback: new Set(["raw conversation ref"]),
}

const formulas = {
  "Enterprise_Demand|headcount remaining": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(K2:K-L2:L,"")))',
  "Enterprise_Demand|age hours": '=ARRAYFORMULA(IF(A2:A="","",IF(S2:S="","",ROUND((NOW()-(DATEVALUE(LEFT(S2:S,10))+TIMEVALUE(MID(S2:S,12,8))))*24,1))))',
  "Living_Hourly|occupancy ratio": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(H2:H/G2:G,"")))',
  "Living_Hourly|billed arpu": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(K2:K/H2:H,"")))',
  "Work_Hourly|Studio ID": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(XLOOKUP(B2:B,Hourly_Heartbeat!A:A,Hourly_Heartbeat!E:E,""),"")))',
  "Work_Hourly|Theatre": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(XLOOKUP(C2:C,Theatre_Master!A:A,Theatre_Master!B:B,""),"")))',
  "Work_Hourly|enterprise or employer": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(XLOOKUP(D2:D,Enterprise_Demand!B:B,Enterprise_Demand!C:C,""),"")))',
  "Work_Hourly|active Members": '=ARRAYFORMULA(IF(A2:A="","",G2:G))',
  "Work_Hourly|Work revenue": '=ARRAYFORMULA(IF(A2:A="","",L2:L))',
  "Work_Hourly|period start": '=ARRAYFORMULA(IF(A2:A="","",IF(U2:U="","",EOMONTH(DATEVALUE(LEFT(U2:U,10)),-1)+1)))',
  "Work_Hourly|period end": '=ARRAYFORMULA(IF(A2:A="","",IF(U2:U="","",EOMONTH(DATEVALUE(LEFT(U2:U,10)),0))))',
  "Essentials_Hourly|nia margin inr": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(L2:L-N2:N-O2:O,"")))',
  "Essentials_Cohorts|attach": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(C2:C/B2:B,"")))',
  "Essentials_Cohorts|aov": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(E2:E/C2:C,"")))',
  "Essentials_Inventory|savings": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(D2:D-E2:E,"")))',
  "People_Follow_Through|progress pct": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(E2:E/D2:D*100,"")))',
  "Constraints|impact": '=ARRAYFORMULA(IF(A2:A="","",IFERROR(J2:J*K2:K*L2:L/24,"")))',
  "Previous_Block|snapshot_time": '=IFERROR(INDEX(FILTER(CM_History!C2:C,CM_History!B2:B<>""),ROWS(FILTER(CM_History!B2:B,CM_History!B2:B<>""))-1),"")',
  "Previous_Block|cm": '=IFERROR(INDEX(FILTER(CM_History!B2:B,CM_History!B2:B<>""),ROWS(FILTER(CM_History!B2:B,CM_History!B2:B<>""))-1),"")',
  "actions|id": '=ARRAYFORMULA(IF(Constraints!A2:A="","","a"&TEXT(ROW(Constraints!A2:A)-1,"000")))',
  "actions|constraintId": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!A2:A))',
  "actions|action": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!G2:G))',
  "actions|owner": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!F2:F))',
  "actions|status": '=ARRAYFORMULA(IF(Constraints!A2:A="","","Open"))',
  "actions|dueDate": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!O2:O))',
  "executionQueue|id": '=ARRAYFORMULA(IF(Constraints!A2:A="","","e"&TEXT(ROW(Constraints!A2:A)-1,"000")))',
  "executionQueue|constraintId": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!A2:A))',
  "executionQueue|priority": '=ARRAYFORMULA(IF(Constraints!A2:A="","",IF(Constraints!D2:D>=100000,"High",IF(Constraints!D2:D>=50000,"Medium","Low"))))',
  "executionQueue|cmRisk": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!D2:D))',
  "executionQueue|owner": '=ARRAYFORMULA(IF(Constraints!A2:A="","",Constraints!F2:F))',
  "executionQueue|status": '=ARRAYFORMULA(IF(Constraints!A2:A="","","Open"))',
  "executionQueue|alertStatus": '=ARRAYFORMULA(IF(Constraints!A2:A="","","Internal queue (sheet-driven)"))',
  "executionQueue|alertQueuedAt": '=ARRAYFORMULA(IF(Constraints!A2:A="","",""))',
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

function formatFor(header) {
  const key = String(header).toLowerCase()
  if (key.includes(" at") || key.includes("date") || key.includes("start") || key.includes("end") || key === "month" || key.includes("deadline")) return "ISO 8601 timestamp (2026-07-25T12:00:00+05:30) or yyyy-mm-dd where applicable"
  if (key.includes("ratio") || key.includes("share") || key === "attach" || key === "fill" || key === "churn" || key === "d30" || key === "d60" || key === "d90") return "Decimal ratio, e.g. 0.65 for 65%"
  if (key.includes(" inr") || key.includes("revenue") || key.includes("gmv") || key.includes("mrp") || key.includes("selling") || key.includes("savings") || key.includes("impact")) return "Number in INR; do not type ₹ or commas"
  if (key.includes(" id") || key === "id" || key.endsWith("Id") || key.includes("token") || key === "sku") return "Text identifier; unique where this is the row ID"
  if (key.includes("status") || key.includes("confidence") || key.includes("disposition") || key.includes("state") || key.includes("lane") || key.includes("model")) return "Use the approved label shown in sample rows / Lists"
  if (key.includes("flag") || key === "active" || key.includes("required") || key.includes("due")) return "TRUE/FALSE or the approved status/date format for this field"
  if (key.includes("count") || key.includes("nests") || key.includes("members") || key.includes("orders") || key.includes("hours") || key.includes("pct") || key.includes("stock") || key.includes("frequency")) return "Number only"
  return "Text unless the sample row shows a number/date"
}

function groupContiguous(indexes) {
  if (!indexes.length) return []
  const sorted = [...indexes].sort((a, b) => a - b)
  const groups = []
  let start = sorted[0]
  let end = start + 1
  for (const index of sorted.slice(1)) {
    if (index === end) end += 1
    else { groups.push([start, end]); start = index; end = index + 1 }
  }
  groups.push([start, end])
  return groups
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  let workbook = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description))",
  })
  let tabs = workbook.data.sheets || []
  let byTitle = new Map(tabs.map((sheet) => [sheet.properties.title, sheet]))

  if (!byTitle.has("DATA_ENTRY_GUIDE")) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "DATA_ENTRY_GUIDE" } } }] } })
    workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description))" })
    tabs = workbook.data.sheets || []
    byTitle = new Map(tabs.map((sheet) => [sheet.properties.title, sheet]))
  }

  const ranges = tabs.map((sheet) => `'${String(sheet.properties.title).replaceAll("'", "''")}'!1:2`)
  const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: "UNFORMATTED_VALUE" })
  let rowsByTitle = new Map(tabs.map((sheet, index) => [sheet.properties.title, values.data.valueRanges?.[index]?.values || []]))

  const clearRanges = []
  const formulaUpdates = []
  for (const [compound, formula] of Object.entries(formulas)) {
    const [tab, header] = compound.split("|")
    const headers = rowsByTitle.get(tab)?.[0] || []
    const column = headers.indexOf(header)
    if (column < 0) throw new Error(`Formula target not found: ${tab}.${header}`)
    const letter = columnName(column)
    clearRanges.push(`'${tab}'!${letter}2:${letter}`)
    formulaUpdates.push({ range: `'${tab}'!${letter}2`, values: [[formula]] })
  }
  if (clearRanges.length) await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: clearRanges } })
  if (formulaUpdates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: formulaUpdates } })

  // Re-read the sample rows after formula evaluation so the Operations guide
  // never preserves a stale error/value from the pre-update state.
  const refreshedValues = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: "FORMATTED_VALUE" })
  rowsByTitle = new Map(tabs.map((sheet, index) => [sheet.properties.title, refreshedValues.data.valueRanges?.[index]?.values || []]))

  const guideRows = [["TAB", "WHAT OPERATIONS ENTERS", "ROW RULE", "UPDATE RHYTHM", "FORMAT", "SELF LEARN PAGE", "DASHBOARD COMPONENT", "COLUMN TYPE", "USER ACTION / FORMULA", "EXAMPLE", "VISIBLE?"]]
  const userTabs = Object.keys(tabPurpose)
  for (const title of userTabs) {
    const headers = rowsByTitle.get(title)?.[0] || []
    const sample = rowsByTitle.get(title)?.[1] || []
    const [page, component] = tabPurpose[title]
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index]
      const calculated = calculatedColumns[title]?.has(header) || false
      const hidden = hiddenColumns[title]?.has(header) || false
      guideRows.push([
        title,
        header,
        "One row per source event/entity; append new snapshots instead of overwriting history where time-series data is required",
        title.includes("Hourly") ? "Each operating update/hour" : title === "Finance_Daily" ? "Each finance snapshot/day" : "When the source fact changes",
        formatFor(header),
        page,
        component,
        calculated ? "AUTO-CALCULATED" : hidden ? "SYSTEM / HIDDEN" : "OPS INPUT",
        calculated ? `Do not type. Formula: ${formulas[`${title}|${header}`] || "Calculated by dashboard/application"}` : hidden ? "No routine Operations entry required" : "Operations enters or replaces the current TEST DATA value",
        sample[index] === undefined ? "" : String(sample[index]),
        hidden ? "Hidden column" : "Visible column",
      ])
    }
  }

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `DATA_ENTRY_GUIDE!A1:K${guideRows.length}`, valueInputOption: "RAW", requestBody: { values: guideRows } })

  const requests = []
  for (const sheet of tabs) {
    const title = sheet.properties.title
    if (title === "READ ME FIRST") continue
    requests.push({ updateSheetProperties: { properties: { sheetId: sheet.properties.sheetId, hidden: hiddenTabs.has(title) }, fields: "hidden" } })
    for (const protectedRange of sheet.protectedRanges || []) {
      if (String(protectedRange.description || "").startsWith("Self Learn Ops")) requests.push({ deleteProtectedRange: { protectedRangeId: protectedRange.protectedRangeId } })
    }
  }

  for (const title of [...userTabs, "DATA_ENTRY_GUIDE", "Previous_Block", "actions", "executionQueue"]) {
    const sheet = byTitle.get(title)
    if (!sheet) continue
    const headers = title === "DATA_ENTRY_GUIDE" ? guideRows[0] : (rowsByTitle.get(title)?.[0] || [])
    if (!headers.length) continue
    const sheetId = sheet.properties.sheetId
    const lastColumn = headers.length
    const gridColumns = sheet.properties.gridProperties?.columnCount || lastColumn

    requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } })
    requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastColumn }, cell: { userEnteredFormat: { backgroundColor: HEADER, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)" } })
    requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } })
    if (gridColumns > lastColumn) requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: lastColumn, endIndex: gridColumns }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } })

    const calculated = calculatedColumns[title] || new Set()
    const explicitlyHidden = hiddenColumns[title] || new Set()
    for (let column = 0; column < lastColumn; column += 1) {
      const header = headers[column]
      const isCalculated = calculated.has(header)
      const isHidden = explicitlyHidden.has(header)
      const [page, component] = tabPurpose[title] || ["Self Learn operations", "Operations guide"]
      const note = isCalculated
        ? `AUTO-CALCULATED / READ-ONLY. ${page} → ${component}. Do not type in this column.`
        : isHidden
          ? `SYSTEM / AUDIT FIELD. Hidden from the routine Self Learn Operations view.`
          : `OPS INPUT. ${page} → ${component}. Format: ${formatFor(header)}`
      requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { note }, fields: "note" } })
      requests.push({ repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: Math.min(200, sheet.properties.gridProperties?.rowCount || 200), startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: isCalculated ? CALCULATED : isHidden ? SYSTEM : INPUT } }, fields: "userEnteredFormat.backgroundColor" } })
      requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 }, properties: { hiddenByUser: isHidden }, fields: "hiddenByUser" } })
      if (isCalculated) requests.push({ addProtectedRange: { protectedRange: { range: { sheetId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 }, description: `Self Learn Ops calculated: ${title}.${header}`, warningOnly: true } } })
    }
    requests.push({ addProtectedRange: { protectedRange: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, description: `Self Learn Ops headers: ${title}`, warningOnly: true } } })
  }

  const dashboardContent = byTitle.get("Dashboard_Content")
  if (dashboardContent) {
    const workspaceValues = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dashboard_Content!A2:A" })
    const rows = workspaceValues.data.values || []
    const hideIndexes = rows.map((row, index) => ({ value: String(row[0] || "").trim().toLowerCase(), rowIndex: index + 1 })).filter((row) => row.value && row.value !== "self-learn").map((row) => row.rowIndex)
    const showIndexes = rows.map((row, index) => ({ value: String(row[0] || "").trim().toLowerCase(), rowIndex: index + 1 })).filter((row) => row.value === "self-learn").map((row) => row.rowIndex)
    for (const [start, end] of groupContiguous(hideIndexes)) requests.push({ updateDimensionProperties: { range: { sheetId: dashboardContent.properties.sheetId, dimension: "ROWS", startIndex: start, endIndex: end }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } })
    for (const [start, end] of groupContiguous(showIndexes)) requests.push({ updateDimensionProperties: { range: { sheetId: dashboardContent.properties.sheetId, dimension: "ROWS", startIndex: start, endIndex: end }, properties: { hiddenByUser: false }, fields: "hiddenByUser" } })
  }

  const guide = byTitle.get("DATA_ENTRY_GUIDE")
  if (guide) {
    requests.push({ repeatCell: { range: { sheetId: guide.properties.sheetId, startRowIndex: 1, endRowIndex: guideRows.length, startColumnIndex: 0, endColumnIndex: 11 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } })
    requests.push({ updateDimensionProperties: { range: { sheetId: guide.properties.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 11 }, properties: { pixelSize: 180 }, fields: "pixelSize" } })
    requests.push({ updateDimensionProperties: { range: { sheetId: guide.properties.sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 210 }, fields: "pixelSize" } })
    requests.push({ updateDimensionProperties: { range: { sheetId: guide.properties.sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 5 }, properties: { pixelSize: 240 }, fields: "pixelSize" } })
    requests.push({ setBasicFilter: { filter: { range: { sheetId: guide.properties.sheetId, startRowIndex: 0, endRowIndex: guideRows.length, startColumnIndex: 0, endColumnIndex: 11 } } } })
  }

  for (let index = 0; index < requests.length; index += 400) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 400) } })
  }

  console.log(JSON.stringify({
    configured: true,
    visibleOperationalTabs: userTabs,
    hiddenTabs: [...hiddenTabs],
    guideRows: guideRows.length - 1,
    calculatedFields: Object.keys(formulas).length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.response?.data || error)
  process.exit(1)
})
