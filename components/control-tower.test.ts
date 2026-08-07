import assert from "node:assert/strict"
import test from "node:test"
import { canonicalNiaGrowthControl } from "./control-tower"

test("Control Tower uses the current Nia Growth summary instead of stale action baselines", () => {
  const result = canonicalNiaGrowthControl({
    current: "FONO 887 supply · SP 0 won",
    target: "FONO 5625 demand · SP 150 leads",
    gap: "FONO 4738 gap · SP 150 open",
    owner: "Srinivasan RG",
    progress: "15%",
    verifiedResult: "Channels remain separate",
  })

  assert.equal(result.current, "FONO 887 supply · SP 0 won")
  assert.equal(result.target, "FONO 5625 demand · SP 150 leads")
  assert.match(result.prescription, /FONO 4738 gap · SP 150 open/)
  assert.doesNotMatch(JSON.stringify(result), /1151|4474/)
})
