import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RemainingDomainWorkspace } from "@/components/remaining-domain-workspace"
import { buildRemainingDomainPreview } from "@/lib/operating-loop/remaining-domain-preview"

test("Phase 4 UI visibly renders all domain loops and locked controls", () => {
  const html = renderToStaticMarkup(createElement(RemainingDomainWorkspace, { preview: buildRemainingDomainPreview() }))
  const essentials = html.indexOf("01 · Essentials loop")
  const people = html.indexOf("02 · People and execution loop")
  const continuity = html.indexOf("03 · Member continuity and retention")
  const governance = html.indexOf("04 · Governance and IR verified reporting")
  assert.ok(essentials >= 0 && people > essentials && continuity > people && governance > continuity)
  assert.match(html, /Curry/)
  assert.match(html, /Save/)
  assert.match(html, /Remit/)
  assert.match(html, /Activity, closure and resolved outcome remain separate/)
  assert.match(html, /No duplicate Member master/)
  assert.match(html, /CEO approval required/)
  assert.match(html, /External release permitted: No/)
  assert.equal(html.includes("Float"), false)
})
