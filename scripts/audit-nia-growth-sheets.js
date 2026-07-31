require("dotenv").config({ path: ".env.local" })
const { google } = require("googleapis")
const fs = require("fs")
const path = require("path")

const normal = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const credentials = () => {
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) }
}

const relevant = {
  backend: ["Enterprise_Demand", "Action_Log", "Evidence_Log", "Approval_Log", "Learning_History", "Policy_Registry", "People_Roster", "Studio_Master", "Living_Hourly"],
  input: ["TEAM_NIA_GROWTH", "TEAM_FONO_SUPPLY_DEMAND", "TEAM_SHRAMPARK_DEMAND", "TEAM_OCCUPANCY", "TEAM_REQ_ACTION_LOG", "TEAM_REQ_EVIDENCE_LOG", "TEAM_REQ_APPROVAL_LOG", "TEAM_LEARNING_HISTORY", "TEAM_REQ_POLICY_REGISTRY", "TEAM_REQ_PEOPLE_ROSTER"],
}

async function inspectWorkbook(sheets, spreadsheetId, kind) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties(sheetId,title,tabColorStyle,hidden)" })
  const titles = new Set((metadata.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean))
  const result = { title: metadata.data.properties?.title, spreadsheetId, allTabs: [...titles], tabs: {}, missingTabs: [] }
  for (const tab of relevant[kind]) {
    if (!titles.has(tab)) { result.missingTabs.push(tab); continue }
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:AZ` })
    const rows = response.data.values || []
    const headerIndex = rows.reduce((best, row, index) => {
      const unique = new Set(row.map(normal).filter(Boolean)).size
      return unique > best.unique ? { index, unique } : best
    }, { index: -1, unique: 2 }).index
    const headers = headerIndex >= 0 ? rows[headerIndex].map(String) : []
    const data = headerIndex >= 0 ? rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())) : []
    const nonEmpty = Object.fromEntries(headers.map((header, index) => [normal(header), data.filter((row) => String(row[index] ?? "").trim()).length]))
    result.tabs[tab] = { headerRow: headerIndex + 1, headers, rowCount: data.length, nonEmpty }
  }
  return result
}

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const backendId = process.env.GOOGLE_SHEET_ID
  const inputId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!backendId || !inputId) throw new Error("Google Sheet IDs are missing")
  const [backend, input] = await Promise.all([
    inspectWorkbook(sheets, backendId, "backend"),
    inspectWorkbook(sheets, inputId, "input"),
  ])
  const readObjects = async (spreadsheetId, tab) => {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:AZ` })
    const rows = response.data.values || []
    const headerIndex = rows.reduce((best, row, index) => {
      const unique = new Set(row.map(normal).filter(Boolean)).size
      return unique > best.unique ? { index, unique } : best
    }, { index: -1, unique: 2 }).index
    const headers = rows[headerIndex]?.map(normal) || []
    return rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
  }
  const [demand, actions, evidence, approvals, learning, policies, fono, growthInput, people] = await Promise.all([
    readObjects(backendId, "Enterprise_Demand"), readObjects(backendId, "Action_Log"),
    readObjects(backendId, "Evidence_Log"), readObjects(backendId, "Approval_Log"),
    readObjects(backendId, "Learning_History"), readObjects(backendId, "Policy_Registry"),
    readObjects(inputId, "Fono Funnel"), readObjects(inputId, "TEAM_NIA_GROWTH"), readObjects(backendId, "People_Roster"),
  ])
  const number = (value) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0
  const channel = (row) => {
    const ids = `${row["demand id"]} ${row["source submission id"]}`.toLowerCase()
    if (ids.includes("ops-rpt-fono") || normal(row["role required"]) === "living supply") return "FONO"
    if (ids.includes("sp-bot")) return "SP"
    return "Other"
  }
  const growthDescriptor = (row) => Object.values(row).join(" ").toLowerCase()
  const growthRows = (rows) => rows.filter((row) => /nia growth|nia-growth|growth readiness|capacity expansion|fono expansion|shram park/.test(growthDescriptor(row)))
  const channelSummary = ["FONO", "SP"].map((name) => {
    const rows = demand.filter((row) => channel(row) === name)
    const required = rows.reduce((sum, row) => sum + number(row["headcount required"]), 0)
    const matched = rows.reduce((sum, row) => sum + number(row["headcount matched"]), 0)
    return { channel: name, rows: rows.length, required, matched, gap: Math.max(0, required - matched), missingActivationDate: rows.filter((row) => !row["activation required at"]).length, missingOwner: rows.filter((row) => !row["owner actor id"]).length }
  })
  const sourceAudit = {
    dashboardDemand: channelSummary,
    fonoInput: { rows: fono.length, columns: fono[0] ? Object.keys(fono[0]) : [], nonEmptyByColumn: fono[0] ? Object.fromEntries(Object.keys(fono[0]).map((key) => [key, fono.filter((row) => String(row[key] ?? "").trim()).length])) : {} },
    growthInput: growthInput.map((row) => ({ supplyModel: row["supply model"], requiredNests: row["required nests"], activationReadyNests: row["activation ready nests"], gapNests: row["gap nests"], ownerActorId: row["owner actor id"], signedContractCoveredNests: row["signed contract covered nests"], readinessStatus: row["readiness status"], learningObservation: row["learning observation"] })),
    spOwners: Object.fromEntries([...new Set(demand.filter((row) => channel(row) === "SP").map((row) => row["owner actor id"]))].map((actorId) => [actorId, { rows: demand.filter((row) => channel(row) === "SP" && row["owner actor id"] === actorId).length, displayName: people.find((row) => row["actor id"] === actorId)?.["display name"] || "" }])),
    governance: { actions: growthRows(actions).length, evidence: growthRows(evidence).length, approvals: growthRows(approvals).length, learning: learning.filter((row) => normal(row.domain) === "nia growth").length, policies: growthRows(policies).length },
  }
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), backend, input, sourceAudit }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
