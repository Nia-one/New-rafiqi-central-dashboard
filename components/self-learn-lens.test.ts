import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { LensProvider, type OperatingLens } from "@/components/lens"
import { MemberFeedbackScreen } from "@/components/member-feedback-screen"
import { memberFeedbackActions } from "@/lib/member-feedback-data"

function renderMemberNps(lens?: OperatingLens) {
  const workspace = createElement(MemberFeedbackScreen, {
    actions: [...memberFeedbackActions],
    onOpenExecution: () => undefined,
    onOpenDespatch: () => undefined,
  })
  return renderToStaticMarkup(lens ? createElement(LensProvider, { lens, children: workspace }) : workspace)
}

test("Member NPS keeps reporting in both lenses and gates recovery actions to Operate", () => {
  const standalone = renderMemberNps()
  const decide = renderMemberNps("decide")
  const operate = renderMemberNps("operate")

  for (const html of [standalone, decide, operate]) assert.match(html, /Governed Member feedback sources are connected\.|No governed feedback records are available\./)
  assert.match(standalone, /Member feedback early warning queue/)
  assert.match(operate, /Member feedback early warning queue/)
  assert.doesNotMatch(decide, /Member feedback early warning queue/)
})
