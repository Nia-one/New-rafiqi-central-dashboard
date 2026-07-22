import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { actorFromRequest, financeAccessAllowed } from "@/lib/access-control"
import { financeExpansionControlEnabled, selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"
import { buildFinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (!financeAccessAllowed(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!selfDrivePlatformEnabled() || !financeExpansionControlEnabled()) return NextResponse.json({ error: "Finance and expansion control is disabled." }, { status: 404 })
  return NextResponse.json({ actor: { actorId: actor.actorId, role: actor.role }, preview: buildFinanceExpansionPreview(), writesEnabled: false }, { headers: { "Cache-Control": "no-store" } })
}
