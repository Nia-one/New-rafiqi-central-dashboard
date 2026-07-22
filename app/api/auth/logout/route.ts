import { NextResponse } from "next/server"
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth"

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303)
  response.cookies.set(AUTH_COOKIE, "", sessionCookieOptions(request.url, 0))
  return response
}
