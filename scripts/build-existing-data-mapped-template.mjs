import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve("tmp/existing-dashboard-data.xlsx");
const outDir = path.resolve("outputs/existing-data-audit-final-template");
const output = path.join(outDir, "Rafiqi_Existing_Data_Mapped_Final_Template.xlsx");
await fs.mkdir(outDir, { recursive: true });

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(source);
wb.creator = "OpenAI Codex";
wb.modified = new Date();
wb.title = "Rafiqi Existing Data Mapped Final Template";
wb.subject = "Self Drive and Self Learn source mapping; Finance on hold";

const C = { navy:"17365D", blue:"2F5597", lightBlue:"D9EAF7", gold:"A66A00", paleGold:"FFF2CC", green:"548235", paleGreen:"E2F0D9", red:"C00000", paleRed:"FCE4D6", grey:"666666", paleGrey:"F2F2F2", white:"FFFFFF", ink:"1F1F1F", border:"D9D2C3" };
const thin = { style:"thin", color:{argb:C.border} };
const requiredFill = { type:"pattern", pattern:"solid", fgColor:{argb:C.paleGold} };
const derivedFill = { type:"pattern", pattern:"solid", fgColor:{argb:C.paleGreen} };

function styleHeader(cell, fill=C.blue) {
  cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};
  cell.font={bold:true,color:{argb:C.white},name:"Aptos"};
  cell.alignment={wrapText:true,vertical:"middle"};
  cell.border={top:thin,bottom:thin,left:thin,right:thin};
}
function setup(ws, title, subtitle, color=C.blue) {
  ws.properties.tabColor={argb:color};
  ws.views=[{state:"frozen",ySplit:4,showGridLines:false}];
  ws.mergeCells("A1:H1"); ws.getCell("A1").value=title; ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:C.navy}}; ws.getCell("A1").font={bold:true,size:18,color:{argb:C.white},name:"Aptos"}; ws.getCell("A1").alignment={vertical:"middle"}; ws.getRow(1).height=30;
  ws.mergeCells("A2:H2"); ws.getCell("A2").value=subtitle; ws.getCell("A2").font={italic:true,color:{argb:C.grey},name:"Aptos"}; ws.getCell("A2").alignment={wrapText:true,vertical:"middle"}; ws.getRow(2).height=30;
}
function table(ws, headers, rows, widths=[]) {
  ws.getRow(4).values=headers; ws.getRow(4).height=30; ws.getRow(4).eachCell(c=>styleHeader(c));
  rows.forEach((row,i)=>{const r=ws.getRow(5+i);r.values=row;r.height=36;r.eachCell(c=>{c.font={name:"Aptos"};c.alignment={wrapText:true,vertical:"top"};c.border={bottom:thin};});});
  headers.forEach((_,i)=>ws.getColumn(i+1).width=widths[i]||22);
  ws.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,4+rows.length),column:headers.length}};
}
function addInputSheet(name,title,subtitle,headers,requiredCount,example, widths=[]) {
  const ws=wb.addWorksheet(name);setup(ws,title,subtitle,C.gold);
  ws.getRow(4).values=headers;ws.getRow(4).height=42;
  headers.forEach((_,i)=>{const c=ws.getCell(4,i+1);styleHeader(c,i<requiredCount?C.blue:C.grey);c.note=i<requiredCount?"Required for complete dashboard automation":"Optional when available";});
  ws.getRow(5).values=example;ws.getRow(5).height=40;ws.getRow(5).eachCell(c=>{c.fill=requiredFill;c.font={italic:true,color:{argb:C.grey},name:"Aptos"};c.alignment={wrapText:true,vertical:"top"};c.border={bottom:thin};});
  for(let r=6;r<=205;r++){for(let c=1;c<=headers.length;c++){const cell=ws.getCell(r,c);cell.border={bottom:{style:"hair",color:{argb:"EDEDED"}}};cell.font={name:"Aptos"};}}
  headers.forEach((_,i)=>ws.getColumn(i+1).width=widths[i]||20);
  ws.autoFilter={from:{row:4,column:1},to:{row:205,column:headers.length}};
  return ws;
}
function appendColumns(sheetName, defs) {
  const ws=wb.getWorksheet(sheetName); if(!ws) return;
  const start=ws.columnCount+1;
  defs.forEach((d,i)=>{const col=start+i;const cell=ws.getCell(1,col);cell.value=d[0];cell.fill=d[2]==="derived"?derivedFill:requiredFill;cell.font={bold:true,color:{argb:C.ink},name:"Aptos"};cell.alignment={wrapText:true,vertical:"middle"};cell.border={top:thin,bottom:thin,left:thin,right:thin};cell.note=d[1];ws.getColumn(col).width=22;});
  ws.views=[{state:"frozen",ySplit:1,showGridLines:true}];ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(2,ws.actualRowCount),column:ws.columnCount}};
}

