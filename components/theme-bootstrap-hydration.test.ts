import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8")
const initializerSource = readFileSync(join(process.cwd(), "components/theme-initializer.tsx"), "utf8")
const layout = layoutSource.slice(layoutSource.indexOf("return ("))

test("theme initialization uses a client effect instead of a script React child", () => {
  assert.match(layoutSource, /<ThemeInitializer\s*\/>/, "theme initializer is present")
  assert.doesNotMatch(layout, /<script\b|<Script\b/, "layout must not render script tags")
  assert.match(initializerSource, /setAttribute\("data-theme"/, "initializer drives data-theme")
})

test("the theme initializer renders before children", () => {
  const bodyOpen = layout.indexOf("<body")
  const initializerAt = layout.indexOf("ThemeInitializer")
  const childrenAt = layout.indexOf("{children}")
  assert.ok(bodyOpen !== -1 && initializerAt !== -1 && childrenAt !== -1)
  assert.ok(initializerAt > bodyOpen)
  assert.ok(initializerAt < childrenAt)
})

test("html keeps suppressHydrationWarning for the effect-driven data-theme attribute", () => {
  assert.match(layout, /<html[^>]*suppressHydrationWarning/)
})
