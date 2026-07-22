import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { actorFromRequest, productionWritesEnabled } from "@/lib/access-control"
import { canViewTransaction } from "@/lib/transaction-engine"
import { readTransactions, insertTransaction } from "@/lib/transaction-store"
import type { CreateTransactionInput } from "@/lib/transaction-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  return NextResponse.json({ actor, transactions: readTransactions().filter((transaction) => canViewTransaction(actor, transaction)), persistence: "local-durable-preview", writesEnabled: productionWritesEnabled() })
}

export async function POST(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (!productionWritesEnabled()) return NextResponse.json({ error: "Production transaction writes are disabled." }, { status: 503 })
  if (!new Set(["operator", "finance", "administrator", "restricted-payroll"]).has(actor.role)) return NextResponse.json({ error: "This role cannot create transactions." }, { status: 403 })
  try {
    const body = await request.json() as CreateTransactionInput
    const transaction = insertTransaction(body, actor)
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The transaction could not be created." }, { status: 400 })
  }
}
