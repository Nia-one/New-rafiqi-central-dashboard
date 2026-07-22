import { NextRequest, NextResponse } from "next/server"
import { acknowledgeHeartbeat, readHeartbeatSnapshot } from "@/lib/heartbeat-store"
import { actorFromRequest } from "@/lib/access-control"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(readHeartbeatSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  })
}

export async function POST(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  try {
    const body = await request.json() as { heartbeat_id?: unknown }
    if (typeof body.heartbeat_id !== "string") {
      return NextResponse.json({ error: "Heartbeat alert is required." }, { status: 400 })
    }
    return NextResponse.json(acknowledgeHeartbeat(body.heartbeat_id, actor.actorId), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The acknowledgment could not be recorded." }, { status: 400 })
  }
}
