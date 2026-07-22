import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE, isValidSessionToken, sessionSecretFromEnvironment } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const authenticated = await isValidSessionToken(
    request.cookies.get(AUTH_COOKIE)?.value,
    sessionSecretFromEnvironment(),
  )
  const isLogin = request.nextUrl.pathname === "/login"

  if (!authenticated && !isLogin) return NextResponse.redirect(new URL("/login", request.url))
  if (authenticated && isLogin) return NextResponse.redirect(new URL("/", request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-icon.png|rafiqi-mark-white.png|rafiqi-worker.png|self-drive.jpg).*)"],
}
