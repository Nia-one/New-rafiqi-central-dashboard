const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  for (const spreadsheetId of process.argv.slice(2)) {
    const book = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false, fields: "properties.title,sheets.properties(sheetId,title,gridProperties)" })
    const output = { spreadsheetId, title: book.data.properties.title, tabs: [] }
    const selected = (book.data.sheets || []).filter((sheet) => {
      const title = sheet.properties.title
      if (spreadsheetId === "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU") return title.startsWith("TEAM_")
      if (spreadsheetId === "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y") return /Demand Visit Data/i.test(title)
      return /order|delivery|payment|cost|customer|guest|master/i.test(title)
    })
    for (const sheet of selected) {
      const title = sheet.properties.title
      const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!1:3` })
      const rows = values.data.values || []
      const likelyHeader = rows.findIndex((row) => {
        const populated = row.filter((cell) => String(cell || "").trim()).length
        return populated >= 4 && row.some((cell) => /(?:^|\s)(?:id|at|date|status)(?:$|\s)/i.test(String(cell || "").replace(/_/g, " ")))
      })
      const headerRowIndex = likelyHeader >= 0 ? likelyHeader : rows.findIndex((row) => row.some((cell) => String(cell || "").trim()))
      const headers = headerRowIndex >= 0 ? rows[headerRowIndex].map((cell) => String(cell || "").trim().slice(0, 120)) : []
      output.tabs.push({ title, sheetId: sheet.properties.sheetId, headerRow: headerRowIndex + 1, headers })
    }
    console.log(JSON.stringify(output))
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
