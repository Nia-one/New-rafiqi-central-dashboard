import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { actorFromRequest } from "@/lib/access-control"
import { selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildClosedLoopPreview } from "@/lib/operating-loop/preview"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (process.env.RAFIQI_SELF_DRIVE_PLATFORM?.trim().toLowerCase() !== "true" || !selfDrivePlatformEnabled()) return NextResponse.json({ error: "Self Drive platform is disabled." }, { status: 404 })
  return NextResponse.json({ actor: { actorId: actor.actorId, role: actor.role }, preview: buildClosedLoopPreview(), writesEnabled: false }, { headers: { "Cache-Control": "no-store" } })
}
