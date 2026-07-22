import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { GoogleAuth } from "google-auth-library";

async function run() {

  const credentials = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
      ),
      "utf8"
    )
  );

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token;

  const values = [
    [
      "id",
      "title",
      "where",
      "impact",
      "detail",
      "owner",
      "next",
      "lane",
      "stalledBlocks"
    ],
    [
      "c001",
      "Live Nests idle without named demand",
      "Chakan 04",
      "440000",
      "128 live Nests unoccupied without enterprise demand",
      "Demand JCO",
      "Verify demand link and reallocate capacity",
      "FONO",
      "5"
    ],
    [
      "c002",
      "No viable supply inside SLA for named demand",
      "Sriperumbudur 02",
      "286000",
      "Supply response breached 24h SLA",
      "Supply JCO",
      "Escalate replacement option",
      "Shram Park",
      "1"
    ],
    [
      "c003",
      "High-repeat SKU below safety stock",
      "Hosur 01",
      "182000",
      "Inventory below safety level",
      "EAE",
      "Trigger replenishment",
      "Essentials",
      "0"
    ]
  ];

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${process.env.GOOGLE_SHEET_ID}/values/` +
    `${encodeURIComponent("Constraints!A1:I4")}?valueInputOption=RAW`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: "Constraints!A1:I4",
      majorDimension: "ROWS",
      values,
    }),
  });

  console.log("STATUS:", response.status);
  console.log(await response.text());
}

run();
