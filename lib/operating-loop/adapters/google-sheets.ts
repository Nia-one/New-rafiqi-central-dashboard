import type { OperatingIntakeTab } from "@/lib/operating-loop/contracts"
import type { SheetSourceRow } from "@/lib/operating-loop/ingestion"

export type GoogleSheetsReadOnlyConfig = {
  sheetId: string
  allowedTabs: readonly OperatingIntakeTab[]
  getAccessToken: () => Promise<string>
  fetchImplementation?: typeof fetch
}

export type GoogleSheetTabRead = {
  tab: OperatingIntakeTab
  range: string
  rows: SheetSourceRow[]
}

function columnName(header: unknown) {
  if (typeof header !== "string") return ""
  return header.trim().replace(/^\*\s*/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()
}

export function createGoogleSheetsReadOnlyAdapter(config: GoogleSheetsReadOnlyConfig) {
  const allowed = new Set(config.allowedTabs)
  const fetchImplementation = config.fetchImplementation ?? fetch

  return Object.freeze({
    mode: "read-only" as const,
    async readTab(tab: OperatingIntakeTab, range = "A:AZ"): Promise<GoogleSheetTabRead> {
      if (!allowed.has(tab)) throw new Error(`${tab} is not in the governed source registry.`)
      const token = await config.getAccessToken()
      if (!token.trim()) throw new Error("Google Sheets read access is disabled until a service-account token is available.")
      const encodedRange = encodeURIComponent(`${tab}!${range}`)
      const response = await fetchImplementation(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}/values/${encodedRange}?majorDimension=ROWS`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      })
      if (!response.ok) throw new Error(`Google Sheets read failed with ${response.status}.`)
      const payload = await response.json() as { range?: string; values?: unknown[][] }
      const [headers = [], ...records] = payload.values ?? []
      const names = headers.map(columnName)
      return {
        tab,
        range: payload.range ?? `${tab}!${range}`,
        rows: records.map((record, index) => ({
          tab,
          rowNumber: index + 2,
          values: Object.fromEntries(names.map((name, column) => [name, record[column] ?? null])),
        })),
      }
    },
  })
}

export function disabledGoogleSheetsAdapter(reason = "Google service-account credentials are not configured.") {
  return Object.freeze({
    mode: "disabled" as const,
    async readTab(): Promise<never> {
      throw new Error(reason)
    },
  })
}
