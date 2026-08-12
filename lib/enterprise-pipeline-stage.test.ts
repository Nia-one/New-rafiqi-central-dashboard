import assert from "node:assert/strict"
import test from "node:test"
import { ENTERPRISE_PIPELINE_STAGES, enterprisePipelineStage } from "./enterprise-pipeline-stage"

test("Enterprise pipeline places Compaign before Lead", () => {
  assert.deepEqual(ENTERPRISE_PIPELINE_STAGES, ["Compaign", "Lead", "Interested", "Proposal Sent", "Contracting", "Contracted"])
})

test("Enterprise pipeline accepts the live Compaign value and common Campaign spelling", () => {
  assert.equal(enterprisePipelineStage("Compaign"), "Compaign")
  assert.equal(enterprisePipelineStage("Campaign"), "Compaign")
  assert.equal(enterprisePipelineStage("Lead"), "Lead")
})
