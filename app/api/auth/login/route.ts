import { NextResponse } from "next/server"
import {
  AUTH_COOKIE,
  createSessionToken,
  loginAccountsFromEnvironment,
  sessionCookieOptions,
  sessionSecretFromEnvironment,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth"

export async function POST(request: Request) {
  const accounts = loginAccountsFromEnvironment()
  const sessionSecret = sessionSecretFromEnvironment()

  if (!accounts.length || !sessionSecret) {
    return NextResponse.json({ error: "Access has not been configured yet." }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  const account = accounts.find((candidate) => candidate.email === email)
  if (!account || password !== account.password) {
    return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(
    AUTH_COOKIE,
    await createSessionToken(email, sessionSecret),
    sessionCookieOptions(request.url, SESSION_DURATION_SECONDS),
  )
  return response
}