// Existing source tabs stay intact; only missing dashboard fields are appended on the right.
appendColumns("Occupany",[
  ["dashboard_record_id","Required stable ID; suggested OCC-<Studio Code>."],["as_of_at","Required source snapshot timestamp in IST."],["location_id","Required governed location ID."],["supply_model","FONO / Shram Park / Direct / Other."],["source_updated_at","When this row last changed."]
]);
appendColumns("FONO-Supply -Demand",[
  ["dashboard_record_id","Required stable lead/supply record ID."],["enterprise_id","Stable company identifier."],["plant_id","Stable plant/site identifier."],["headcount_required","Numeric required nests/headcount."],["headcount_matched","Numeric matched/occupied nests."],["activation_required_at","Required activation date/time."],["certainty","Committed / Likely / Pipeline / Unknown."],["owner_actor_id","Governed owner ID."],["source_updated_at","When this row last changed."]
]);
appendColumns("Ess-Supply Bot",[
  ["order_status","Placed / Confirmed / Fulfilled / Cancelled."],["fulfilled_quantity","Quantity actually delivered."],["fulfilled_at","Delivery completion timestamp."],["theatre_id","Governed theatre ID."],["studio_name","Studio display name."],["member_id","Stable member ID; do not rely on mobile number."],["fulfilment_cost","Direct order delivery/handling cost."]
]);
appendColumns("Ess.Demand-Inv Master-Manual",[
  ["supplier_id","Stable supplier/vendor ID."],["last_purchase_at","Latest received purchase date."],["last_purchase_qty","Latest received quantity."],["last_purchase_cost","Latest purchase amount."],["studio_id","Blank means central warehouse inventory."],["source_updated_at","When this row last changed."]
]);
appendColumns("Sharmpark Demand-Manual",[
  ["dashboard_record_id","Required stable enterprise-demand ID."],["enterprise_id","Stable company identifier."],["plant_id","Stable plant/site identifier."],["headcount_required","Numeric value; remove + and commas."],["headcount_matched","Numeric matched/activated headcount."],["activation_required_at","Required activation date/time."],["certainty","Committed / Likely / Pipeline / Unknown."],["status","Open / On hold / Won / Lost / Closed."],["owner_actor_id","Governed owner ID."],["source_updated_at","When this row last changed."]
]);
appendColumns("CM",[
  ["dashboard_record_id","Stable contribution record ID."],["domain","Living / Essentials / FONO / SP / Enterprise."],["owner_actor_id","Governed owner ID."],["evidence_id","Verified evidence reference when realized is claimed."],["source_updated_at","When this row last changed."]
]);

const readme=wb.addWorksheet("00_DASHBOARD_READ_ME");setup(readme,"Dashboard integration guide","Keep the original seven tabs and their existing columns. Yellow columns appended on the right are the minimum missing fields. Separate REQ_* tabs are required only where no source currently exists.",C.green);
table(readme,["Step","Owner","What to do","Frequency","Dashboard effect"],[
  [1,"Current data owners","Continue filling the existing source tabs exactly as today.","Current cadence","No process disruption"],
  [2,"Data owner / integration","Populate the appended yellow fields or map equivalent bot fields.","Per new/changed record","Creates stable joins and freshness"],
  [3,"Operations governance","Maintain REQ_PEOPLE, REQ_POLICY and workflow log tabs.","As events occur","Enables Dispatch, Sign-Off and control verdicts"],
  [4,"Bot integration","Send Essentials bot and later Shram Park bot output into the same mapped columns.","Automatic","Covered components refresh without manual dashboard entry"],
  [5,"Dashboard","Read-only connector refreshes and recalculates derived metrics.","Scheduled / refresh button","Both modes repopulate from Sheets"],
  [6,"Important","Google Sheet automation means dashboard propagation is automatic; manual source tabs still require human data entry.","Always","Avoids false 100% automation claim"]
],[10,24,65,24,45]);

