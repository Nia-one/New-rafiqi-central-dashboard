import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

test("dashboard filters are controlled by live Sheet dimensions", () => {
  assert.match(source, /filterLiveSelfDriveSnapshot/)
  assert.match(source, /theatre id/)
  assert.match(source, /theatre name/)
  assert.match(source, /row\.address/)
  assert.match(source, /studio id/)
  assert.match(source, /studio name/)
  assert.match(source, /actor id/)
  assert.match(source, /display name/)
  assert.match(source, /<details className="dashboard-filter"/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /setFilters/)
})

test("filter controls preserve the existing four-control layout", () => {
  assert.match(source, /className="dashboard-filter"/)
  assert.match(css, /\.filters \.dashboard-filter/)
  assert.match(css, /min-width: 168px/)
  assert.match(css, /dashboard-filter-menu/)
})

test("filters cascade from theatre to location to studio and clear incompatible children", () => {
  assert.match(source, /filters\.theatre/)
  assert.match(source, /filters\.location/)
  assert.match(source, /eligibleStudioIds/)
  assert.match(source, /\{ theatre: nextValue, location: "", studio: "", person: "" \}/)
})

test("the shared filters are applied to both Self Drive and Self Learn live source arrays", () => {
  assert.match(source, /const filteredLiveOpsData = useMemo/)
  assert.match(source, /LivingScreen[^\n]+liveOpsData=\{filteredLiveOpsData\}/)
  assert.match(source, /WorkScreen liveOpsData=\{filteredLiveOpsData\}/)
  assert.match(source, /PeopleScreen liveOpsData=\{filteredLiveOpsData\}/)
})

test("live Sheet data refreshes automatically and manually without caching", () => {
  assert.match(source, /fetch\(`\/api\/ops-data\?refresh=\$\{Date\.now\(\)\}`/)
  assert.match(source, /cache: "no-store"/)
  assert.match(source, /"Cache-Control": "no-cache"/)
  assert.match(source, /window\.setInterval\(\(\) => void refreshLiveData\(false\), 60_000\)/)
  assert.match(source, /onClick=\{\(\) => void refreshLiveData\(\)\}/)
  assert.match(source, /window\.clearInterval/)
})
