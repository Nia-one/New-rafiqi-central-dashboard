import { NextRequest, NextResponse } from "next/server"
import { syncLiveSources } from "@/lib/sourceSync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await syncLiveSources()
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
