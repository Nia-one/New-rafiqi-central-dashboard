import "server-only";
import { GoogleAuth } from "google-auth-library";

import fs from "fs";
import path from "path";

const keyFile = path.join(
  process.cwd(),
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
);

const credentials = JSON.parse(
  fs.readFileSync(keyFile, "utf8")
);
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const CACHE_TTL_MS = 60 * 1000;

const sheetCache = new Map<
  string,
  {
    timestamp: number;
    data: string[][];
  }
>();

export async function getSheet(range: string) {
  const cached = sheetCache.get(range);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log("CACHE HIT:", range);
    return cached.data;
  }

  console.log("GOOGLE FETCH:", range);

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token;

  if (!accessToken) {
    throw new Error("Unable to obtain Google access token.");
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();

  const values = (json.values ?? []) as string[][];

  sheetCache.set(range, {
    timestamp: Date.now(),
    data: values,
  });

  return values;
}

export async function batchGet(ranges: string[]) {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token;

  if (!accessToken) {
    throw new Error("Unable to obtain Google access token.");
  }

  const params = new URLSearchParams();

  ranges.forEach((range) => {
    params.append("ranges", range);
  });

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values:batchGet?${params.toString()}`;

  console.log("GOOGLE BATCH FETCH:", ranges.length, "ranges");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();

  return (json.valueRanges || []).map(
    (item: any) => item.values ?? []
  );
}


