require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const MASTER_TSV = `Theatre\tStudio Code\tStudio\tLocation
Rajputana\tRJT-FN-D01\tNia Nest Ompal\tFarukhnagar
Rajputana\tRJT-FN-D01-S01\tNia Nest Shiv Kumar\tFarukhnagar
Rajputana\tRJT-FN-D01-S06\tNia Nest Ram Bhatari\tFarukhnagar
Rajputana\tRJT-FN-D01-S11\tNia Nest Jaswant Singh\tFarukhnagar
Rajputana\tRJT-FN-D01-S12\tNia Nest Vansh\tFarukhnagar
Rajputana\tRJT-FN-D01-S15\tNia Nest Kamala Devi Yadhav\tFarukhnagar
Rajputana\tRJT-FN-D01-S16\tNia Nest Rekha Yadav\tFarukhnagar
Rajputana\tRJT-FN-D01-S18\tNia Nest Pradip Yadav\tFarukhnagar
Rajputana\tRJT-FN-D01-S21\tNia Nest Bal Kishan - 01\tFarukhnagar
Rajputana\tRJT-FN-D01-S23\tNia Nest Binu\tFarukhnagar
Rajputana\tRJT-FN-D01-S24\tNia Nest Kaushlya\tFarukhnagar
Rajputana\tRJT-FN-D01-S26\tNia Nest Praveen\tFarukhnagar
Rajputana\tRJT-FN-D01-S27\tNia Nest Azad Singh\tFarukhnagar
Rajputana\tRJT-FN-D01-S28\tNia Nest Parul Yadav\tFarukhnagar
Rajputana\tRJT-FN-D01-S29\tNia Nest Bala Devi\tFarukhnagar
Rajputana\tRJT-FN-D01-S33\tNia Nest Narender | Rajbala\tFarukhnagar
Rajputana\tRJT-FN-D01-S34\tNia Nest Gulshan Yadav\tFarukhnagar
Rajputana\tRJT-MNS-D01\tNia Nest Subash Yadav Pardhan\tManesar
Rajputana\tRJT-MNS-D01-S01\tNia Nest Ravinder Yadav\tManesar
Rajputana\tRJT-MNS-D01-S02\tNia Nest Naveen\tManesar
Rajputana\tRJT-MNS-D01-S03\tNia Nest Rajender Kumar | Hemchand\tManesar
Rajputana\tRJT-MNS-D01-S04\tNia Nest Dhanesh Kumar\tManesar
Rajputana\tRJT-MNS-D01-S06\tNia Nest Kanwal Kumar\tManesar
Rajputana\tRJT-MNS-D01-S08\tNia Nest Sunita Devi\tManesar
Rajputana\tRJT-FN-D01-S22\tNia Nest Bal Kishan - 02\tFarukhnagar
Rajputana\tRJT-MNS-D01-S13\tNia Nest Mr Ankit Rao\tManesar
Wellington\tWLG-HSR-D01\tNia Nest Britto\tHosur
Wellington\tWLG-HSR-D01-S10\tNia Nest Ravikumar\tHosur
Wellington\tWLG-HSR-D01-S04\tNia Nest Dayananda Sagar AR\tHosur
Wellington\tWLG-HSR-D01-S20\tNia Nest Umapahti\tHosur
Wellington\tWLG-BLR-D01\tNia Nest Shivaji Nagar ( Central )\tBanglore
Coromandel\tCRM-SRI-D01-S01\tNia Nest Menaka Ramdas\tSriperumdur
Coromandel\tCRM-SRI-D01-S09\tNia Nest Vasu\tSriperumdur
Coromandel\tCRM-SRI-D01-S08\tNia Nest Hemalata Elumalai\tSriperumdur
Coromandel\tCRM-SRI-D01-S07\tNia Nest K Saralavathi Kothandaraman\tSriperumdur
Deccan\tDCN-CHK-D01-S15\tNia Nest - Kiran Kamble\tPune
Deccan\tDCN-CHK-D01-S16\tNia Nest Kalpesh Pathare\tPune
Rajputana\tRJT-MNS-D01-S15\tNia Nest Dhanesh Kumar 02\tManesar
Rajputana\tRJT-MNS-D01-S16\tNia Nest - Udaibir\tManesar
Coromandel\tCRM-SRI-D01-S10\tNia Nest Syed\tSriperumdur
Wellington\tWLG-HSR-D01-S21\tNia Nest Munirappa\tHosur
Wellington\tWLG-HSR-D01-S22\tNia Nest Venkatesh\tHosur
Coromandel\tCRM-SRI-D01-S11\tNia Nest Arvind\tSriperumdur
Wellington\tWLG-HSR-D01-S23\tNia Nest Kumar\tHosur
Wellington\tWLG-HSR-D01-S24\tNia Nest Hemant 2\tHosur
Wellington\tWLG-HSR-D01-S25\tNia Nest Sanjeevan\tHosur
Wellington\tWLG-HSR-D01-S26\tNia Nest Rathnamma\tHosur
Wellington\tWLG-HSR-D01-S27\tNia Nest Ravi Bhadrappa\tHosur
Wellington\tWLG-HSR-D01-S28\tNia Nest Ravi Narasimmaiyya\tHosur
Rajputana\tRJT-FN-D01-S37\tNia Nest Sathyanarayana\tFarukhnagar
Rajputana\tRJT-FN-D01-S38\tNia Nest Krishna Kumar\tFarukhnagar
Coromandel\tCRM-SRI-D01-S12\tNia Nest Suresh Mani\tSriperumdur
Rajputana\tRJT-FN-D01-S39\tNia Nest Bhim Singh\tFarukhnagar
Rajputana\tRJT-FN-D01-S40\tNia Nest Sanjay Dagar\tFarukhnagar
Rajputana\tRJT-FN-D01-S41\tNia Nest Santosh Devi\tFarukhnagar
Rajputana\tRJT-FN-D01-S42\tNia Nest Chirag Yadav\tFarukhnagar
Rajputana\tRJT-FN-D01-S44\tNia Nest Manjeet Kumar\tFarukhnagar
Rajputana\tRJT-FN-D01-S45\tNia Nest Devindra\tFarukhnagar
Rajputana\tRJT-FN-D01-S46\tNia Nest Sandeep\tFarukhnagar
Rajputana\tRJT-FN-D01-S47\tNia Nest Mahindra\tFarukhnagar
Rajputana\tRJT-FN-D01-S49\tNia Nest Bharam Parkash\tFarukhnagar
Coromandel\tCRM-SRI-D01-S15\tNia Nest Shankar\tSriperumdur
Rajputana\tRJT-FN-D01-S55\tNia Nest Mamkaur\tFarukhnagar
Wellington\tWLG-HSR-D01-S29\tNia Nest Saicharan\tHosur
Wellington\tWLG-HSR-D01-S30\tNia Nest Raja Reddy\tHosur`

