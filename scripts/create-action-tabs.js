require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

async function createMissingTabs(){

const credentials = JSON.parse(
 fs.readFileSync(
  path.join(
   process.cwd(),
   process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  ),
  "utf8"
 )
);

const auth = new google.auth.GoogleAuth({
 credentials,
 scopes:["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({
 version:"v4",
 auth
});

const spreadsheetId = process.env.GOOGLE_SHEET_ID;


const requiredTabs=[
 {
  title:"rootCause",
  headers:[
   "id",
   "constraintId",
   "rootCause",
   "evidence",
   "owner",
   "nextStep"
  ]
 },
 {
  title:"actions",
  headers:[
   "id",
   "constraintId",
   "action",
   "owner",
   "status",
   "dueDate"
  ]
 },
 {
  title:"executionQueue",
  headers:[
   "id",
   "constraintId",
   "priority",
   "cmRisk",
   "owner",
   "status"
  ]
 }
];


const spreadsheet =
await sheets.spreadsheets.get({
 spreadsheetId
});


const existing =
spreadsheet.data.sheets.map(
 s=>s.properties.title
);


const createRequests=[];


for(const tab of requiredTabs){

if(!existing.includes(tab.title)){

createRequests.push({
 addSheet:{
  properties:{
   title:tab.title
  }
 }
});

}

}


if(createRequests.length){

await sheets.spreadsheets.batchUpdate({
 spreadsheetId,
 requestBody:{
  requests:createRequests
 }
});

}


for(const tab of requiredTabs){

await sheets.spreadsheets.values.update({

spreadsheetId,

range:`${tab.title}!A1`,

valueInputOption:"RAW",

requestBody:{
 values:[
  tab.headers
 ]
}

});

}


console.log("✅ Root cause/action tabs ready");

}


createMissingTabs()
.catch(err=>{
 console.error(err);
 process.exit(1);
});
