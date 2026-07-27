require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

async function main() {
  const credentials = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"),
      "utf8"
    )
  )
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "properties.title,sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description,range,warningOnly))",
  })

  const tabs = (metadata.data.sheets || [])
    .sort((left, right) => (left.properties.index || 0) - (right.properties.index || 0))
  const ranges = tabs.map((sheet) => `'${String(sheet.properties.title).replaceAll("'", "''")}'!1:3`)
  const values = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "FORMULA",
  })

  const report = tabs.map((sheet, index) => {
    const rows = values.data.valueRanges?.[index]?.values || []
    return {
      title: sheet.properties.title,
      index: sheet.properties.index,
      hidden: Boolean(sheet.properties.hidden),
      rowCount: sheet.properties.gridProperties?.rowCount || 0,
      columnCount: sheet.properties.gridProperties?.columnCount || 0,
      headers: rows[0] || [],
      sample: rows[1] || [],
      formulaSample: (rows[1] || []).map((value, column) =>
        typeof value === "string" && value.startsWith("=")
          ? { column: (rows[0] || [])[column] || column + 1, formula: value }
          : null
      ).filter(Boolean),
      protectedRanges: (sheet.protectedRanges || []).map((item) => ({
        description: item.description || "",
        range: item.range,
        warningOnly: Boolean(item.warningOnly),
      })),
    }
  })

  console.log(JSON.stringify({ title: metadata.data.properties?.title, tabs: report }, null, 2))
}

main().catch((error) => {
  console.error(error?.response?.data || error)
  process.exit(1)
})