const coverage=wb.addWorksheet("01_COVERAGE_AUDIT");setup(coverage,"Current coverage audit","Estimated component coverage from the supplied workbook before the appended missing fields are completed. Finance remains excluded/on hold.",C.red);
table(coverage,["Mode / vertical","Current usable coverage","After mapping existing data","To reach 100%","Automation status","Primary blocker"],[
  ["Self Drive — overall (Finance excluded)",0.48,0.72,1,"Covered fields can auto-refresh","People, policies, engagement and governed logs"],
  ["Self Learn — overall",0.12,0.25,1,"Not complete yet","Outcome history, overrides, verified evidence, policy versions"],
  ["Occupancy / Living",0.85,0.95,1,"Google Sheet → automatic dashboard refresh","Snapshot timestamp, location and supply-model mapping"],
  ["FONO supply + demand",0.70,0.85,1,"Google Sheet → automatic dashboard refresh","Stable IDs, structured demand, dates and outcomes"],
  ["Essentials member orders",0.78,0.90,1,"Existing bot → automatic","64% current rows lack studio_id; fulfilment state/cost missing"],
  ["Essentials inventory / company purchase",0.70,0.85,1,"Google Sheet → automatic dashboard refresh","Purchase receipts, supplier and stock-movement context"],
  ["Enterprise demand",0.55,0.75,1,"FONO + SP lead sheets can feed it","Structured numeric headcount, certainty, IDs and activation date"],
  ["Shram Park demand",0.55,0.75,1,"Current Sheet; bot can replace manual feed","Structured IDs/status/headcount"],
  ["Shram Park supply / capacity",0,0,1,"No current source","Contracted/ready/occupied capacity and coverage"],
  ["Member engagement",0,0.10,1,"No governed source","Member cohort, risk, recovery and feedback events"],
  ["Dispatch",0.10,0.20,1,"Action feed missing","People roster + incident/action/evidence lifecycle"],
  ["Your Sign-Off",0.05,0.15,1,"Approval feed missing","Approval_Log + Evidence_Log + authority policy"],
  ["Nia Margins",0.65,0.80,1,"Source refresh can be automatic","Verified cost allocation and approved controls"],
  ["Nia Growth",0.55,0.75,1,"FONO/SP demand refresh can be automatic","SP supply/capital/readiness evidence"],
],[34,20,24,16,38,62]);
for(let r=5;r<=18;r++){for(let c of [2,3,4])coverage.getCell(r,c).numFmt="0%";}

const mapping=wb.addWorksheet("02_SOURCE_MAPPING");setup(mapping,"Existing source to dashboard mapping","Direct mapping preserves the current team format. ETL/Apps Script should normalize these columns into the backend schema; users should not re-enter the same facts.",C.green);
table(mapping,["Existing tab","Existing field(s)","Normalized meaning","Used in mode/page","Transform","Gap after mapping"],[
  ["Occupany","Studio Code, Contracted Nest, Occupied Nest, Occupancy %, Revenue, Rental Cost, CM","Studio snapshot and unit economics","Both / Member Adds, Margins","Direct + numeric checks","Add timestamps/location/supply model"],
  ["FONO-Supply -Demand","Prospect, Stage, Nests Potential, current occupancy, rent, collection, CM","FONO pipeline, readiness and economics","Both / Enterprise Demand, Growth, Margins","Normalize dates/stages; derive gap","Add stable IDs and structured outcomes"],
  ["Ess-Supply Bot","order/product/customer/studio/prices/cost/profit/MRP/savings","Essentials member demand/orders","Both / Savings, Margins","Bot direct; join studio master","Add fulfillment and missing studio mapping"],
  ["Ess- Supply Manual","Members, buying members/value, studio revenue","Studio-level Essentials adoption summary","Self Drive / Savings","Aggregate reference only","Do not use as order truth when bot is available"],
  ["Ess.Demand-Inv Master-Manual","stock, reserved, available, reorder, warehouse, product","Essentials company inventory/supply","Both / Savings, Dispatch","Direct product join","Add supplier and purchase receipts"],
  ["Sharmpark Demand-Manual","Company, location, stage, client nests potential, owner","Enterprise/SP demand pipeline","Both / Enterprise Demand, Growth","Parse numeric potential; standardize stages","Does not provide Shram Park supply"],
  ["CM","planned impact, realized, status, target close","Contribution summary","Self Drive / Nia Margins","Summary only; require evidence for verified result","Add owner/evidence/stable ID"],
],[30,50,40,38,42,52]);

