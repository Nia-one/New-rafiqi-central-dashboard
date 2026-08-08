"use client"

import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const SYNC_SECONDS = 45
const NEXT_SYNC_KEY = "rafiqi-global-next-sync-at"
const LEASE_KEY = "rafiqi-global-sync-lease"
const LAST_CHANGED_SYNC_KEY = "rafiqi-global-last-changed-sync-at"

type SyncState = "ready" | "syncing" | "retrying" | "failed"

export function GlobalLiveSync() {
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
          const response = await fetch("/api/ops-data?input=1", { method: "POST", cache: "no-store" })
          if (!response.ok) throw new Error(`Live sync failed (${response.status})`)
          const report = await response.json() as { changedRows?: number }
          success = true
          setState("ready")
          // A server-component refresh can preserve stale client props. Reload
          // only when rows actually changed so every dashboard workspace moves
          // to one consistent snapshot without disrupting unchanged cycles.
          if ((report.changedRows ?? 0) > 0) {
            // localStorage events notify the other open dashboard tabs. The
            // tab doing the sync reloads itself below; follower tabs reload
            // from the storage listener so none remain on stale server props.
            window.localStorage.setItem(LAST_CHANGED_SYNC_KEY, String(Date.now()))
            window.location.reload()
          }
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
  }, [acquireLease, releaseLease, scheduleNext])

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
    const changedInAnotherTab = (event: StorageEvent) => {
      if (event.key === LAST_CHANGED_SYNC_KEY && event.newValue) window.location.reload()
    }
    window.addEventListener("rafiqi:sync-now", manual)
    window.addEventListener("storage", changedInAnotherTab)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("rafiqi:sync-now", manual)
      window.removeEventListener("storage", changedInAnotherTab)
      releaseLease()
    }
  }, [releaseLease, scheduleNext, synchronize])

  const label = state === "syncing" ? "Syncing all live feeds…"
    : state === "retrying" ? "Retrying live sync…"
      : state === "failed" ? `Sync retry in ${seconds}s`
        : `All feeds sync in ${seconds}s`

  return <div className="global-live-sync" data-state={state} role="status" aria-live="polite"><RefreshCw aria-hidden className={state === "syncing" || state === "retrying" ? "is-spinning" : ""} /><span>{label}</span></div>
}
