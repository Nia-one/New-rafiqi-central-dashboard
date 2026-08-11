import { GoogleAuth } from "google-auth-library";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const credentials = googleServiceAccountCredentials();
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

// Dashboard navigation can render several server requests in quick succession.
// Reuse the same governed snapshot for one minute; explicit source syncs call
// clearSheetCache(), so fresh writes still force the next read immediately.
const CACHE_TTL_MS = 60 * 1000;

const sheetCache = new Map<
  string,
  {
    timestamp: number;
    data: string[][];
  }
>();

const batchCache = new Map<string, { timestamp: number; data: string[][][] }>();
const batchRequests = new Map<string, Promise<string[][][]>>();
const persistedBatchPath = join(tmpdir(), "rafiqi-google-sheets-batch-cache.json");

async function readPersistedBatch(key: string) {
  try {
    const snapshots = JSON.parse(await readFile(persistedBatchPath, "utf8")) as Record<string, string[][][]>;
    return snapshots[key];
  } catch {
    return undefined;
  }
}

async function persistBatch(key: string, data: string[][][]) {
  try {
    let snapshots: Record<string, string[][][]> = {};
    try { snapshots = JSON.parse(await readFile(persistedBatchPath, "utf8")); } catch {}
    snapshots[key] = data;
    await writeFile(persistedBatchPath, JSON.stringify(snapshots), "utf8");
  } catch (error) {
    console.warn("Unable to persist Google Sheets batch snapshot.", error);
  }
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Clear in-process Sheet snapshots after a source sync writes new backend rows. */
export function clearSheetCache() {
  // Retain the last successful snapshot as a stale-if-error fallback. A source
  // sync only expires it so the next request still attempts a fresh read.
  sheetCache.forEach((entry) => { entry.timestamp = 0; });
  batchCache.forEach((entry) => { entry.timestamp = 0; });
}

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
  const key = ranges.join("\n");
  const cached = batchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  const active = batchRequests.get(key);
  if (active) return active;
  const stale = cached?.data ?? await readPersistedBatch(key);

  const request = fetchBatch(ranges, stale)
    .then((data) => {
      batchCache.set(key, { timestamp: Date.now(), data });
      void persistBatch(key, data);
      return data;
    })
    .finally(() => { batchRequests.delete(key); });
  batchRequests.set(key, request);
  return request;
}

async function fetchBatch(ranges: string[], stale?: string[][][]) {
  let accessToken: string | null | undefined;
  let lastNetworkError: unknown;
  for (let attempt = 0; attempt < 3 && !accessToken; attempt++) {
    try {
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < 2) await wait(1_000 * 2 ** attempt);
    }
  }

  if (!accessToken) {
    if (stale) return stale;
    throw lastNetworkError instanceof Error ? lastNetworkError : new Error("Unable to obtain Google access token.");
  }

  const params = new URLSearchParams();

  ranges.forEach((range) => {
    params.append("ranges", range);
  });

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values:batchGet?${params.toString()}`;

  console.log("GOOGLE BATCH FETCH:", ranges.length, "ranges");

  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    } catch (error) {
      lastNetworkError = error;
      response = undefined;
    }
    if (response?.ok) break;
    if (response && response.status !== 429 && response.status < 500) throw new Error(await response.text());
    if (attempt < 2) await wait(response?.status === 429 ? 10_000 * (attempt + 1) : 1_000 * 2 ** attempt);
  }

  if (!response?.ok) {
    const message = await response?.text();
    if (stale) {
      console.warn("Google Sheets quota unavailable; serving last successful batch snapshot.");
      return stale;
    }
    if (response?.status === 429) {
      // Never cache an all-empty batch as though it were a successful read.
      // Doing so turns a temporary quota response into a full-dashboard outage
      // for the cache lifetime and prevents the next request from recovering.
      throw new Error("Google Sheets quota unavailable and no successful snapshot exists.");
    }
    if (lastNetworkError instanceof Error) throw lastNetworkError;
    throw new Error(message || "Google Sheets batch read failed");
  }

  const json = await response.json();

  return (json.valueRanges || []).map(
    (item: any) => item.values ?? []
  );
}


