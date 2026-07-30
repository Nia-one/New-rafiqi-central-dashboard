import { NextResponse } from "next/server";
import { buildOpsData } from "@/lib/opsDataMapper";
import { syncAllSources } from "@/lib/sourceSync";

export const dynamic = "force-dynamic";

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
    const result = await syncAllSources({ force: url.searchParams.get("auto") !== "1" });
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Team input sync error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
