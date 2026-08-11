import { NextResponse } from "next/server";
import { buildOpsData } from "@/lib/opsDataMapper";
import { syncAllSources, syncFreshInputs, syncLiveSources, syncUserInputs } from "@/lib/sourceSync";
import { clearSheetCache } from "@/lib/googleSheets";
import { revalidateTag, unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Deduplicate automatic syncs across browsers and serverless instances. The
// source is still live, but at most one governed input sync is executed in a
// five-minute quota window.
const syncCachedUserInputs = unstable_cache(
  () => syncUserInputs(),
  ["governed-user-input-sync-v1"],
  { revalidate: 300 },
);
const syncCachedFreshInputs = unstable_cache(
  () => syncFreshInputs(),
  ["governed-fresh-input-sync-v1"],
  { revalidate: 60 },
);

export async function GET() {
  try {
    const data = await buildOpsData();
    const serializableData = {
      ...data,
      fetchedAt: new Date().toISOString(),
      dashboardContent: Array.from(data.dashboardContent.values()),
    };

    return NextResponse.json({
      success: true,
      data: serializableData,
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" } });
  } catch (error) {
    console.error("Ops Data API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const fullSync = url.searchParams.get("full") === "1";
    const liveSync = url.searchParams.get("live") === "1";
    const inputSync = url.searchParams.get("input") === "1";
    const freshSync = url.searchParams.get("fresh") === "1";
    const result = fullSync ? await syncAllSources({ force: true }) : liveSync ? await syncLiveSources() : inputSync ? await syncCachedUserInputs() : freshSync ? await syncCachedFreshInputs() : null;
    if (result && typeof result === "object" && "changedRows" in result && Number(result.changedRows) > 0) {
      clearSheetCache();
      revalidateTag("governed-ops-data", { expire: 0 });
    }
    return NextResponse.json(
      { success: true, mode: fullSync ? "full-sync" : liveSync ? "live-sync" : inputSync ? "input-sync" : freshSync ? "fresh-input-sync" : "refresh", ...(result ?? {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Ops data refresh error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
