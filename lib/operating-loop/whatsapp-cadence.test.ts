import assert from "node:assert/strict"
import test from "node:test"
import { decideCadence, safeCadencePayload, type CadenceMessage } from "@/lib/operating-loop/whatsapp-cadence"

const person = { actorId: "ACT-1", managerActorId: "MGR-1", activeShift: true, shiftStartAt: "2026-07-17T07:00:00+05:30", shiftEndAt: "2026-07-17T15:00:00+05:30", nextHeartbeatDueAt: "2026-07-17T08:00:00+05:30" }

test("incidents are immediate and provider identifiers are idempotent", () => {
  const immediate = decideCadence({ person, now: "2026-07-17T07:30:00+05:30", incidentId: "INC-1", messages: [] })
  assert.equal(immediate.kind, "Incident")
  const recorded: CadenceMessage[] = [{ sourceMessageId: immediate.sourceMessageId!, actorId: person.actorId, kind: "Incident", firstMessageAt: "2026-07-17T07:30:00+05:30", sentAt: "2026-07-17T07:30:00+05:30", incidentId: "INC-1" }]
  assert.notEqual(decideCadence({ person, now: "2026-07-17T07:31:00+05:30", incidentId: "INC-1", messages: recorded }).kind, "Incident")
  assert.deepEqual(Object.keys(safeCadencePayload(immediate)).toSorted(), ["actor_id", "manager_actor_id", "prompt_kind", "reason", "source_message_id"].toSorted())
})

test("reminders and escalations follow policy time from the first message", () => {
  const messages: CadenceMessage[] = [{ sourceMessageId: "heartbeat:ACT-1:window", actorId: "ACT-1", kind: "Heartbeat", firstMessageAt: "2026-07-17T08:00:00+05:30", sentAt: "2026-07-17T08:00:00+05:30" }]
  assert.equal(decideCadence({ person, now: "2026-07-17T08:10:00+05:30", messages }).kind, "Reminder")
  assert.equal(decideCadence({ person, now: "2026-07-17T08:20:00+05:30", messages }).kind, "Escalation")
  assert.equal(decideCadence({ person: { ...person, activeShift: false }, now: "2026-07-17T08:20:00+05:30", messages: [] }).kind, "None")
})
