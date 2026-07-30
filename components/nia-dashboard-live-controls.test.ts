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
  assert.match(source, /learningHistory: filteredLiveSelfDriveData\.learningHistory/)
  assert.match(source, /filteredLiveOpsData\?\.learningHistory/)
})

test("live Sheet data polls automatically and supports a forced manual source sync", () => {
  assert.match(source, /fetch\(`\/api\/ops-data\?refresh=\$\{Date\.now\(\)\}`/)
  assert.match(source, /cache: "no-store"/)
  assert.match(source, /"Cache-Control": "no-cache"/)
  assert.match(source, /void refreshLiveData\(true, true\)/)
  assert.match(source, /window\.setInterval\(\(\) => void refreshLiveData\(\), 60_000\)/)
  assert.match(source, /window\.setInterval\(\(\) => void refreshLiveData\(true, true\), 900_000\)/)
  assert.match(source, /Refresh data/)
  assert.match(source, /refreshLiveData\(true\)/)
  assert.match(source, /method: "POST"/)
  assert.match(source, /window\.clearInterval/)
})

test("a transient Sheet sync failure retains the last dashboard snapshot instead of crashing the client", () => {
  assert.match(source, /retaining the last dashboard snapshot/)
  assert.match(source, /console\.warn/)
  assert.match(source, /catch \(error\)/)
  assert.doesNotMatch(source, /throw new Error\("Team Sheet synchronization failed"\)/)
})

test("Despatch Loop health consumes normalized live Sheet collections", () => {
  assert.match(source, /Array\.isArray\(liveData\.actions\) \? liveData\.actions/)
  assert.match(source, /Array\.isArray\(liveData\.evidence\) \? liveData\.evidence/)
  assert.match(source, /Array\.isArray\(liveData\.approvals\) \? liveData\.approvals/)
  assert.match(source, /Array\.isArray\(liveData\.incidents\) \? liveData\.incidents/)
  assert.match(source, /const openClockRows = actionRows\.filter/)
  assert.match(source, /validDate\(liveData\.asOf\)/)
})
