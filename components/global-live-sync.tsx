"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

// Google Sheets quotas are shared by every production user through one service
// account. The browser checks once a minute, while the server and the per-browser
// lease deduplicate identical work across tabs.
const SYNC_SECONDS = 60
const NEXT_SYNC_KEY = "rafiqi-global-next-sync-at"
const LEASE_KEY = "rafiqi-global-sync-lease"
const LAST_CHANGED_SYNC_KEY = "rafiqi-global-last-changed-sync-at"
const SYNC_TIMEOUT_MS = 180_000
const SYNC_LEASE_MS = SYNC_TIMEOUT_MS + 30_000
// The first refresh starts Next's stale-while-revalidate read; the second runs
// only after that governed batch has had time to finish. Keeping these far
// apart prevents overlapping 38-range dashboard reads.
const CONVERGENCE_REFRESH_MS = [0, 20_000] as const

type SyncState = "ready" | "syncing" | "failed"

export function GlobalLiveSync() {
  const router = useRouter()
  const tabId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  const inFlight = useRef(false)
  const refreshTimers = useRef<number[]>([])
  const [seconds, setSeconds] = useState(SYNC_SECONDS)
  const [state, setState] = useState<SyncState>("ready")

  const refreshUntilCurrent = useCallback(() => {
    refreshTimers.current.forEach((timer) => window.clearTimeout(timer))
    refreshTimers.current = CONVERGENCE_REFRESH_MS.map((delay) => window.setTimeout(() => router.refresh(), delay))
  }, [router])

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
    window.localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: tabId.current, expiresAt: now + SYNC_LEASE_MS }))
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
    if (inFlight.current) return
    if (!acquireLease()) {
      window.dispatchEvent(new CustomEvent("rafiqi:sync-complete", { detail: { success: true, handledByAnotherTab: true } }))
      return
    }
    inFlight.current = true
    scheduleNext()
    let success = false
    try {
      setState("syncing")
      // All operator-owned UI_* and TEAM_* tabs plus connected bot feeds are
      // ingested by one server-coordinated sync cycle.
      // UI_* is the dashboard's operator-owned current-state lane. Heavier bot
      // feeds are intentionally not multiplied by every open browser; their
      // server-coordinated jobs remain isolated from this one-minute hot path.
      const response = await fetch("/api/ops-data?fresh=1", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(SYNC_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`Live sync failed (${response.status})`)
      const report = await response.json() as { changedRows?: number }
      success = true
      setState("ready")
      // Refresh the server-component payload in place. Next preserves the
      // mounted client shell, so the active workspace, mode, focused card,
      // filters and scroll position do not jump back to Control Tower.
      if ((report.changedRows ?? 0) > 0) {
        // localStorage events notify other open dashboard tabs. Each tab
        // refreshes only its data payload and keeps its own UI location.
        window.localStorage.setItem(LAST_CHANGED_SYNC_KEY, String(Date.now()))
        refreshUntilCurrent()
      }
    } catch {
      setState("failed")
    } finally {
      inFlight.current = false
      releaseLease()
      if (!success) scheduleNext()
      window.dispatchEvent(new CustomEvent("rafiqi:sync-complete", { detail: { success } }))
    }
  }, [acquireLease, refreshUntilCurrent, releaseLease, scheduleNext])

  useEffect(() => {
    const current = Number(window.localStorage.getItem(NEXT_SYNC_KEY) || 0)
    if (!current || current <= Date.now()) void synchronize()
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
      if (event.key === LAST_CHANGED_SYNC_KEY && event.newValue) refreshUntilCurrent()
    }
    const synchronizeWhenDue = () => {
      if (document.visibilityState === "visible" && Number(window.localStorage.getItem(NEXT_SYNC_KEY) || 0) <= Date.now()) void synchronize()
    }
    window.addEventListener("rafiqi:sync-now", manual)
    window.addEventListener("storage", changedInAnotherTab)
    window.addEventListener("online", synchronizeWhenDue)
    document.addEventListener("visibilitychange", synchronizeWhenDue)
    return () => {
      window.clearInterval(timer)
      refreshTimers.current.forEach((refreshTimer) => window.clearTimeout(refreshTimer))
      window.removeEventListener("rafiqi:sync-now", manual)
      window.removeEventListener("storage", changedInAnotherTab)
      window.removeEventListener("online", synchronizeWhenDue)
      document.removeEventListener("visibilitychange", synchronizeWhenDue)
      releaseLease()
    }
  }, [refreshUntilCurrent, releaseLease, synchronize])

  const label = state === "syncing" ? "Syncing all inputs and bots…"
    : state === "failed" ? `Sync retry in ${seconds}s`
      : `All inputs and bots sync in ${seconds}s`

  return <div className="global-live-sync" data-state={state} role="status" aria-live="polite"><RefreshCw aria-hidden className={state === "syncing" ? "is-spinning" : ""} /><span>{label}</span></div>
}
