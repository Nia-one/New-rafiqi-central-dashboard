import { google } from "googleapis"
import { config } from "dotenv"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

config({ path: ".env.local", quiet: true })
async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index)" })
  const title = (metadata.data.sheets || []).map((sheet) => sheet.properties).filter((properties) => properties?.title === "Fono Funnel" || properties?.title?.startsWith("Fono Funnel (")).sort((a, b) => (b?.index || 0) - (a?.index || 0))[0]?.title
  if (!title) throw new Error("Fono Funnel tab not found")
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!A1:AZ10` })
  const rows = response.data.values || []
  const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
  const headerIndex = rows.findIndex((row) => row.map(normal).includes("nests potential") && row.map(normal).includes("corridor"))
  if (headerIndex < 0) throw new Error(`${title} header row not found`)
  const headers = [...rows[headerIndex]]
  for (const column of ["Latitude", "Longitude"]) if (!headers.some((header) => normal(header) === normal(column))) headers.push(column)
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${title}'!A${headerIndex + 1}`, valueInputOption: "RAW", requestBody: { values: [headers] } })
  console.log(JSON.stringify({ spreadsheetId, tab: title, headerRow: headerIndex + 1, headers }))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
