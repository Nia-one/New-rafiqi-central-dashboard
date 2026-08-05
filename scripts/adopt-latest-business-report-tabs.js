require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const bases = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"]

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index)" })
  const tabs = metadata.data.sheets || []
  const adopted = []
  const oldTabs = []
  for (const base of bases) {
    const candidates = tabs.filter((sheet) => sheet.properties.title === base || sheet.properties.title.startsWith(`${base} (`)).sort((a, b) => b.properties.index - a.properties.index)
    const latest = candidates[0]
    const canonical = candidates.find((sheet) => sheet.properties.title === base)
    if (!latest || latest.properties.title === base) continue
    if (canonical) {
      const temporaryTitle = `__OLD_REPORT__${base}`
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: canonical.properties.sheetId, title: temporaryTitle }, fields: "title" } }] } })
      oldTabs.push({ ...canonical.properties, title: temporaryTitle })
    }
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: latest.properties.sheetId, title: base }, fields: "title" } }] } })
    adopted.push({ from: latest.properties.title, to: base, sheetId: latest.properties.sheetId })
  }
  metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index)" })
  const refreshed = metadata.data.sheets || []
  const deleteTargets = refreshed.filter((sheet) => sheet.properties.title.startsWith("__OLD_REPORT__") || sheet.properties.title === "Dashboard")
  if (deleteTargets.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deleteTargets.map((sheet) => ({ deleteSheet: { sheetId: sheet.properties.sheetId } })) } })
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index)" })
  const finalTabs = verified.data.sheets || []
  const duplicates = finalTabs.filter((sheet) => bases.some((base) => sheet.properties.title.startsWith(`${base} (`))).map((sheet) => sheet.properties.title)
  const missing = bases.filter((base) => !finalTabs.some((sheet) => sheet.properties.title === base))
  if (duplicates.length || missing.length) throw new Error(`Report-tab verification failed. Duplicates: ${duplicates.join(", ")}; missing: ${missing.join(", ")}`)
  console.log(JSON.stringify({ adopted, deleted: deleteTargets.map((sheet) => sheet.properties.title), canonicalTabs: bases }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