addInputSheet("REQ_STUDIO_MASTER","Required: Studio master","One row per Studio. This resolves names, IDs, vertical and supply-model joins across every source.",["studio_id","studio_code","studio_name","theatre_id","location_id","supply_model","active_status","effective_from","effective_to","updated_at"],8,["STU-001","RJT-FN-D01","Nia Nest Ompal","RJT","LOC-001","FONO","Active",new Date("2026-07-01"),"",new Date("2026-07-28")],[18,18,30,16,16,18,16,20,20,20]);
addInputSheet("REQ_SP_SUPPLY","Required: Shram Park supply/capacity","Current workbook contains SP/enterprise leads but no governed Shram Park supply record.",["sp_supply_id","theatre_id","location_id","site_name","contracted_nests","activation_ready_nests","occupied_nests","contract_coverage_status","capital_coverage_status","owner_actor_id","as_of_at","updated_at"],12,["SP-001","CORO","LOC-ORAGADAM","Oragadam park",120,96,72,"Recorded","Pending","ACT-PRIYA",new Date("2026-07-28"),new Date("2026-07-28")]);
addInputSheet("REQ_MEMBER_ENGAGEMENT","Required: Member engagement","Needed for Member Engagement cards, recovery, continuity and Self Learn outcomes.",["engagement_event_id","member_id","studio_id","event_type","event_at","risk_status","baseline_value","target_value","current_value","owner_actor_id","source_system","updated_at","notes"],12,["ENG-001","MEM-001","STU-001","Recovery risk",new Date("2026-07-28"),"At risk",0,1,0,"ACT-THEATRE","Member feedback",new Date("2026-07-28"),""]);
addInputSheet("REQ_PEOPLE_ROSTER","Required: People/ownership roster","Needed for owner routing, shift windows, heartbeat checks, escalations and person filters.",["actor_id","display_name","role","theatre_id","studio_id","manager_actor_id","active_shift","shift_start_at","shift_end_at","last_heartbeat_at","next_heartbeat_due_at","active_status","updated_at"],12,["ACT-PRIYA","Priya Rao (Test)","Approver","CORO","","ACT-PUSHKAR","Day",new Date("2026-07-28T09:00:00"),new Date("2026-07-28T18:00:00"),new Date("2026-07-28T11:00:00"),new Date("2026-07-28T12:00:00"),"Active",new Date("2026-07-28T11:00:00")]);
addInputSheet("REQ_POLICY_REGISTRY","Required: Policy/targets","No dashboard should infer a threshold. One effective, approved record is required for each control.",["policy_id","domain","metric_name","threshold_operator","threshold_value","unit","scope_type","scope_id","version","status","approved_by_actor_id","effective_from","effective_to","updated_at"],13,["POL-OCC-001","Occupancy","occupancy_ratio",">=",0.78,"ratio","Global","ALL","v1","Approved","ACT-PUSHKAR",new Date("2026-07-01"),"",new Date("2026-07-28")]);
addInputSheet("REQ_INCIDENT_LOG","Required: Incident log","Events detected from vertical sources. One stable incident record per governed exception.",["incident_id","domain","incident_type","event_at","theatre_id","studio_id","description","impacted_members","impacted_nests","amount_at_risk","severity","owner_actor_id","due_at","action_required","approval_required","state","source_record_id","reported_at","updated_at"],18,["INC-001","Occupancy","Below control",new Date("2026-07-28"),"RJT","STU-001","Occupancy below approved floor",0,7,0,"Attention","ACT-THEATRE",new Date("2026-07-29"),"Restore occupancy","No","Open","OCC-RJT-FN-D01",new Date("2026-07-28"),new Date("2026-07-28")]);
addInputSheet("REQ_ACTION_LOG","Required: Action log","Operational work queue and lifecycle source for Dispatch and both modes.",["action_id","incident_id","objective","expected_metric","baseline_value","target_value","financial_impact","confidence","owner_actor_id","due_at","required_evidence","approval_tier","state","proposed_at","updated_at"],14,["ACTN-001","INC-001","Restore occupancy","occupied_nests",83,90,0,"Medium","ACT-THEATRE",new Date("2026-07-29"),"Occupancy source record","None","Assigned",new Date("2026-07-28"),new Date("2026-07-28")]);
addInputSheet("REQ_EVIDENCE_LOG","Required: Evidence log","Protected evidence and independent verification status. Required for closure and Self Learn.",["evidence_id","linked_type","linked_id","evidence_type","protected_url","uploaded_by_actor_id","uploaded_at","description","verification_status","verified_by_actor_id","verified_at","updated_at"],11,["EVD-001","Action","ACTN-001","Source record","protected://example","ACT-THEATRE",new Date("2026-07-28"),"Current occupancy evidence","Pending","","",new Date("2026-07-28")]);
addInputSheet("REQ_APPROVAL_LOG","Required: Approval log","Human decisions for material changes. Dashboard remains read-only and reads this log.",["approval_id","linked_action_id","decision_type","amount","current_terms","proposed_terms","business_reason","expected_result","approver_role","approver_actor_id","decision","decision_reason","decision_at","status","updated_at"],14,["APR-001","ACTN-001","Operational exception",0,"Current control","Temporary exception","Recorded business reason","Verified recovery","Approver","ACT-PRIYA","Pending","","","Pending",new Date("2026-07-28")]);

