import { type NextRequest, NextResponse } from "next/server"
import { reportPreviewEnabled } from "@/lib/report-preview"

export const dynamic = "force-dynamic"

/**
 * Illustrative "live" evidence endpoint for the Report Meaning Layer preview.
 * Values drift on each poll so the EvidenceBlock live path (dataSource="live")
 * is visibly exercised. Dev/preview only — this route is not wired into any
 * product screen and serves no production data.
 *
 *   ?exhibit=fill  -> a table payload (West shortfall by nest)
 *   ?exhibit=spend -> a metric payload (controllable spend vs pace)
 */
export async function GET(request: NextRequest) {
  if (!reportPreviewEnabled()) return new NextResponse(null, { status: 404 })

  const now = Date.now()
  const pulledAt = new Date(now).toISOString()
  const exhibit = request.nextUrl.searchParams.get("exhibit") ?? "spend"

  // Deterministic-ish drift so values move on each poll without a store.
  const wobble = (seed: number, spread: number) => Math.round(Math.sin(now / 4000 + seed) * spread)

  if (exhibit === "fill") {
    const n12 = Math.max(0, 22 + wobble(1, 6))
    const n19 = Math.max(0, 18 + wobble(2, 5))
    const n07 = Math.max(0, 27 + wobble(3, 3))
    const pct = (actual: number, target: number) => `${Math.round((actual / target) * 100)}%`
    return NextResponse.json({
      pulledAt,
      table: {
        caption: "West shortfall by nest",
        columns: ["NEST", "TARGET", "ACTUAL", "FILL"],
        rows: [
          ["Nest 12", "40", `${n12}`, pct(n12, 40)],
          ["Nest 19", "35", `${n19}`, pct(n19, 35)],
          ["Nest 07", "30", `${n07}`, pct(n07, 30)],
        ],
      },
    })
  }

  const overPace = (18 + wobble(4, 6)) / 10 // ~1.2–2.4 (₹L)
  return NextResponse.json({
    pulledAt,
    metrics: [
      {
        label: "Spend vs pace",
        value: `+₹${overPace.toFixed(1)}L`,
        delta: overPace > 2 ? "running hot" : "easing",
        tone: overPace > 2 ? "breach" : "attention",
      },
      { label: "Recoverable", value: `₹${overPace.toFixed(1)}L` },
    ],
  })
}
