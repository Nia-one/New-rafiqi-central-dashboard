"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const SYNC_SECONDS = 45
const NEXT_SYNC_KEY = "rafiqi-global-next-sync-at"
const LEASE_KEY = "rafiqi-global-sync-lease"

type SyncState = "ready" | "syncing" | "retrying" | "failed"

export function GlobalLiveSync() {
  const router = useRouter()
  const tabId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  const inFlight = useRef(false)
  const [seconds, setSeconds] = useState(SYNC_SECONDS)
  const [state, setState] = useState<SyncState>("ready")

  const scheduleNext = useCallback(() => {
    const nextAt = Date.now() + SYNC_SECONDS * 1000
    window.localStorage.setItem(NEXT_SYNC_KEY, String(nextAt))
    setSeconds(SYNC_SECONDS)
  }, [])

  const acquireLease = useCallback(() => {
    const now = Date.now()
    try {
      const lease = JSON.parse(window.localStorage.getItem(LEASE_KEY) || "null") as { owner?: string; expiresAt?: number } | null
      if (lease?.owner !== tabId.current && Number(lease?.expiresAt) > now) return false
    } catch {
      // A malformed stale lease is safe to replace.
    }
    window.localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: tabId.current, expiresAt: now + 90_000 }))
    return true
  }, [])

  const releaseLease = useCallback(() => {
    try {
      const lease = JSON.parse(window.localStorage.getItem(LEASE_KEY) || "null") as { owner?: string } | null
      if (lease?.owner === tabId.current) window.localStorage.removeItem(LEASE_KEY)
    } catch {
      window.localStorage.removeItem(LEASE_KEY)
    }
  }, [])

  const synchronize = useCallback(async () => {
    if (inFlight.current || !acquireLease()) return
    inFlight.current = true
    scheduleNext()
    let success = false
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        setState(attempt === 0 ? "syncing" : "retrying")
        try {
          const response = await fetch("/api/ops-data?live=1", { method: "POST", cache: "no-store" })
          if (!response.ok) throw new Error(`Live sync failed (${response.status})`)
          success = true
          window.localStorage.setItem("rafiqi-global-last-sync-at", String(Date.now()))
          setState("ready")
          router.refresh()
          break
        } catch {
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** attempt))
        }
      }
      if (!success) setState("failed")
    } finally {
      inFlight.current = false
      releaseLease()
      if (!success) scheduleNext()
    }
  }, [acquireLease, releaseLease, router, scheduleNext])

  useEffect(() => {
    const current = Number(window.localStorage.getItem(NEXT_SYNC_KEY) || 0)
    if (!current || current <= Date.now()) scheduleNext()
    const tick = () => {
      const nextAt = Number(window.localStorage.getItem(NEXT_SYNC_KEY) || 0)
      const remaining = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000))
      setSeconds(remaining)
      if (remaining === 0) void synchronize()
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    const manual = () => void synchronize()
    window.addEventListener("rafiqi:sync-now", manual)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("rafiqi:sync-now", manual)
      releaseLease()
    }
  }, [releaseLease, scheduleNext, synchronize])

  const label = state === "syncing" ? "Syncing all live feeds…"
    : state === "retrying" ? "Retrying live sync…"
      : state === "failed" ? `Sync retry in ${seconds}s`
        : `All feeds sync in ${seconds}s`

  return <div className="global-live-sync" data-state={state} role="status" aria-live="polite"><RefreshCw aria-hidden className={state === "syncing" || state === "retrying" ? "is-spinning" : ""} /><span>{label}</span></div>
}
