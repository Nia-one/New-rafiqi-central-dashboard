"use client"

// Presentation-only lens over the existing operating surfaces.
// "decide" is the management layer: state, variance and the decisions waiting.
// "operate" is the execution layer: the governed work queue and dispositions.
// No data contract, loop builder or route changes; the lens only chooses
// which already-built sections render. Without a provider (unit tests render
// workspaces standalone) every section renders, preserving the full surface.

import { createContext, useContext, type ReactNode } from "react"

export type OperatingLens = "decide" | "operate"

export const OPERATING_LENS_COOKIE = "rafiqi-operating-lens"

export function operatingLensFromCookie(cookieHeader: string): OperatingLens | null {
  for (const segment of cookieHeader.split(";")) {
    const [name, ...valueParts] = segment.trim().split("=")
    if (name !== OPERATING_LENS_COOKIE) continue
    try {
      const value = decodeURIComponent(valueParts.join("="))
      return value === "decide" || value === "operate" ? value : null
    } catch {
      return null
    }
  }
  return null
}

export function readStoredOperatingLens(): OperatingLens | null {
  return typeof document === "undefined" ? null : operatingLensFromCookie(document.cookie)
}

export function persistOperatingLens(lens: OperatingLens) {
  if (typeof document === "undefined") return
  document.cookie = `${OPERATING_LENS_COOKIE}=${encodeURIComponent(lens)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

const LensContext = createContext<OperatingLens | null>(null)

export function LensProvider({ lens, children }: { lens: OperatingLens; children: ReactNode }) {
  return <LensContext.Provider value={lens}>{children}</LensContext.Provider>
}

export function useLens(): OperatingLens | null {
  return useContext(LensContext)
}

export function LensGate({ show, children }: { show: OperatingLens; children: ReactNode }) {
  const lens = useContext(LensContext)
  if (lens !== null && lens !== show) return null
  return <>{children}</>
}
