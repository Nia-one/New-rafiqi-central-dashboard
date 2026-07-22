import { NextRequest, NextResponse } from "next/server"
import { readActionLog, writeActionLog } from "@/lib/action-log-store"
import type { ActionLogWrite } from "@/lib/action-log"
import { actorFromRequest } from "@/lib/access-control"

export const dynamic = "force-dynamic"

const allowedActions = new Set<ActionLogWrite["action_type"]>(["agree", "assign", "resolve", "close", "verify", "dismiss", "reassign", "note"])

export async function GET() {
  return NextResponse.json({
    entries: readActionLog(),
    persistence: "illustrative-local-session",
    writes_enabled: process.env.NODE_ENV !== "production",
  })
}

export async function POST(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Production execution writes are disabled until authentication and durable storage are connected." },
      { status: 503 },
    )
  }

  try {
    const body = await request.json() as Partial<Omit<ActionLogWrite, "actor_id">>
    if (typeof body.queue_item_id !== "string" || !allowedActions.has(body.action_type as ActionLogWrite["action_type"])) {
      return NextResponse.json({ error: "Queue item and action are required." }, { status: 400 })
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return NextResponse.json({ error: "Note must be text." }, { status: 400 })
    }

    const result = writeActionLog({
      queue_item_id: body.queue_item_id,
      actor_id: actor.actorId,
      action_type: body.action_type as ActionLogWrite["action_type"],
      note: body.note,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The action could not be recorded." }, { status: 400 })
  }
}
