import { whatsappOperatingWritesEnabled } from "@/lib/operating-loop/feature-flags"
import type { CadenceDecision } from "@/lib/operating-loop/whatsapp-cadence"
import { safeCadencePayload } from "@/lib/operating-loop/whatsapp-cadence"

export type WhatsappSendReceipt = {
  mode: "disabled" | "shadow"
  accepted: false
  sourceMessageId: string | null
  payload: ReturnType<typeof safeCadencePayload>
}

export function createWhatsappOperatingAdapter(environment: Record<string, string | undefined> = process.env) {
  const mode = whatsappOperatingWritesEnabled(environment) && environment.NODE_ENV !== "production" ? "shadow" : "disabled"
  return Object.freeze({
    mode,
    async preview(decision: CadenceDecision): Promise<WhatsappSendReceipt> {
      return Object.freeze({ mode, accepted: false, sourceMessageId: decision.sourceMessageId, payload: safeCadencePayload(decision) })
    },
  })
}