const bot=wb.addWorksheet("03_BOT_INTEGRATION");setup(bot,"Bot and Google Sheet integration contract","Bot response sheets can remain separate. Map the bot output into these source tabs/columns and preserve stable IDs and timestamps.",C.green);
table(bot,["Feed","Current source","Current status","Required join key","Minimum added fields","Final behaviour"],[
  ["Essentials orders","Ess-Supply Bot","Bot available","order_id + product_id + studio_id","order_status, fulfilled_quantity, fulfilled_at, fulfilment_cost","Bot row → Sheet → Savings/Margins/Dispatch refresh"],
  ["Essentials inventory","Ess.Demand-Inv Master-Manual","Google Sheet manual","product_id / product_code","supplier/purchase receipt fields when purchase analytics required","Sheet update → inventory/reorder refresh"],
  ["Occupancy","Occupany","Google Sheet manual","studio_code + as_of_at","record_id, timestamp, supply model","Sheet update → Member Adds/Margins refresh"],
  ["FONO","FONO-Supply -Demand","Google Sheet manual","stable record_id","structured headcount, IDs, timestamps","Sheet update → Demand/Growth/Margins refresh"],
  ["Shram Park demand","Sharmpark Demand-Manual","Google Sheet; bot later","stable demand_id + enterprise_id","numeric headcount, status, timestamps","Manual now; bot can replace same columns tomorrow"],
  ["Shram Park supply","No source","Missing","sp_supply_id","REQ_SP_SUPPLY fields","Required before SP capacity/coverage can be live"],
],[28,32,24,34,58,58]);

