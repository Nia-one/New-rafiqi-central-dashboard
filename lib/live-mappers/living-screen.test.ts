import assert from "node:assert/strict"
import test from "node:test"
import { buildLivingScreenData } from "./living-screen"

test("Living occupancy is sourced from EXISTING Studios and excludes FONO/SP", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "Existing A", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 100, "occupied nests": 80 },
      { "studio id": "FONO A", "theatre id": "North", "supply model": "FONO", "contracted nests": 50, "occupied nests": 20 },
    ],
  })

  assert.equal(result.occupancyContracted, 100)
  assert.equal(result.occupancyOccupied, 80)
  assert.equal(result.occupancyPercent, 80)
  assert.deepEqual(result.occupancyRows[0].slice(0, 6), ["Existing A", "North", "100", "80", "80%", "20"])
})
