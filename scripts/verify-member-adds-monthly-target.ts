import { config } from "dotenv"
import { buildOpsData } from "../lib/opsDataMapper"
import { buildLiveNewAddsFillStatus, buildLiveSelfDriveSnapshot } from "../lib/live-mappers/self-drive"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

config({ path: ".env.local" })

buildOpsData()
  .then(async (ops) => {
    const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
    const sheets = google.sheets({ version: "v4", auth })
    const direct = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID!, range: "Enterprise_Demand!A:AZ" })
    const rows = direct.data.values || []
    const headers = (rows[0] || []).map((value) => String(value).trim().toLowerCase())
    const role = headers.indexOf("role required")
    const targetRows = rows.slice(1).filter((row) => row.some((cell) => /monthly.target|member adds target/i.test(String(cell || ""))))
    console.log(JSON.stringify({ roleIndex: role, targetRows, status: buildLiveNewAddsFillStatus(buildLiveSelfDriveSnapshot(ops)) }, null, 2))
  })
  .catch((error) => { console.error(error); process.exitCode = 1 })
