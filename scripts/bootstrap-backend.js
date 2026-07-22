require('dotenv').config({ path: '.env.local' });

const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SOURCE_REGISTRY = [
  {
    name: 'Central Dashboard Backend',
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    tab: 'Source_Registry',
    owner: 'System',
    frequencyMinutes: 5,
    lastSourceUpdate: '',
    lastIngested: '',
  },
  {
    name: 'Theatre Master',
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    tab: 'Theatre_Master',
    owner: 'Operations',
    frequencyMinutes: 60,
    lastSourceUpdate: '',
    lastIngested: '',
  },
  {
    name: 'Studio Master',
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    tab: 'Studio_Master',
    owner: 'Operations',
    frequencyMinutes: 60,
    lastSourceUpdate: '',
    lastIngested: '',
  },
  {
    name: 'People Roster',
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    tab: 'People_Roster',
    owner: 'HR',
    frequencyMinutes: 60,
    lastSourceUpdate: '',
    lastIngested: '',
  },
  {
    name: 'Enterprise Demand',
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    tab: 'Enterprise_Demand',
    owner: 'Sales',
    frequencyMinutes: 60,
    lastSourceUpdate: '',
    lastIngested: '',
  },
];

const POLICY_REGISTRY = [
  {
    name: 'Dashboard Refresh Interval',
    value: 5,
    unit: 'Minutes',
    effectiveFrom: '2026-07-21',
    approvedBy: 'System',
    status: 'Active',
    sourceNote: 'Initial bootstrap',
    updatedAt: '',
  },
];

async function getSheetsClient() {
  const client = await auth.getClient();

  return google.sheets({
    version: 'v4',
    auth: client,
  });
}

async function updateRange(sheets, range, values) {
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });

  console.log(
    `✅ Updated ${range} (${response.data.updatedRows} rows, ${response.data.updatedCells} cells)`
  );

  return response.data;
}

async function main() {
  const sheets = await getSheetsClient();

  console.log('✅ Connected to Google Sheets');

  const sourceRegistryRange = `Source_Registry!B2:H${SOURCE_REGISTRY.length + 1}`;

const sourceRegistryValues = SOURCE_REGISTRY.map((row) => [
  row.name,
  row.spreadsheetId,
  row.tab,
  row.owner,
  row.frequencyMinutes,
  row.lastSourceUpdate,
  row.lastIngested,
]);

await updateRange(
  sheets,
  sourceRegistryRange,
  sourceRegistryValues
);

  console.log('✅ Source Registry updated');


const policyRegistryRange = `Policy_Registry!B2:I${POLICY_REGISTRY.length + 1}`;

const policyRegistryValues = POLICY_REGISTRY.map((row) => [
  row.name,
  row.value,
  row.unit,
  row.effectiveFrom,
  row.approvedBy,
  row.status,
  row.sourceNote,
  row.updatedAt,
]);

await updateRange(
  sheets,
  policyRegistryRange,
  policyRegistryValues
);

console.log('✅ Policy Registry updated');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});