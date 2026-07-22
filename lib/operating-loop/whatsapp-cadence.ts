import { policyAt } from "@/lib/operating-loop/contracts"

export type CadencePerson = {
  actorId: string
  managerActorId: string | null
  activeShift: boolean
  shiftStartAt: string | null
  shiftEndAt: string | null
  nextHeartbeatDueAt: string | null
}

export type CadenceMessage = {
  sourceMessageId: string
  actorId: string
  kind: "Heartbeat" | "Reminder" | "Escalation" | "Incident"
  firstMessageAt: string
  sentAt: string
  incidentId?: string
}

export type CadenceDecision = {
  kind: "None" | "Heartbeat" | "Reminder" | "Escalation" | "Incident"
  actorId: string
  managerActorId: string | null
  reason: string
  sourceMessageId: string | null
}

function minutesBetween(later: string, earlier: string) {
  return (Date.parse(later) - Date.parse(earlier)) / 60_000
}

function inActiveShift(person: CadencePerson, now: string) {
  if (!person.activeShift) return false
  if (person.shiftStartAt && Date.parse(now) < Date.parse(person.shiftStartAt)) return false
  if (person.shiftEndAt && Date.parse(now) > Date.parse(person.shiftEndAt)) return false
  return true
}

export function decideCadence(input: {
  person: CadencePerson
  now: string
  incidentId?: string
  messages: readonly CadenceMessage[]
}): CadenceDecision {
  const { person, now, incidentId, messages } = input
  const incidentSourceId = incidentId ? `incident:${incidentId}:${person.actorId}` : null
  if (incidentId && !messages.some((message) => message.sourceMessageId === incidentSourceId)) {
    return { kind: "Incident", actorId: person.actorId, managerActorId: person.managerActorId, reason: "Incident prompts are immediate and satisfy the current heartbeat window.", sourceMessageId: incidentSourceId }
  }
  if (!inActiveShift(person, now)) return { kind: "None", actorId: person.actorId, managerActorId: person.managerActorId, reason: "Heartbeat prompts are sent only during an active shift.", sourceMessageId: null }

  const currentWindowMessages = messages
    .filter((message) => message.actorId === person.actorId && ["Heartbeat", "Incident"].includes(message.kind))
    .toSorted((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
  const latestWindow = currentWindowMessages[0]
  if (!latestWindow) {
    if (!person.nextHeartbeatDueAt || Date.parse(now) < Date.parse(person.nextHeartbeatDueAt)) return { kind: "None", actorId: person.actorId, managerActorId: person.managerActorId, reason: "The next active-shift heartbeat is not due.", sourceMessageId: null }
    const sourceMessageId = `heartbeat:${person.actorId}:${person.nextHeartbeatDueAt}`
    if (messages.some((message) => message.sourceMessageId === sourceMessageId)) return { kind: "None", actorId: person.actorId, managerActorId: person.managerActorId, reason: "Provider source_message_id already recorded.", sourceMessageId: null }
    return { kind: "Heartbeat", actorId: person.actorId, managerActorId: person.managerActorId, reason: "Active-shift heartbeat is due.", sourceMessageId }
  }

  const reminderMinutes = Number(policyAt("POL-HEARTBEAT-REMINDER", now)?.value ?? 10)
  const escalationMinutes = Number(policyAt("POL-HEARTBEAT-ESCALATION", now)?.value ?? 20)
  const elapsed = minutesBetween(now, latestWindow.firstMessageAt)
  const escalationId = `escalation:${latestWindow.sourceMessageId}`
  if (elapsed >= escalationMinutes && !messages.some((message) => message.sourceMessageId === escalationId)) return { kind: "Escalation", actorId: person.actorId, managerActorId: person.managerActorId, reason: `${escalationMinutes}-minute policy threshold reached from the first message.`, sourceMessageId: escalationId }
  const reminderId = `reminder:${latestWindow.sourceMessageId}`
  if (elapsed >= reminderMinutes && !messages.some((message) => message.sourceMessageId === reminderId)) return { kind: "Reminder", actorId: person.actorId, managerActorId: person.managerActorId, reason: `${reminderMinutes}-minute reminder policy threshold reached.`, sourceMessageId: reminderId }
  return { kind: "None", actorId: person.actorId, managerActorId: person.managerActorId, reason: "The policy follow-up threshold is not due or already recorded.", sourceMessageId: null }
}

export function safeCadencePayload(decision: CadenceDecision) {
  return Object.freeze({ source_message_id: decision.sourceMessageId, actor_id: decision.actorId, manager_actor_id: decision.managerActorId, prompt_kind: decision.kind, reason: decision.reason })
}
