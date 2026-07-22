import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PreviewHarness } from "./preview-harness"
import { sampleReport } from "./sample-report"
import { reportPreviewEnabled } from "@/lib/report-preview"

// Isolated, dev/preview-only route for reviewing the Report Meaning Layer kit.
// It is NOT linked from any product screen and returns 404 in production so it
// can never leak into the deployed Rafiqi Central surface.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Report Meaning Layer — Preview",
  robots: { index: false, follow: false },
}

export default function ReportKitPreviewPage() {
  if (!reportPreviewEnabled()) notFound()
  return (
    <main className="report-kit-preview-page">
      <PreviewHarness config={sampleReport} />
    </main>
  )
}
