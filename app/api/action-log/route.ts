import { NextRequest, NextResponse } from "next/server"
import { readActionLog, writeActionLog } from "@/lib/action-log-store"
import type { ActionLogWrite } from "@/lib/action-log"
import { actorFromRequest } from "@/lib/access-control"
import { writeDurableActionLog } from "@/lib/durable-action-log"

export const dynamic = "force-dynamic"

const allowedActions = new Set<ActionLogWrite["action_type"]>(["agree", "assign", "resolve", "close", "verify", "dismiss", "reassign", "note"])

export async function GET() {
  return NextResponse.json({
    entries: readActionLog(),
    persistence: process.env.GOOGLE_SHEET_ID ? "google-sheets" : "illustrative-local-session",
    writes_enabled: process.env.NODE_ENV !== "production" || Boolean(process.env.GOOGLE_SHEET_ID),
  })
}

export async function POST(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  try {
    const body = await request.json() as Partial<Omit<ActionLogWrite, "actor_id">>
    if (typeof body.queue_item_id !== "string" || !allowedActions.has(body.action_type as ActionLogWrite["action_type"])) {
      return NextResponse.json({ error: "Queue item and action are required." }, { status: 400 })
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return NextResponse.json({ error: "Note must be text." }, { status: 400 })
    }

    const write = {
      queue_item_id: body.queue_item_id,
      actor_id: actor.actorId,
      action_type: body.action_type as ActionLogWrite["action_type"],
      note: body.note,
    }
    const result = process.env.GOOGLE_SHEET_ID ? await writeDurableActionLog(write) : writeActionLog(write)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The action could not be recorded." }, { status: 400 })
  }
}
