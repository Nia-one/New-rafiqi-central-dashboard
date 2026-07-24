require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");


async function seedActionData(){

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



// ROOT CAUSE

await sheets.spreadsheets.values.update({

spreadsheetId,

range:"rootCause!A1",

valueInputOption:"RAW",

requestBody:{
values:[

[
"id",
"constraintId",
"rootCause",
"evidence",
"owner",
"nextStep"
],

[
"rc001",
"c001",
"Idle capacity without demand mapping",
"128 live Nests without enterprise demand",
"Demand JCO",
"Verify demand allocation"
],

[
"rc002",
"c002",
"SLA supply mismatch",
"Supply response breached SLA",
"Supply JCO",
"Escalate replacement"
],

[
"rc003",
"c003",
"Stock below safety threshold",
"Inventory below level",
"EAE",
"Trigger replenishment"
]

]
}

});



// ACTIONS

await sheets.spreadsheets.values.update({

spreadsheetId,

range:"actions!A1",

valueInputOption:"RAW",

requestBody:{
values:[

[
"id",
"constraintId",
"action",
"owner",
"status",
"dueDate"
],

[
"a001",
"c001",
"Allocate demand to idle nests",
"Demand JCO",
"Open",
""
],

[
"a002",
"c002",
"Find replacement supply",
"Supply JCO",
"Open",
""
],

[
"a003",
"c003",
"Replenish SKU",
"EAE",
"Open",
""
]

]
}

});



// EXECUTION QUEUE

await sheets.spreadsheets.values.update({

spreadsheetId,

range:"executionQueue!A1",

valueInputOption:"RAW",

requestBody:{
values:[

[
"id",
"constraintId",
"priority",
"cmRisk",
"owner",
"status"
],

[
"e001",
"c001",
"High",
"38400",
"Demand JCO",
"Open"
],

[
"e002",
"c002",
"Medium",
"7200",
"Supply JCO",
"Open"
],

[
"e003",
"c003",
"Low",
"0",
"EAE",
"Open"
]

]
}

});


console.log("✅ Action data seeded");

}


seedActionData()
.catch(err=>{
console.error(err);
process.exit(1);
});
