export const AUTH_COOKIE = "rafiqi-central-session"
export const SESSION_DURATION_SECONDS = 60 * 60 * 12
export const DEVELOPMENT_PREVIEW_EMAIL = "preview@nia.one"
export const DEVELOPMENT_PREVIEW_PASSWORD = "preview-only"
const ISOLATED_PREVIEW_BRANCHES = new Set([
  "fix/v0-preview-session-cookie",
  "menu-confusion-fix",
])

type LoginRuntime = {
  nodeEnv?: string
  vercelEnv?: string
  gitCommitRef?: string
  email?: string
  password?: string
  sessionSecret?: string
}

export function resolveLoginConfiguration(runtime: LoginRuntime) {
  const isolatedPreview = runtime.vercelEnv === "preview"
    && ISOLATED_PREVIEW_BRANCHES.has(runtime.gitCommitRef ?? "")

  if (isolatedPreview) {
    return {
      email: DEVELOPMENT_PREVIEW_EMAIL,
      password: DEVELOPMENT_PREVIEW_PASSWORD,
      sessionSecret: "rafiqi-development-preview-session-only",
      isDevelopmentPreview: true,
    }
  }

  const email = runtime.email?.trim().toLowerCase()
  const password = runtime.password
  const sessionSecret = runtime.sessionSecret
  const hasAnyConfiguredValue = Boolean(email || password || sessionSecret)

  if (email && password && sessionSecret) return { email, password, sessionSecret, isDevelopmentPreview: false }
  if (hasAnyConfiguredValue || runtime.nodeEnv === "production") return null

  return {
    email: DEVELOPMENT_PREVIEW_EMAIL,
    password: DEVELOPMENT_PREVIEW_PASSWORD,
    sessionSecret: "rafiqi-development-preview-session-only",
    isDevelopmentPreview: true,
  }
}

export function loginConfigurationFromEnvironment(
  runtime: LoginRuntime = {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
    email: process.env.RAFIQI_LOGIN_EMAIL,
    password: process.env.RAFIQI_LOGIN_PASSWORD,
    sessionSecret: process.env.RAFIQI_SESSION_SECRET,
  },
) {
  return resolveLoginConfiguration(runtime)
}

export function sessionSecretFromEnvironment() {
  return process.env.RAFIQI_SESSION_SECRET || loginConfigurationFromEnvironment()?.sessionSecret
}

type SessionCookieRuntime = {
  nodeEnv?: string
  vercelEnv?: string
}

export function sessionCookieOptions(
  requestUrl: string,
  maxAge: number,
  runtime: SessionCookieRuntime = {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  },
) {
  const url = new URL(requestUrl)
  const isHttps = url.protocol === "https:"
  const isEmbeddedPreview = isHttps && (
    runtime.vercelEnv === "preview"
    || runtime.nodeEnv !== "production"
  )

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isEmbeddedPreview ? "none" as const : "lax" as const,
    ...(isEmbeddedPreview ? { partitioned: true } : {}),
    maxAge,
    path: "/",
  }
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))))
}

export async function createSessionToken(email: string, secret: string, now = Date.now()) {
  const payload = `${email}|${Math.floor(now / 1000) + SESSION_DURATION_SECONDS}`
  return `${payload}|${await signature(payload, secret)}`
}

export async function isValidSessionToken(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) return false
  const parts = token.split("|")
  if (parts.length !== 3) return false
  const [email, expiresAt, suppliedSignature] = parts
  const expiry = Number(expiresAt)
  if (!email || !Number.isFinite(expiry) || expiry <= Math.floor(now / 1000)) return false
  const expected = await signature(`${email}|${expiresAt}`, secret)
  if (expected.length !== suppliedSignature.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ suppliedSignature.charCodeAt(index)
  return mismatch === 0
}

export async function readSessionEmail(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!await isValidSessionToken(token, secret, now)) return null
  const email = token?.split("|")[0]?.trim().toLowerCase()
  return email || null
}
