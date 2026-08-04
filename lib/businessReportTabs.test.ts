import assert from "node:assert/strict";
import test from "node:test";
import { latestImportedReport, niaGrowthFonoFormulas, reportCandidates } from "./businessReportTabs";

const tabs = [
  { sheetId: 1, title: "Fono Funnel", index: 2, rowCount: 10, columnCount: 5 },
  { sheetId: 2, title: "Fono Funnel (1)", index: 8, rowCount: 11, columnCount: 5 },
  { sheetId: 3, title: "Fono Funnel (2)", index: 9, rowCount: 12, columnCount: 6 },
  { sheetId: 4, title: "Fono Funnel backup", index: 10, rowCount: 20, columnCount: 8 },
];

test("business report matching accepts only canonical and Google import suffixes", () => {
  assert.deepEqual(reportCandidates(tabs, "Fono Funnel").map((tab) => tab.sheetId), [1, 2, 3]);
});

test("latest imported report is the newest suffixed sheet", () => {
  assert.equal(latestImportedReport(tabs, "Fono Funnel")?.sheetId, 3);
});

test("Nia Growth formulas implement the governed FONO stage contract", () => {
  assert.deepEqual(niaGrowthFonoFormulas(5, "G", "H", 4), {
    C: `=SUMIF('Fono Funnel'!G4:G,"Lead",'Fono Funnel'!H4:H)+SUMIF('Fono Funnel'!G4:G,"Contracting",'Fono Funnel'!H4:H)+SUMIF('Fono Funnel'!G4:G,"Contracted",'Fono Funnel'!H4:H)`,
    D: `=SUMIF('Fono Funnel'!G4:G,"Contracting",'Fono Funnel'!H4:H)+SUMIF('Fono Funnel'!G4:G,"Contracted",'Fono Funnel'!H4:H)`,
    E: "=MAX(0,C5-D5)",
    F: `=IFERROR("ACT-"&REGEXREPLACE(REGEXREPLACE(UPPER(TRIM(INDEX(FILTER(TEAM_OWNER_REGISTRY!F:F,TEAM_OWNER_REGISTRY!B:B="FONO Supply",TEAM_OWNER_REGISTRY!E:E="Owner",TEAM_OWNER_REGISTRY!J:J="Active"),1))),"[^A-Z0-9]+","-"),"(^-|-$)",""),"ACT-UNASSIGNED")`,
    H: "=D5",
    I: `=SUMIF('Fono Funnel'!G4:G,"Contracted",'Fono Funnel'!H4:H)`,
  });
});