const quality=wb.addWorksheet("04_DATA_QUALITY_AUDIT");setup(quality,"Data-quality audit","These are issues found in the supplied workbook. They do not stop template use, but the affected dashboard values cannot be called 100% reliable until corrected at source.",C.red);
table(quality,["Priority","Source tab","Finding","Observed","Dashboard impact","Required correction"],[
  ["Critical","FONO-Supply -Demand","Spreadsheet error values","24 cells contain #REF! / #DIV/0! style errors","CM%, economics and readiness can be wrong","Fix source formulas/exports; emit blank + quality flag instead of an error"],
  ["Critical","Ess-Supply Bot","Missing studio mapping","30 of 47 rows (64%) have blank studio_id","Cannot allocate orders/savings/margin to Studio/Theatre","Bot must always emit studio_id or use a governed customer-to-studio map"],
  ["Critical","All sources","No governed workflow logs","Incident, Action, Evidence and Approval sources absent","Dispatch, Sign-Off and Self Learn remain incomplete","Maintain the four REQ_* log tabs or equivalent bot/system feeds"],
  ["Critical","All sources","No policy registry","Approved controls and thresholds absent","Control verdicts cannot be governed","Populate REQ_POLICY_REGISTRY"],
  ["High","All sources","No People roster","Owner IDs, shifts, managers and heartbeat deadlines absent","Dispatch routing and person filters incomplete","Populate REQ_PEOPLE_ROSTER"],
  ["High","Shrampark Demand-Manual","Potential headcount stored as text","31 of 150 blank; other values include commas and + signs","Demand totals and gaps require parsing/manual cleanup","Populate numeric headcount_required"],
  ["High","Shrampark Demand-Manual","Pipeline updates mostly absent","Stage After 95% blank; updated date 99% blank","Cannot reliably detect progression/freshness","Populate status and source_updated_at for every active row"],
  ["High","FONO-Supply -Demand","Action/outcome fields absent","Outcome and Next Action 100% blank; dates nearly blank","Cannot automate recovery/action lifecycle","Populate structured status/outcome or generate incidents/actions"],
  ["High","Shram Park","No supply/capacity dataset","0 governed SP supply rows","Growth coverage/capital cannot be assessed","Populate REQ_SP_SUPPLY or connect tomorrow's bot to the same schema"],
  ["Medium","Essentials inventory","Inventory snapshot only","No supplier/purchase receipt or movement trail","Stock is visible; procurement performance is not","Add supplier and receipt fields where required"],
  ["Medium","Occupany","Snapshot timestamp and model missing","Studio economics present but no governed as-of field","Freshness and supply-lane attribution incomplete","Populate appended timestamps and supply_model"],
  ["Medium","Member Engagement","No dedicated engagement dataset","No cohort/risk/recovery event source","Member Engagement and Self Learn coverage low","Populate REQ_MEMBER_ENGAGEMENT"],
],[14,30,40,32,55,58]);

const hold=wb.addWorksheet("FINANCE_ON_HOLD");setup(hold,"Finance mode — on hold","This workbook targets Self Drive and Self Learn only. Finance datasets and controls are intentionally excluded from the completion percentages.",C.red);
table(hold,["Scope","Status","Reason","Add later"],[["Finance mode","On hold","Business decision","Finance_Daily, cash/opex policies, settlement and reconciliation sources"]],[25,20,40,80]);

for(const ws of wb.worksheets){
  ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.5,bottom:.5,header:.2,footer:.2}};
  ws.headerFooter={...(ws.headerFooter||{}),oddFooter:"Rafiqi Central — Existing Data Mapped Template | &P of &N"};
  ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{cell.font={...(cell.font||{}),name:"Aptos"};}));
  const headers=new Map();ws.getRow(4).eachCell((cell,col)=>headers.set(String(cell.value||"").toLowerCase(),col));
  for(const [header,col] of headers){
    let values=null;
    if(header==="status") values="Open,On hold,Won,Lost,Closed,Approved,Pending,Rejected";
    if(header==="state") values="Detected,Assigned,In progress,Proof submitted,Verified,Closed,Reopened,Escalated";
    if(header==="certainty") values="Committed,Likely,Pipeline,Unknown";
    if(header==="verification_status") values="Pending,Verified,Rejected,Stale";
    if(header==="decision") values="Pending,Approved,Rejected,Overridden";
    if(header==="approval_required") values="Yes,No";
    if(values){for(let r=6;r<=205;r++)ws.getCell(r,col).dataValidation={type:"list",allowBlank:true,formulae:[`"${values}"`]};}
  }
}

await wb.xlsx.writeFile(output);
console.log(output);
