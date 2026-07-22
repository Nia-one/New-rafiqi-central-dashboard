import assert from "node:assert/strict"
import test from "node:test"
import { closedLoopDemandActivationEnabled, controlledAutonomyEvaluationEnabled, financeExpansionControlEnabled, operatingDataLiveReadsEnabled, remainingDomainControlEnabled, selfDrivePlatformEnabled, whatsappOperatingWritesEnabled } from "@/lib/operating-loop/feature-flags"

test("Self Drive is available only in an isolated development preview or by explicit release", () => {
  assert.equal(selfDrivePlatformEnabled({}), true)
  assert.equal(selfDrivePlatformEnabled({ NODE_ENV: "development" }), true)
  assert.equal(selfDrivePlatformEnabled({ NODE_ENV: "development", RAFIQI_LOGIN_EMAIL: "configured@nia.one" }), false)
  assert.equal(selfDrivePlatformEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), false)
  assert.equal(selfDrivePlatformEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(selfDrivePlatformEnabled({ RAFIQI_SELF_DRIVE_PLATFORM: " false " }), false)
  assert.equal(selfDrivePlatformEnabled({ RAFIQI_SELF_DRIVE_PLATFORM: " TRUE " }), true)
})

test("finance remains an explicit independent sub-gate", () => {
  assert.equal(financeExpansionControlEnabled({ NODE_ENV: "development" }), false)
  assert.equal(financeExpansionControlEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), false)
  assert.equal(financeExpansionControlEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(financeExpansionControlEnabled({ RAFIQI_FINANCE_EXPANSION_CONTROL: "true" }), true)
})

test("deprecated phase flags cannot independently enable any platform slice", () => {
  const legacyOnly = {
    NODE_ENV: "production",
    RAFIQI_CLOSED_LOOP_DEMAND_ACTIVATION: "true",
    RAFIQI_REMAINING_DOMAIN_CONTROL: "true",
    RAFIQI_CONTROLLED_AUTONOMY_EVALUATION: "true",
  }
  assert.equal(closedLoopDemandActivationEnabled(legacyOnly), false)
  assert.equal(remainingDomainControlEnabled(legacyOnly), false)
  assert.equal(controlledAutonomyEvaluationEnabled(legacyOnly), false)
  const released = { ...legacyOnly, RAFIQI_SELF_DRIVE_PLATFORM: "true" }
  assert.equal(closedLoopDemandActivationEnabled(released), true)
  assert.equal(remainingDomainControlEnabled(released), true)
  assert.equal(controlledAutonomyEvaluationEnabled(released), true)
})

test("live adapters remain disabled without explicit flags and WhatsApp writes never enable in Production", () => {
  assert.equal(operatingDataLiveReadsEnabled({}), false)
  assert.equal(operatingDataLiveReadsEnabled({ RAFIQI_OPERATING_DATA_LIVE_READS: "true" }), true)
  assert.equal(whatsappOperatingWritesEnabled({ NODE_ENV: "development", RAFIQI_WHATSAPP_OPERATING_WRITES: "true" }), true)
  assert.equal(whatsappOperatingWritesEnabled({ NODE_ENV: "production", RAFIQI_WHATSAPP_OPERATING_WRITES: "true" }), false)
})
