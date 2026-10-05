const assert = require("node:assert/strict")
const test = require("node:test")
const { isEditableHeader } = require("./finalize-fresh-user-input-workbook")

test("Enterprise Demand ownership marks the derived name automated in styling and guide logic", () => {
  assert.equal(isEditableHeader("UI_Enterprise_Demand", "Enterprise_Name"), false)
  assert.equal(isEditableHeader("UI_Enterprise_Demand", " enterprise name "), false)
  assert.equal(isEditableHeader("UI_Enterprise_Demand", "Studio_Name"), true)
  assert.equal(isEditableHeader("UI_Enterprise_Demand", "Headcount_Required"), true)
})

test("the Enterprise_Name exception is tab-specific", () => {
  assert.equal(isEditableHeader("UI_Enterprise_Supply", "Enterprise_Name"), true)
  assert.equal(isEditableHeader("UI_People", "Enterprise_Name"), true)
  assert.equal(isEditableHeader("UI_Enterprise_Demand", "Record_ID"), false)
})

test("existing report and explicit team ownership rules remain intact", () => {
  assert.equal(isEditableHeader("Fono Funnel", "Evidence_Ref"), false)
  assert.equal(isEditableHeader("Fono Funnel", "Studio_Name"), true)
  assert.equal(isEditableHeader("TEAM_MEMBER_ACTIVATION", "Member_Token"), true)
  assert.equal(isEditableHeader("TEAM_MEMBER_ACTIVATION", "Record_ID"), false)
})
