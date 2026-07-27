/* Creates the editable Google Sheet source for the Self Learn Learning history page. */
require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const NOW = "2026-07-25T12:00:00+05:30"
const HISTORY_TAB = "Learning_History"
const HISTORY_HEADERS = ["id", "domain", "observed", "proposed change", "expected effect", "attribution", "confidence", "disposition", "owner actor id", "updated at", "notes"]
const HISTORY_ROWS = [
  ["LH-001", "Enterprise Demand", "Close verified-ready Nests around the next confirmed enterprise arrival before the activation date.", "Keep the 2 km-first readiness rule under observation until verified arrival cycles accumulate.", "Improve contract readiness without widening the route prematurely.", "Observed only · confounders not ruled out", "Low", "Monitor only", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-002", "Member Adds", "Compare the eligible channels that produce billing-live FONO fills fastest at the lowest actual CAC.", "Compare Franchisee base-forecast ranking with independently verified CAC, conversion and time-to-billing; calibrate only within current bounds.", "Improve FONO channel choice using actual conversion and CAC.", "Observed only · confounders not ruled out", "Low", "Human sign-off", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-003", "Member Engagement", "Improve verified recovery before the next cohort checkpoint without changing human-controlled policy.", "Re-rank eligible retention interventions by verified recovery speed within current policy bounds.", "Improve verified recovery before the next cohort checkpoint without changing human-controlled policy.", "Observed only · confounders not ruled out", "Low", "Monitor only", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-004", "Member Savings", "Recover Member savings, Nia margin, attach or repeat without changing price or supplier policy automatically.", "Re-rank eligible shadow interventions by verified dual-gate recovery within current approved boundaries.", "Recover Member savings, Nia margin, attach or repeat without changing price or supplier policy automatically.", "Observed only · confounders not ruled out", "Low", "Human sign-off", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-005", "Nia Margins", "Full-use CM2 is below the current control; occupancy is the largest measured operating cause.", "Calibrate only after verified margin recovery.", "Improve the next target without moving the governed CM definition.", "Observed only · confounders not ruled out", "Low", "Human sign-off", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-006", "Nia Growth", "Reduce independently verified opportunity-to-activation-ready time without crossing capital or contract boundaries.", "Re-rank eligible FONO shadow-readiness interventions within the same approved channel.", "Reduce opportunity-to-activation-ready time without crossing capital or contract boundaries.", "Compared", "Low", "Human sign-off", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
  ["LH-007", "Cash & Control", "The monthly destination is not approved.", "Re-rank the evidence-eligible channel recommendation inside the currently approved boundary.", "Improve verified CM and cash delivery without changing the approved destination.", "Observed only · confounders not ruled out", "Low", "Human sign-off", "ACT-PRIYA", NOW, "Test seed — Operations updates after verified review."],
]
const CONTENT_HEADERS = ["workspace", "page", "component", "key", "value", "format", "owner", "source_tab", "last_updated"]
const CONTENT_ROWS = [
  ["self-learn", "Definitions", "learning_history", "title", "What Nia learned from verified outcomes", "text", "Operations", HISTORY_TAB, NOW],
  ["self-learn", "Definitions", "learning_history", "subtitle", "Small, reversible improvements can be logged. Material changes always wait for sign-off.", "text", "Operations", HISTORY_TAB, NOW],
  ["self-learn", "Definitions", "learning_history", "adoption_rule", "No material target, channel, CM, cash, pricing or human-authority change is adopted automatically.", "text", "Operations", HISTORY_TAB, NOW],
  ["self-learn", "Definitions", "learning_history", "summary_label", "Learning summary", "text", "Operations", HISTORY_TAB, NOW],
  ["self-learn", "Definitions", "learning_history", "verified_learnings_label", "Verified outcome learnings", "text", "Operations", HISTORY_TAB, NOW],
  ["self-learn", "Definitions", "learning_history", "adoption_rule_label", "Adoption rule", "text", "Operations", HISTORY_TAB, NOW],
]

async function ensureSheet(sheets, spreadsheetId, title) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === title)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } })
  }
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  await ensureSheet(sheets, spreadsheetId, HISTORY_TAB)
  await ensureSheet(sheets, spreadsheetId, "Dashboard_Content")

  const history = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${HISTORY_TAB}!A:Z` })).data.values || []
  if (!history.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${HISTORY_TAB}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [HISTORY_HEADERS, ...HISTORY_ROWS] } })
  else {
    const existingById = new Map(history.slice(1).map((row, index) => [row[0], { row, rowNumber: index + 2 }]))
    // Update only the three untouched rows created by the first test seed. Real Operations rows are never overwritten.
    const originalSeedObserved = new Set([
      "FONO occupancy is below activation-ready capacity for the current cycle.",
      "Work revenue is concentrated in the current enterprise roster.",
      "Member savings and stock availability need to be reviewed together.",
    ])
    const safeUpdates = HISTORY_ROWS.filter((row) => {
      const existing = existingById.get(row[0])?.row
      return existing && originalSeedObserved.has(existing[2]) && existing[10] === "Operations updates after verified review."
    })
    for (const row of safeUpdates) {
      const rowNumber = existingById.get(row[0]).rowNumber
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${HISTORY_TAB}!A${rowNumber}:K${rowNumber}`, valueInputOption: "USER_ENTERED", requestBody: { values: [row] } })
    }
    const ids = new Set(history.slice(1).map((row) => row[0]))
    const missing = HISTORY_ROWS.filter((row) => !ids.has(row[0]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${HISTORY_TAB}!A:Z`, valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }

  const content = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dashboard_Content!A:I" })).data.values || []
  if (!content.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "Dashboard_Content!A1", valueInputOption: "USER_ENTERED", requestBody: { values: [CONTENT_HEADERS, ...CONTENT_ROWS] } })
  else {
    const contentKeys = new Set(content.slice(1).map((row) => `${row[1]}|${row[2]}|${row[3]}`.toLowerCase()))
    const missing = CONTENT_ROWS.filter((row) => !contentKeys.has(`${row[1]}|${row[2]}|${row[3]}`.toLowerCase()))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Dashboard_Content!A:I", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }
  console.log("Learning_History is ready. Operations updates recommendation rows there; UI copy is in Dashboard_Content.")
}

main().catch((error) => { console.error(error); process.exit(1) })