const THEATRE_IDS = { Rajputana: "THR-RJT", Wellington: "THR-WLG", Coromandel: "THR-CHN", Deccan: "THR-DCN" }
const THEATRE_CODES = { Rajputana: "RJT", Wellington: "WLG", Coromandel: "CRM", Deccan: "DCN" }
const rows = MASTER_TSV.trim().split("\n").slice(1).map((line) => {
  const [theatre, studioCode, studio, location] = line.split("\t")
  return { theatre, studioCode, studio, location }
})

const value = (record, header) => record[header] ?? ""
const rowFor = (headers, record) => headers.map((header) => value(record, header))

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const now = new Date().toISOString()
  const sourceId = "SRC-USER-STUDIO-MASTER-2026-07-26"

  const theatreResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Theatre_Master!A:AZ" })
  const theatreValues = theatreResponse.data.values || []
  const theatreHeaders = theatreValues[0] || []
  const oldTheatres = theatreValues.slice(1).map((row) => Object.fromEntries(theatreHeaders.map((header, index) => [header, row[index] ?? ""])))
  const theatreLocations = new Map()
  for (const row of rows) theatreLocations.set(row.theatre, [...new Set([...(theatreLocations.get(row.theatre) || []), row.location])])
  const theatreRecords = Object.keys(THEATRE_IDS).map((name) => {
    const previous = oldTheatres.find((row) => row["theatre id"] === THEATRE_IDS[name]) || {}
    return { ...previous, "theatre id": THEATRE_IDS[name], "theatre name": name, "theatre code": THEATRE_CODES[name], active: "TRUE", geography: theatreLocations.get(name).join(" / "), "updated at": now, "source id": sourceId }
  })
  const retainedTheatres = oldTheatres.filter((row) => !Object.values(THEATRE_IDS).includes(row["theatre id"])).map((row) => ({ ...row, active: "FALSE" }))

  const studioResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Studio_Master!A:AZ" })
  const studioValues = studioResponse.data.values || []
  const studioHeaders = studioValues[0] || []
  const oldStudios = studioValues.slice(1).map((row) => Object.fromEntries(studioHeaders.map((header, index) => [header, row[index] ?? ""])))
  const activeCodes = new Set(rows.map((row) => row.studioCode))
  const studioRecords = rows.map((row) => {
    const previous = oldStudios.find((entry) => entry["studio id"] === row.studioCode) || {}
    return { ...previous, "studio id": row.studioCode, "theatre id": THEATRE_IDS[row.theatre], "studio name": row.studio, address: row.location, active: "TRUE", "updated at": now, "source id": sourceId }
  })
  const retainedStudios = oldStudios.filter((row) => !activeCodes.has(row["studio id"])).map((row) => ({ ...row, active: "FALSE" }))

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Theatre_Master!A2:AZ" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "Theatre_Master!A2", valueInputOption: "USER_ENTERED", requestBody: { values: [...theatreRecords, ...retainedTheatres].map((record) => rowFor(theatreHeaders, record)) } })
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Studio_Master!A2:AZ" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "Studio_Master!A2", valueInputOption: "USER_ENTERED", requestBody: { values: [...studioRecords, ...retainedStudios].map((record) => rowFor(studioHeaders, record)) } })

  const verify = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ["Theatre_Master!A:AZ", "Studio_Master!A:AZ"] })
  const [verifiedTheatres = [], verifiedStudios = []] = (verify.data.valueRanges || []).map((range) => range.values || [])
  const activeTheatreRows = verifiedTheatres.slice(1).filter((row) => String(row[theatreHeaders.indexOf("active")] || "").toUpperCase() === "TRUE")
  const activeStudioRows = verifiedStudios.slice(1).filter((row) => String(row[studioHeaders.indexOf("active")] || "").toUpperCase() === "TRUE")
  const verifiedNames = activeTheatreRows.map((row) => row[theatreHeaders.indexOf("theatre name")]).sort()
  const expectedNames = Object.keys(THEATRE_IDS).sort()
  if (JSON.stringify(verifiedNames) !== JSON.stringify(expectedNames) || activeStudioRows.length !== rows.length) throw new Error(`Master verification failed: ${verifiedNames.length} theatres, ${activeStudioRows.length} studios`)
  console.log(JSON.stringify({ activeTheatres: activeTheatreRows.length, activeTheatreNames: verifiedNames, activeStudios: activeStudioRows.length, inactiveStudiosRetained: retainedStudios.length, locations: Object.fromEntries(theatreLocations), verified: true }))
}

main().catch((error) => { console.error(error); process.exit(1) })
