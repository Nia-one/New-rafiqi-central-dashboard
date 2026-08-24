const safeFileName = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "report"

function reportDocument(title: string, source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll(".report-export-actions").forEach((node) => node.remove())
  clone.querySelectorAll("button, select").forEach((node) => node.setAttribute("disabled", "true"))
  const headAssets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${headAssets}<style>body{margin:0;padding:24px;background:#fff;color:#111827;font-family:Arial,sans-serif}.report-export-document{max-width:1600px;margin:0 auto}.report-export-title{margin:0 0 18px;font-size:24px}.report-export-meta{margin:-10px 0 20px;color:#64748b;font-size:12px}@media print{body{padding:0}.report-export-document{max-width:none}.table-wrap,.supply-distance-grid{overflow:visible!important}table{font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}details{break-inside:avoid}details>div{display:block!important}}</style></head><body><main class="report-export-document"><h1 class="report-export-title">${escapeHtml(title)}</h1><p class="report-export-meta">Generated ${escapeHtml(new Date().toLocaleString("en-IN"))} · Live Coromandel dashboard data</p>${clone.outerHTML}</main></body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

export function downloadReportHtml(title: string, source: HTMLElement | null) {
  if (!source) return
  const url = URL.createObjectURL(new Blob([reportDocument(title, source)], { type: "text/html;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${safeFileName(title)}-${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function printReportPdf(title: string, source: HTMLElement | null) {
  if (!source) return
  const popup = window.open("", "_blank")
  if (!popup) {
    window.alert("PDF window browser ne block ki hai. Pop-ups allow karke dobara try karein.")
    return
  }
  popup.document.open()
  popup.document.write(reportDocument(title, source))
  popup.document.close()
  window.setTimeout(() => { popup.focus(); popup.print() }, 500)
}
