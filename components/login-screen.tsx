"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react"

export function LoginScreen({ previewCredentials }: { previewCredentials?: { email: string; password: string } }) {
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    }).catch(() => null)

    if (response?.ok) {
      window.location.assign("/")
      return
    }

    const result = response ? await response.json().catch(() => null) as { error?: string } | null : null
    setError(result?.error ?? "Rafiqi Central could not be reached. Try again.")
    setSubmitting(false)
  }

  return <main className="login-shell">
    <section className="login-story" aria-label="Rafiqi Central introduction">
      <div className="login-wordmark"><img src="/rafiqi-mark-white.png" alt="Nia" /><a href="https://www.nia.one" target="_blank" rel="noreferrer">www.nia.one</a></div>
      <div className="login-story-copy login-story-panel">
        <h1>Nia Self Drive</h1>
        <p>Where human migration meets RafiQi intelligence to keep the manufacturing lines running.</p>
        <p className="login-story-reassure">Take a breath. Nothing here needs panic. We&apos;ll work it one calm step at a time.</p>
      </div>
      <div className="login-continuity" aria-label="Nia continuity platform pillars">
        <div><span>01</span><strong>Living</strong><small>Community infrastructure</small></div>
        <i aria-hidden />
        <div><span>02</span><strong>Work</strong><small>Income continuity</small></div>
        <i aria-hidden />
        <div><span>03</span><strong>Essentials</strong><small>Lower-cost daily life</small></div>
      </div>
      <p className="login-story-note">Nia is the Migrant Worker Continuity Platform.</p>
    </section>

    <section className="login-access" aria-labelledby="login-title">
      <div className="login-card">
        <div className="login-lock" aria-hidden><LockKeyhole /></div>
        <p className="login-kicker">SECURE ACCESS</p>
        <h2 id="login-title">Welcome back.</h2>
        <p className="login-intro">Sign in with your authorised Nia account.</p>
        {previewCredentials ? <p className="login-preview-note">Preview mode. Credentials are pre-filled.</p> : null}
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="name@nia.one" defaultValue={previewCredentials?.email} required autoFocus />
          <label htmlFor="password">Password</label>
          <div className="login-password">
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" defaultValue={previewCredentials?.password} required />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button>
          </div>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<ArrowRight aria-hidden /></button>
        </form>
        <div className="login-security"><ShieldCheck aria-hidden /><p><strong>Restricted operating data</strong><span>Access is limited to authorised Nia team members.</span></p></div>
      </div>
      <p className="login-help">Need access? Contact your Nia administrator.</p>
    </section>
  </main>
}
