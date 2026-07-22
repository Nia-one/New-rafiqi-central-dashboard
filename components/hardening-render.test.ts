import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ControlScreen } from "@/components/control-screen"

test("the rendered transaction workspace uses Rafiqi display names", () => {
  const html = renderToStaticMarkup(createElement(ControlScreen))
  assert.match(html, /Rafiqi Save goal deposit/)
  assert.match(html, /Rafiqi Remit family transfer/)
  assert.doesNotMatch(html, /Rafiki/)
})
