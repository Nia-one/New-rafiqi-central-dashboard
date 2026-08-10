import assert from "node:assert/strict"
import test from "node:test"
import { canonicalMemberAddsControl, canonicalNiaGrowthControl, canonicalNiaMarginsControl, governanceConsole } from "./control-tower"

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

test("Nia Growth readiness alarms are classified into the Nia Growth console", () => {
  assert.equal(governanceConsole({ domain: "Operations", title: "Nia Growth FONO readiness gap", exceptionId: "OPS-NIA-GROWTH-FONO-2026-08" }), "Nia Growth")
  assert.equal(governanceConsole({ domain: "Operations", title: "Recover Nia Nest", exceptionId: "ACT-NIA-CM2" }), "Operations")
})

test("healthy Member Adds keeps its named owner and complete source values", () => {
  const result = canonicalMemberAddsControl({ target: 887, current: 887, gap: 0, owner: "Srinivas", progressPercent: 100, verifiedResult: "887/887 billing-live" })
  assert.equal(result.owner, "Srinivas")
  assert.equal(result.current, "887")
  assert.equal(result.target, "887")
  assert.equal(result.gap, "0")
  assert.match(result.rootCause, /887 verified Member Adds.*887 governed target.*0 still open/)
  assert.doesNotMatch(JSON.stringify(result), /Unassigned|not enough values/i)
})

test("Nia Margins evidence uses the same canonical current, target, and gap as the operating card", () => {
  const result = canonicalNiaMarginsControl({ fullUseCm2Inr: 377, fullUseTargetInr: 300 } as never, true)
  assert.equal(result.current, "₹377")
  assert.equal(result.target, "₹300")
  assert.equal(result.gap, "₹0")
  assert.match(result.rootCause, /₹377.*₹300.*₹0.*at or above control/)
  assert.doesNotMatch(result.rootCause, /not enough values/i)
})
