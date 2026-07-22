import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { actorFromRequest, productionWritesEnabled } from "@/lib/access-control"
import { canOperateTransaction } from "@/lib/transaction-engine"
import { readTransactions, updateTransaction } from "@/lib/transaction-store"
import type { TransitionTransactionInput } from "@/lib/transaction-types"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ transactionId: string }> }) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (!productionWritesEnabled()) return NextResponse.json({ error: "Production transaction writes are disabled." }, { status: 503 })
  const { transactionId } = await params
  const current = readTransactions().find((transaction) => transaction.transactionId === transactionId)
  if (!current) return NextResponse.json({ error: "Transaction was not found." }, { status: 404 })
  if (!canOperateTransaction(actor, current)) return NextResponse.json({ error: "This role cannot operate the transaction." }, { status: 403 })
  try {
    const body = await request.json() as Omit<TransitionTransactionInput, "transactionId" | "actorId">
    const transaction = updateTransaction({
      ...body,
      transactionId,
      actorId: actor.actorId,
      evidence: body.evidence ? { ...body.evidence, recordedBy: actor.actorId, classification: current.classification } : undefined,
      ledgerEntries: body.ledgerEntries?.map((entry) => ({ ...entry, transactionId, currency: current.currency, postedBy: actor.actorId, classification: current.classification })),
    })
    return NextResponse.json({ transaction })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The transition could not be recorded." }, { status: 400 })
  }
}
