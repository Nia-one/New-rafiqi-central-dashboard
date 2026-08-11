import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EnterpriseLeadWorkspace } from "@/components/enterprise-lead-workspace"

test("Enterprise lead workspace counts rows and preserves sheet JCO ownership", () => {
  const html = renderToStaticMarkup(createElement(EnterpriseLeadWorkspace, { asOf: "2026-08-11", rows: [
    { "enterprise name": "Alpha", "theatre id": "TH-DCN", "business owner": "Sachit Mathur", certainty: "Lead", "headcount required": 10000 },
    { "enterprise name": "Beta", "theatre id": "TH-WLG", "business owner": "Satish Sanghey", certainty: "Interested", "headcount required": 7000 },
    { "enterprise name": "Gamma", "theatre id": "TH-WLG", "business owner": "Satish Sanghey", certainty: "Drop", "headcount required": 9000 },
  ] }))
  assert.match(html, /2 active lead records/)
  assert.match(html, /Sachit Mathur/)
  assert.match(html, /Satish Sanghey/)
  assert.match(html, /Alpha/)
  assert.match(html, /Gamma/)
  assert.doesNotMatch(html, />10000</)
  assert.doesNotMatch(html, />7000</)
})
