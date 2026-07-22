import assert from "node:assert/strict"
import test from "node:test"
import {
  createSessionToken,
  isValidSessionToken,
  loginConfigurationFromEnvironment,
  readSessionEmail,
  resolveLoginConfiguration,
  sessionCookieOptions,
  SESSION_DURATION_SECONDS,
} from "./auth"

test("signed sessions validate before expiry", async () => {
  const now = Date.parse("2026-07-16T10:00:00Z")
  const token = await createSessionToken("operator@nia.one", "a-long-test-secret-for-rafiqi-central", now)
  assert.equal(await isValidSessionToken(token, "a-long-test-secret-for-rafiqi-central", now + 1_000), true)
  assert.equal(await readSessionEmail(token, "a-long-test-secret-for-rafiqi-central", now + 1_000), "operator@nia.one")
})

test("tampered and expired sessions are rejected", async () => {
  const now = Date.parse("2026-07-16T10:00:00Z")
  const secret = "a-long-test-secret-for-rafiqi-central"
  const token = await createSessionToken("operator@nia.one", secret, now)
  assert.equal(await isValidSessionToken(`${token}changed`, secret, now + 1_000), false)
  assert.equal(await isValidSessionToken(token, secret, now + (SESSION_DURATION_SECONDS + 1) * 1_000), false)
})

test("keeps the Production session cookie same-site and secure", () => {
  assert.deepEqual(
    sessionCookieOptions("https://www.rafiqicentral.com/api/auth/login", SESSION_DURATION_SECONDS, {
      nodeEnv: "production",
      vercelEnv: "production",
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    },
  )
})

test("allows secure session cookies inside v0 and Vercel Preview iframes", () => {
  assert.deepEqual(
    sessionCookieOptions("https://preview.example.vercel.app/api/auth/login", SESSION_DURATION_SECONDS, {
      nodeEnv: "production",
      vercelEnv: "preview",
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    },
  )
  assert.deepEqual(
    sessionCookieOptions("https://preview.vusercontent.net/api/auth/login", SESSION_DURATION_SECONDS, {
      nodeEnv: "development",
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    },
  )
})

test("keeps local HTTP development compatible", () => {
  assert.deepEqual(
    sessionCookieOptions("http://127.0.0.1:3000/api/auth/login", SESSION_DURATION_SECONDS, {
      nodeEnv: "development",
    }),
    {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    },
  )
})

test("fails closed when Production login configuration is missing or partial", () => {
  assert.equal(resolveLoginConfiguration({ nodeEnv: "production" }), null)
  assert.equal(resolveLoginConfiguration({ nodeEnv: "production", vercelEnv: "preview", gitCommitRef: "some-other-branch" }), null)
  assert.equal(resolveLoginConfiguration({ nodeEnv: "development", email: "partial@nia.one" }), null)
})

test("uses explicit credentials in every environment", () => {
  assert.deepEqual(resolveLoginConfiguration({
    nodeEnv: "production",
    email: " Operator@Nia.One ",
    password: "configured-password",
    sessionSecret: "configured-session-secret",
  }), {
    email: "operator@nia.one",
    password: "configured-password",
    sessionSecret: "configured-session-secret",
    isDevelopmentPreview: false,
  })
})

test("provides isolated credentials only for an unconfigured development preview", () => {
  const configuration = loginConfigurationFromEnvironment({ nodeEnv: "development" })
  assert.equal(configuration?.isDevelopmentPreview, true)
  assert.equal(configuration?.email, "preview@nia.one")
  assert.equal(configuration?.password, "preview-only")
  assert.equal(configuration?.sessionSecret, "rafiqi-development-preview-session-only")
})

test("the isolated redesign branch uses synthetic preview credentials on Vercel", () => {
  const configuration = loginConfigurationFromEnvironment({
    nodeEnv: "production",
    vercelEnv: "preview",
    gitCommitRef: "fix/v0-preview-session-cookie",
    email: "stale-preview@nia.one",
    password: "stale-password",
    sessionSecret: "stale-session-secret",
  })
  assert.deepEqual(configuration, {
    email: "preview@nia.one",
    password: "preview-only",
    sessionSecret: "rafiqi-development-preview-session-only",
    isDevelopmentPreview: true,
  })
})

test("the v0 chat branch uses synthetic preview credentials on Vercel", () => {
  const configuration = loginConfigurationFromEnvironment({
    nodeEnv: "production",
    vercelEnv: "preview",
    gitCommitRef: "menu-confusion-fix",
  })
  assert.deepEqual(configuration, {
    email: "preview@nia.one",
    password: "preview-only",
    sessionSecret: "rafiqi-development-preview-session-only",
    isDevelopmentPreview: true,
  })
})
