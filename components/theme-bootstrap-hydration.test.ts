import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8")
const layout = layoutSource.slice(layoutSource.indexOf("return ("))
const toggle = readFileSync(join(process.cwd(), "components/theme-toggle.tsx"), "utf8")

test("the root layout renders no executable script component", () => {
  assert.doesNotMatch(layout, /<head\b/, "layout does not manually render head")
  assert.doesNotMatch(layout, /<Script\b|<script\b|dangerouslySetInnerHTML/, "layout has no React-rendered script")
})

test("<html> allows the client-managed data-theme attribute", () => {
  assert.match(layout, /<html[^>]*suppressHydrationWarning/, "html retains suppressHydrationWarning")
})

test("ThemeToggle restores the saved theme without injecting a script", () => {
  assert.match(toggle, /localStorage\.getItem\("nia-theme"\)/)
  assert.match(toggle, /matchMedia\("\(prefers-color-scheme: light\)"\)/)
  assert.match(toggle, /document\.documentElement\.setAttribute\("data-theme", initial\)/)
})
