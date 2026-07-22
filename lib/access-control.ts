import type { NextRequest } from "next/server"
import { AUTH_COOKIE, loginConfigurationFromEnvironment, readSessionEmail, sessionSecretFromEnvironment } from "@/lib/auth"
import { OPERATOR_ROLES, type ActorContext, type OperatorRole } from "@/lib/transaction-types"

const validRoles = new Set<OperatorRole>(OPERATOR_ROLES)

export function roleAssignments(source = process.env.RAFIQI_ROLE_ASSIGNMENTS) {
  const assignments = new Map<string, OperatorRole>()
  for (const entry of source?.split(",") ?? []) {
    const [email, role] = entry.split(":").map((value) => value.trim().toLowerCase())
    if (email && validRoles.has(role as OperatorRole)) assignments.set(email, role as OperatorRole)
  }
  return assignments
}

export async function actorFromRequest(request: NextRequest): Promise<ActorContext | null> {
  const loginConfiguration = loginConfigurationFromEnvironment()
  const email = await readSessionEmail(request.cookies.get(AUTH_COOKIE)?.value, sessionSecretFromEnvironment())
  if (!email) return null
  const configuredEmail = loginConfiguration?.email
  const role = roleAssignments().get(email) ?? (process.env.NODE_ENV !== "production" && email === configuredEmail ? "administrator" : null)
  if (!role) return null
  return { actorId: email, email, role }
}

export function financeAccessAllowed(role: OperatorRole | null | undefined) {
  return role === "finance" || role === "administrator"
}

export function productionWritesEnabled() {
  return process.env.NODE_ENV !== "production"
}
