import { NextRequest, NextResponse } from "next/server"
import { actorFromRequest } from "@/lib/access-control"
import { buildOpsData } from "@/lib/opsDataMapper"
import { appendHeartbeatAcknowledgment, type HeartbeatAuditEntry, type HeartbeatSnapshot } from "@/lib/heartbeat-control"
import { buildLiveHeartbeatSnapshot } from "@/lib/live-mappers/heartbeat"

export const dynamic = "force-dynamic"

let acknowledgments: HeartbeatAuditEntry[] = []

async function liveSnapshot(): Promise<HeartbeatSnapshot | null> {
  const data = await buildOpsData()
  const snapshot = buildLiveHeartbeatSnapshot({ people: data.people, actionLog: data.actionLog, essentials: data.essentials })
  if (!snapshot) return null
  const activeIds = new Set(snapshot.alerts.map((alert) => alert.id))
  acknowledgments = acknowledgments.filter((entry) => activeIds.has(entry.heartbeat_id))
  return { ...snapshot, action_log: [...acknowledgments, ...snapshot.action_log] }
}

export async function GET() {
  const snapshot = await liveSnapshot()
  return NextResponse.json(snapshot ?? { error: "No governed heartbeat source is connected." }, {
    status: snapshot ? 200 : 503,
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
    const snapshot = await liveSnapshot()
    if (!snapshot || !snapshot.alerts.some((alert) => alert.id === body.heartbeat_id)) {
      return NextResponse.json({ error: "The heartbeat alert is no longer active." }, { status: 409 })
    }
    const next = appendHeartbeatAcknowledgment(snapshot.action_log, body.heartbeat_id, actor.actorId, new Date().toISOString())
    const acknowledgment = next.find((entry) => entry.heartbeat_id === body.heartbeat_id && entry.action_type === "alert_acknowledged")
    if (acknowledgment && !acknowledgments.some((entry) => entry.id === acknowledgment.id)) acknowledgments = [acknowledgment, ...acknowledgments]
    return NextResponse.json({ snapshot: { ...snapshot, action_log: [...acknowledgments, ...snapshot.action_log.filter((entry) => entry.action_type !== "alert_acknowledged")] } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The acknowledgment could not be recorded." }, { status: 400 })
  }
}
