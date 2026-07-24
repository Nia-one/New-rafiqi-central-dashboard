require("dotenv").config({path:".env.local"});

const fs=require("fs");
const path=require("path");
const {google}=require("googleapis");

async function run(){

const credentials=JSON.parse(
 fs.readFileSync(
  path.join(
   process.cwd(),
   process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  ),
  "utf8"
 )
);

const auth=new google.auth.GoogleAuth({
 credentials,
 scopes:["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets=google.sheets({
 version:"v4",
 auth
});

const result = await sheets.spreadsheets.values.batchGet({
 spreadsheetId: process.env.GOOGLE_SHEET_ID,
 ranges:[
  "rootCause!A:Z",
  "actions!A:Z",
  "executionQueue!A:Z"
 ]
});

console.log(JSON.stringify(result.data.valueRanges,null,2));

}

run().catch(console.error);
