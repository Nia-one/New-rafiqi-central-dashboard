import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("outputs/self-drive-self-learn-data-template");
const outputFile = path.join(outputDir, "Rafiqi_Self_Drive_Self_Learn_Data_Template.xlsx");
await fs.mkdir(outputDir, { recursive: true });

const wb = new ExcelJS.Workbook();
wb.creator = "OpenAI Codex";
wb.created = new Date("2026-07-28T00:00:00+05:30");
wb.modified = new Date();
wb.subject = "Vertical-wise source template for Self Drive and Self Learn modes";
wb.title = "Rafiqi Central Data Intake Template";

const C = {
  navy: "17365D", blue: "2F5597", lightBlue: "D9EAF7", paleBlue: "EAF2F8",
  gold: "A66A00", paleGold: "FFF2CC", green: "548235", paleGreen: "E2F0D9",
  red: "C00000", paleRed: "FCE4D6", grey: "666666", paleGrey: "F2F2F2",
  white: "FFFFFF", ink: "1F1F1F", border: "D9D2C3"
};

const thin = { style: "thin", color: { argb: C.border } };
const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } };
const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: C.blue } };

function setMatrix(ws, startRow, startCol, values) {
  values.forEach((row, rIdx) => row.forEach((value, cIdx) => {
    ws.getCell(startRow + rIdx, startCol + cIdx).value = value;
  }));
}

function baseSheet(name, title, subtitle, tabColor = C.blue) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
  ws.properties.tabColor = { argb: tabColor };
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = title;
  ws.getCell("A1").fill = titleFill;
  ws.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: C.white } };
  ws.getCell("A1").alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;
  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = subtitle;
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.paleBlue } };
  ws.getCell("A2").font = { name: "Aptos", size: 10, italic: true, color: { argb: C.ink } };
  ws.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(2).height = 30;
  return ws;
}

function addInputSheet({name, title, subtitle, headers, example, required = [], validations = {}, formats = {}}) {
  const ws = baseSheet(name, title, subtitle);
  ws.getCell("A3").value = "Blue headers = required input | Grey headers = optional input | Example row is illustrative and may be replaced.";
  ws.mergeCells(3, 1, 3, Math.max(8, headers.length));
  ws.getCell("A3").font = { name: "Aptos", size: 9, color: { argb: C.grey } };
  ws.getCell("A3").alignment = { wrapText: true };
  const hr = ws.getRow(4);
  hr.values = headers;
  hr.height = 34;
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    const isReq = required.includes(h);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isReq ? C.blue : C.grey } };
    cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: C.white } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = { bottom: thin };
  });
  ws.getRow(5).values = example;
  ws.getRow(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.paleGold } };
  ws.getRow(5).font = { name: "Aptos", size: 9, color: { argb: C.ink } };
  ws.getRow(5).alignment = { vertical: "top", wrapText: true };
  ws.getRow(5).height = 34;
  for (let r = 6; r <= 205; r++) {
    ws.getRow(r).font = { name: "Aptos", size: 9 };
  }
  headers.forEach((h, i) => {
    const letter = ws.getColumn(i + 1).letter;
    ws.getColumn(i + 1).width = Math.max(14, Math.min(28, h.length + 4));
    if (validations[h]) ws.getCell(`${letter}5`).dataValidation = { type: "list", allowBlank: !required.includes(h), formulae: [`\"${validations[h].join(",")}\"`] };
    for (let r = 6; r <= 205; r++) {
      if (validations[h]) ws.getCell(`${letter}${r}`).dataValidation = { type: "list", allowBlank: !required.includes(h), formulae: [`\"${validations[h].join(",")}\"`] };
    }
    if (formats[h]) ws.getColumn(i + 1).numFmt = formats[h];
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 205, column: headers.length } };
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width, 20);
  return ws;
}

const start = baseSheet("START_HERE", "Rafiqi Central — Self Drive + Self Learn Data Template", "Use this workbook first to compare your current files against the exact minimum data required. Finance mode is intentionally on hold.", C.green);
start.getCell("A4").value = "Recommended order";
start.getCell("A4").fill = headerFill; start.getCell("A4").font = { bold: true, color: { argb: C.white } };
const instructions = [
  ["1", "Fill SOURCE_CHECKLIST", "Mark which existing file/bot contains each vertical."],
  ["2", "Paste existing data", "Use the relevant INPUT_* tab. Keep one row per event/snapshot."],
  ["3", "Keep IDs stable", "Do not change demand_id, studio_id, action_id, evidence_id or approval_id after creation."],
  ["4", "Update timestamps", "captured_at / updated_at must reflect the source record time in IST."],
  ["5", "Share bot response sheets", "We will map bot columns to these standard tabs; no duplicate manual entry."],
  ["6", "Dashboard refresh", "Once mapped, both Self Drive and Self Learn consume the normalized tabs automatically."],
];
setMatrix(start, 5, 1, instructions);
for (let r = 5; r <= 10; r++) { start.getRow(r).alignment = { wrapText: true, vertical: "top" }; start.getRow(r).height = 34; }
start.getColumn("A").width = 8; start.getColumn("B").width = 28; start.getColumn("C").width = 88;
start.getCell("A12").value = "Legend"; start.getCell("A12").font = { bold: true, size: 12 };
start.getCell("A13").value = "Required"; start.getCell("A13").fill = headerFill; start.getCell("A13").font = { color: { argb: C.white }, bold: true };
start.getCell("B13").value = "Must exist for full coverage of the related dashboard component.";
start.getCell("A14").value = "Optional"; start.getCell("A14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.grey } }; start.getCell("A14").font = { color: { argb: C.white }, bold: true };
start.getCell("B14").value = "Useful for filters, drill-downs or better automation; may initially be blank.";
start.getCell("A15").value = "System derived"; start.getCell("A15").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.paleGreen } }; start.getCell("B15").value = "Do not ask users to type this; backend calculates it.";

const checklist = baseSheet("SOURCE_CHECKLIST", "Source availability checklist", "Complete this before sharing data. It identifies exactly what is available, missing, bot-fed, or Google-Sheet-fed.", C.green);
const checklistHeaders = ["Vertical", "Business meaning", "Current source expected", "Your source/file", "Available?", "Feed type", "Refresh frequency", "Owner", "Required for", "Gap if missing"];
checklist.getRow(4).values = checklistHeaders;
checklist.getRow(4).eachCell(c => { c.fill = headerFill; c.font = { bold: true, color: { argb: C.white } }; c.alignment = { wrapText: true }; });
const checklistRows = [
  ["FONO Demand", "Demand allocated to FONO / readiness requirement", "FONO tracker", "", "Check", "Google Sheet", "Hourly/Daily", "", "Growth, Enterprise Demand", "FONO gap cannot be split correctly"],
  ["FONO Supply", "Contracted, activation-ready and occupied FONO nests", "FONO tracker", "", "Check", "Google Sheet", "Hourly/Daily", "", "Growth, Occupancy", "FONO capacity/readiness missing"],
  ["Essentials Demand", "Occupant/member orders placed", "Essentials order bot", "", "Check", "Bot → Sheet", "Near real-time", "", "Essentials, Savings", "Order demand and conversion missing"],
  ["Essentials Supply", "Inventory, purchase and fulfilment", "Inventory Report", "", "Check", "Google Sheet", "Daily", "", "Essentials, Savings, Margin", "Stock/fulfilment/margin incomplete"],
  ["Occupancy", "Contracted, ready and occupied nests by Studio", "Occupancy Sheet", "", "Check", "Google Sheet", "Hourly/Daily", "", "Member Adds, Growth, Margins", "Occupancy and vacancy actions missing"],
  ["Shram Park Supply", "SP contracted/ready/occupied nests and coverage", "Shram Park tracker/bot", "", "Check", "Google Sheet / Bot", "Hourly/Daily", "", "Growth", "SP lane cannot be assessed"],
  ["Enterprise Demand", "Client/plant headcount requirement and matching", "Enterprise demand source", "", "Check", "Google Sheet", "Daily", "", "Enterprise Demand, Growth", "Named demand and allocation missing"],
  ["People & shifts", "Owners, roles, shifts and heartbeat timing", "People roster", "", "Check", "Google Sheet", "Daily", "", "Dispatch, Sign-Off, all filters", "Ownership and quiet-person monitoring incomplete"],
  ["Policies & targets", "Governed thresholds, SLA, caps and approvers", "Policy Registry", "", "Check", "Google Sheet", "On change", "", "All pages", "Cannot compare actual vs approved control"],
  ["Workflow logs", "Incidents, actions, evidence, approvals", "Four governed logs", "", "Check", "Google Sheet", "Event driven", "", "Self Drive + Self Learn", "No lifecycle, verification or learning history"],
];
setMatrix(checklist, 5, 1, checklistRows);
for (let r = 5; r <= 4 + checklistRows.length; r++) {
  checklist.getCell(`E${r}`).dataValidation = { type: "list", formulae: ['"Yes,Partial,No,Check"'] };
  checklist.getCell(`F${r}`).dataValidation = { type: "list", formulae: ['"Google Sheet,Bot → Sheet,Google Sheet / Bot,Manual upload,Not available"'] };
  checklist.getRow(r).alignment = { wrapText: true, vertical: "top" }; checklist.getRow(r).height = 38;
}
[18,28,25,24,12,20,18,18,27,36].forEach((w,i)=>checklist.getColumn(i+1).width=w);
checklist.autoFilter = "A4:J14";

const dateFmt = "dd mmm yyyy, hh:mm";
addInputSheet({name:"INPUT_FONO", title:"FONO — Demand and Supply", subtitle:"Use one tab for the current combined FONO tracker. record_type separates demand from supply; stable IDs prevent duplicate records.", headers:["record_id","record_type","captured_at","theatre_id","studio_id","enterprise_id","demand_id","plant_id","headcount_required","headcount_matched","contracted_nests","activation_ready_nests","occupied_nests","status","owner_actor_id","updated_at"], example:["FONO-20260728-001","Supply","28 Jul 2026, 10:00","TH-NCR","ST-NOIDA-01","ENT-001","DEM-001","PLANT-01",120,96,120,96,72,"Active","ACT-PRIYA","28 Jul 2026, 10:05"], required:["record_id","record_type","captured_at","theatre_id","studio_id","contracted_nests","activation_ready_nests","occupied_nests","status","updated_at"], validations:{record_type:["Demand","Supply"],status:["Active","Pending","Closed","Blocked"]}, formats:{captured_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_ESS_ORDERS", title:"Essentials Demand — Occupant/Member Orders", subtitle:"Bot response sheet. Demand means orders placed by occupants/members; one row per order or order event.", headers:["order_id","ordered_at","member_token","theatre_id","studio_id","sku_id","sku_name","quantity_ordered","member_price_inr","order_value_inr","order_status","fulfilled_at","source_bot_event_id","updated_at"], example:["ORD-001","28 Jul 2026, 09:15","MEM-001","TH-TN","ST-SRI-01","SKU-RICE-5KG","Rice 5kg",1,420,420,"Fulfilled","28 Jul 2026, 10:00","BOT-EVT-991","28 Jul 2026, 10:02"], required:["order_id","ordered_at","theatre_id","studio_id","sku_id","quantity_ordered","order_value_inr","order_status","updated_at"], validations:{order_status:["Placed","Confirmed","Fulfilled","Cancelled","Returned"]}, formats:{ordered_at:dateFmt,fulfilled_at:dateFmt,updated_at:dateFmt,member_price_inr:"₹#,##0.00",order_value_inr:"₹#,##0.00"}});
addInputSheet({name:"INPUT_ESS_INVENTORY", title:"Essentials Supply — Inventory and Fulfilment", subtitle:"Company purchase / Inventory Report. Supply means available stock, purchasing, landed cost and fulfilment capacity.", headers:["inventory_snapshot_id","captured_at","theatre_id","studio_id","sku_id","sku_name","opening_stock_qty","purchased_qty","fulfilled_qty","closing_stock_qty","stockout_flag","purchase_cost_inr","mrp_inr","member_price_inr","supplier_id","batch_id","updated_at"], example:["INV-001","28 Jul 2026, 09:00","TH-TN","ST-SRI-01","SKU-RICE-5KG","Rice 5kg",20,40,25,35,"No",350,480,420,"SUP-01","BATCH-77","28 Jul 2026, 09:05"], required:["inventory_snapshot_id","captured_at","theatre_id","studio_id","sku_id","opening_stock_qty","purchased_qty","fulfilled_qty","closing_stock_qty","purchase_cost_inr","updated_at"], validations:{stockout_flag:["Yes","No"]}, formats:{captured_at:dateFmt,updated_at:dateFmt,purchase_cost_inr:"₹#,##0.00",mrp_inr:"₹#,##0.00",member_price_inr:"₹#,##0.00"}});
addInputSheet({name:"INPUT_OCCUPANCY", title:"Occupancy — Studio Capacity Snapshot", subtitle:"One row per Studio per snapshot. The backend derives occupancy ratio and vacancy; do not manually calculate them.", headers:["occupancy_snapshot_id","captured_at","theatre_id","studio_id","supply_model","contracted_nests","activation_ready_nests","occupied_nests","members_joined","membership_ends","open_service_requests","primary_blocker","owner_actor_id","next_action_due_at","updated_at"], example:["OCC-001","28 Jul 2026, 09:00","TH-NCR","ST-NOIDA-01","FONO",120,96,72,4,1,2,"None","ACT-PRIYA","28 Jul 2026, 16:00","28 Jul 2026, 09:05"], required:["occupancy_snapshot_id","captured_at","theatre_id","studio_id","supply_model","contracted_nests","activation_ready_nests","occupied_nests","updated_at"], validations:{supply_model:["FONO","Shram Park","Other"]}, formats:{captured_at:dateFmt,next_action_due_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_SHRAM_PARK", title:"Shram Park — Supply and Coverage", subtitle:"Current Sheet now; bot can later map into the same columns. Keep Shram Park separate from FONO.", headers:["sp_snapshot_id","captured_at","theatre_id","studio_id","park_id","park_name","contracted_nests","activation_ready_nests","occupied_nests","signed_contract_coverage_nests","capital_coverage_status","readiness_status","primary_blocker","owner_actor_id","updated_at"], example:["SP-001","28 Jul 2026, 09:00","TH-PUNE","ST-CHAKAN-04","PARK-01","Chakan Park",100,60,55,80,"Recorded","In progress","Hardware evidence pending","ACT-PRIYA","28 Jul 2026, 09:05"], required:["sp_snapshot_id","captured_at","theatre_id","studio_id","park_id","contracted_nests","activation_ready_nests","occupied_nests","readiness_status","updated_at"], validations:{capital_coverage_status:["Recorded","Partial","Not recorded"],readiness_status:["Ready","In progress","Blocked","Not assessed"]}, formats:{captured_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_ENTERPRISE", title:"Enterprise Demand — Client and Plant Requirement", subtitle:"Required only if the FONO/Shram Park trackers do not already include complete named demand. Demand and supply remain separate records linked by demand_id/studio_id.", headers:["demand_id","enterprise_id","enterprise_name","plant_id","plant_name","latitude","longitude","role_required","skill_required","shift","headcount_required","headcount_matched","activation_required_at","certainty","status","owner_actor_id","opened_at","updated_at"], example:["DEM-001","ENT-001","Example Manufacturing","PLANT-01","Noida Plant",28.61,77.21,"Operator","Assembly","Day",120,96,"31 Jul 2026, 09:00","Committed","Open","ACT-PRIYA","25 Jul 2026, 10:00","28 Jul 2026, 09:00"], required:["demand_id","enterprise_id","enterprise_name","plant_id","headcount_required","headcount_matched","activation_required_at","status","owner_actor_id","updated_at"], validations:{certainty:["Pipeline","Likely","Committed"],status:["Open","Matched","Activated","Closed","Cancelled"]}, formats:{activation_required_at:dateFmt,opened_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_PEOPLE", title:"People, Ownership and Shift Roster", subtitle:"Minimum people data for filters, Dispatch heartbeat evaluation, action ownership and sign-off routing.", headers:["actor_id","display_name","role","theatre_id","studio_id","manager_actor_id","active_shift","shift_start_at","shift_end_at","language","last_heartbeat_at","next_heartbeat_due_at","active","updated_at"], example:["ACT-PRIYA","Priya Rao (Test)","Demand JCO","TH-TN","ST-SRI-01","ACT-MGR-01","Day","28 Jul 2026, 09:00","28 Jul 2026, 18:00","English","28 Jul 2026, 11:35","28 Jul 2026, 12:05","Yes","28 Jul 2026, 11:36"], required:["actor_id","display_name","role","active_shift","shift_start_at","shift_end_at","active","updated_at"], validations:{active_shift:["Day","Night","Off","Rest day"],active:["Yes","No"]}, formats:{shift_start_at:dateFmt,shift_end_at:dateFmt,last_heartbeat_at:dateFmt,next_heartbeat_due_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_POLICY", title:"Policy Registry — Targets, Thresholds and Approvers", subtitle:"Low-frequency governed setup. Without this tab the dashboard can show actuals but cannot claim control, breach or approval authority.", headers:["policy_id","domain","metric_name","scope_type","scope_id","operator","threshold_value","unit","effective_from","effective_to","approver_actor_id","version","status","updated_at"], example:["POL-OCC-001","Occupancy","occupancy_ratio","Studio","ST-NOIDA-01",">=",0.78,"ratio","01 Jul 2026, 00:00","","ACT-PRIYA","v1","Approved","01 Jul 2026, 00:00"], required:["policy_id","domain","metric_name","scope_type","operator","threshold_value","unit","effective_from","approver_actor_id","version","status","updated_at"], validations:{scope_type:["Global","Theatre","Studio","Vertical","Person"],operator:[">=","<=","=",">","<"],status:["Draft","Pending","Approved","Retired"]}, formats:{effective_from:dateFmt,effective_to:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_INCIDENT_LOG", title:"Incident Log — Detected Exceptions", subtitle:"One record for each governed exception. This is the entry point for Self Drive action creation.", headers:["incident_id","domain","incident_type","event_at","theatre_id","studio_id","short_description","impacted_members","impacted_nests","amount_at_risk_inr","severity","severity_reason","owner_actor_id","due_at","action_required","approval_required","state","reported_by_actor_id","reported_at"], example:["INC-001","Essentials","Stockout","28 Jul 2026, 10:00","TH-TN","ST-SRI-01","Rice SKU unavailable",20,0,8400,"High","Member orders blocked","ACT-PRIYA","28 Jul 2026, 14:00","Restore stock","No","Open","ACT-SYSTEM","28 Jul 2026, 10:01"], required:["incident_id","domain","incident_type","event_at","short_description","severity","owner_actor_id","due_at","state","reported_at"], validations:{severity:["Low","Medium","High","Critical"],approval_required:["Yes","No"],state:["Open","Assigned","In progress","Resolved","Closed","Reopened"]}, formats:{event_at:dateFmt,due_at:dateFmt,reported_at:dateFmt,amount_at_risk_inr:"₹#,##0.00"}});
addInputSheet({name:"INPUT_ACTION_LOG", title:"Action Log — Work Lifecycle", subtitle:"Drives action cards, urgency, ownership, recovery and Self Learn history. One row per action; updates retain the same action_id.", headers:["action_id","incident_id","operating_objective","expected_metric","baseline_value","target_value","expected_financial_impact_inr","confidence","owner_actor_id","due_at","required_evidence","approval_tier","state","proposed_at","updated_at"], example:["ACTN-001","INC-001","Restore stock availability","fulfilled_orders",0,20,8400,"Medium","ACT-PRIYA","28 Jul 2026, 14:00","Supplier receipt + stock photo","Routine","Assigned","28 Jul 2026, 10:02","28 Jul 2026, 10:02"], required:["action_id","incident_id","operating_objective","expected_metric","baseline_value","target_value","owner_actor_id","due_at","required_evidence","approval_tier","state","proposed_at","updated_at"], validations:{confidence:["Low","Medium","High"],approval_tier:["Routine","Owner","Finance","Central"],state:["Proposed","Assigned","In progress","Proof submitted","Verified","Closed","Reopened","Escalated","Rejected"]}, formats:{due_at:dateFmt,proposed_at:dateFmt,updated_at:dateFmt,expected_financial_impact_inr:"₹#,##0.00"}});
addInputSheet({name:"INPUT_EVIDENCE_LOG", title:"Evidence Log — Protected Proof", subtitle:"Independent verification depends on evidence linked to incident/action/approval IDs. URLs may be protected references.", headers:["evidence_id","linked_type","linked_id","evidence_type","protected_url","uploaded_by_actor_id","uploaded_at","description","verification_status","verified_by_actor_id","verified_at","updated_at"], example:["EVD-001","Action","ACTN-001","Stock receipt","protected://evidence/evd-001","ACT-PRIYA","28 Jul 2026, 12:00","40 units received","Pending","","","28 Jul 2026, 12:00"], required:["evidence_id","linked_type","linked_id","evidence_type","protected_url","uploaded_by_actor_id","uploaded_at","verification_status","updated_at"], validations:{linked_type:["Incident","Action","Approval","Person"],verification_status:["Pending","Verified","Rejected","Stale"]}, formats:{uploaded_at:dateFmt,verified_at:dateFmt,updated_at:dateFmt}});
addInputSheet({name:"INPUT_APPROVAL_LOG", title:"Approval Log — Human Decisions", subtitle:"Only material/high-risk changes appear here. One authorised decision per approval_id; no automatic approval.", headers:["approval_id","linked_action_id","decision_type","amount_inr","current_terms","proposed_terms","business_reason","expected_result","approver_actor_id","approver_role","decision","decision_reason","requested_at","decided_at","updated_at"], example:["APR-001","ACTN-001","Temporary purchase exception",8400,"No emergency purchase","Buy 40 units","Restore member orders","20 orders fulfilled","ACT-PRIYA","Finance approver","Pending","","28 Jul 2026, 10:05","","28 Jul 2026, 10:05"], required:["approval_id","linked_action_id","decision_type","business_reason","expected_result","approver_actor_id","approver_role","decision","requested_at","updated_at"], validations:{decision:["Pending","Approved","Declined","Withdrawn"]}, formats:{amount_inr:"₹#,##0.00",requested_at:dateFmt,decided_at:dateFmt,updated_at:dateFmt}});

const mapping = baseSheet("DASHBOARD_MAPPING", "Dashboard mapping — where each source flows", "This is the frontend data-flow map for the two go-live modes. Finance is excluded from current scope.", C.green);
const mapHeaders = ["Input tab", "Vertical", "Self Drive pages/components", "Self Learn pages/components", "Primary keys", "System-derived outputs", "Manual effort after integration"];
mapping.getRow(4).values = mapHeaders;
mapping.getRow(4).eachCell(c=>{c.fill=headerFill;c.font={bold:true,color:{argb:C.white}};c.alignment={wrapText:true};});
const mapRows = [
  ["INPUT_FONO","FONO demand + supply","Enterprise Demand; Member Adds; Nia Growth; Dispatch","Patterns; recommendations; recovery learning","record_id, demand_id, studio_id","headcount gap; readiness gap; progress %","Update tracker only"],
  ["INPUT_ESS_ORDERS","Essentials demand/orders","Member Savings; Dispatch; Sign-Off","Demand pattern; conversion; repeat failures","order_id, sku_id, studio_id","orders placed; conversion; service exceptions","Bot writes automatically"],
  ["INPUT_ESS_INVENTORY","Essentials supply/inventory","Member Savings; Nia Margins; Dispatch","Stockout and fulfilment learning","snapshot_id, sku_id, studio_id","stockout; fulfilment; savings/margin inputs","Update Inventory Report only"],
  ["INPUT_OCCUPANCY","Occupancy","Member Adds; Member Engagement; Nia Margins; Nia Growth; Dispatch","Occupancy patterns and interventions","snapshot_id, studio_id","occupancy ratio; vacancy; readiness gap","Update Occupancy Sheet only"],
  ["INPUT_SHRAM_PARK","Shram Park supply","Nia Growth; Dispatch; Sign-Off","SP readiness patterns","sp_snapshot_id, park_id, studio_id","SP readiness and coverage gap","Sheet now; bot later"],
  ["INPUT_ENTERPRISE","Enterprise demand","Enterprise Demand; Nia Growth; Dispatch","Demand certainty and match learning","demand_id, enterprise_id, plant_id","headcount remaining; allocation status","Only if absent from existing trackers"],
  ["INPUT_PEOPLE","People/ownership","All filters; Dispatch; Sign-Off","People follow-through and verified recurrence","actor_id","shift eligibility; heartbeat state; owner routing","Maintain roster/shift times"],
  ["INPUT_POLICY","Policies/controls","All control, breach and decision components","Learning boundaries and adoption gates","policy_id, version","breach status; approved control; approver","Rare update on policy change"],
  ["INCIDENT + ACTION + EVIDENCE + APPROVAL","Workflow lifecycle","Issues; actions; decisions; audit; closed results","Recommendations vs outcomes; feedback; accuracy","incident_id/action_id/evidence_id/approval_id","urgency; verification; recovery; learning metrics","Event-driven writes only"],
];
setMatrix(mapping, 5, 1, mapRows);
for(let r=5;r<=4+mapRows.length;r++){mapping.getRow(r).height=48;mapping.getRow(r).alignment={wrapText:true,vertical:"top"};}
[24,24,45,42,34,42,32].forEach((w,i)=>mapping.getColumn(i+1).width=w);

const dict = baseSheet("COLUMN_DICTIONARY", "Column dictionary", "Minimum interpretation rules. Required fields are already blue in each input tab; this dictionary explains critical calculated fields and joins.", C.green);
const dHeaders=["Tab / area","Field or concept","Required?","Type / format","Definition","Example","Derived / join rule","Used by"];
dict.getRow(4).values=dHeaders;dict.getRow(4).eachCell(c=>{c.fill=headerFill;c.font={bold:true,color:{argb:C.white}};c.alignment={wrapText:true};});
const dRows=[
  ["All input tabs","*_id","Yes","Text; unique; stable","Permanent source identifier used for de-duplication and joins","ACTN-001","Never regenerate for an existing record","Both modes"],
  ["All input tabs","captured_at / updated_at","Yes","IST datetime","When the event was captured and last changed","28 Jul 2026, 10:00","Newest updated_at wins for same ID","Freshness + all pages"],
  ["FONO / Enterprise","headcount_remaining","System","Number","Unfilled enterprise requirement","24","headcount_required - headcount_matched","Enterprise Demand; Growth"],
  ["Occupancy / FONO / SP","occupancy_ratio","System","Percentage","Occupied share of contracted capacity","60%","occupied_nests / contracted_nests","Member Adds; Margins"],
  ["Occupancy / FONO / SP","readiness_gap","System","Number","Contracted capacity not activation-ready","24","contracted_nests - activation_ready_nests","Growth"],
  ["Essentials","member_savings_inr","System","Currency INR","Savings delivered to members","₹60","(MRP - member price) × fulfilled quantity","Member Savings"],
  ["Essentials","nia_margin_inr","System","Currency INR","Recorded contribution after product and fulfilment cost","₹25","billed - product COGS - direct fulfilment cost","Nia Margins"],
  ["Workflow","linked_id","Yes","Text ID","Connects evidence/approval to governed work","ACTN-001","Must exist in corresponding source log","Dispatch; Sign-Off; Self Learn"],
  ["Workflow","verification_status","Yes","Controlled text","Independent evidence result","Verified","Only Verified outcomes count as closed performance","Both modes"],
  ["Policy","threshold_value","Yes","Number","Approved control value, never inferred","0.78","Apply by domain + scope + effective dates","All control verdicts"],
];
setMatrix(dict, 5, 1, dRows);for(let r=5;r<=4+dRows.length;r++){dict.getRow(r).height=42;dict.getRow(r).alignment={wrapText:true,vertical:"top"};}
[25,27,12,20,45,24,45,30].forEach((w,i)=>dict.getColumn(i+1).width=w);

const future = baseSheet("FINANCE_ON_HOLD", "Finance mode — on hold", "No finance data is required for the current Self Drive + Self Learn go-live. Retain this sheet as a scope marker only.", C.red);
future.getCell("A4").value="Status";future.getCell("B4").value="On hold by business decision";future.getCell("A5").value="Current go-live";future.getCell("B5").value="Self Drive + Self Learn only";future.getCell("A6").value="Add later";future.getCell("B6").value="Finance_Daily, cash guardrails, opex policies, settlement and reconciliation sources";
future.getColumn("A").width=24;future.getColumn("B").width=90;

for (const ws of wb.worksheets) {
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  ws.headerFooter.oddFooter = "Rafiqi Central — Self Drive + Self Learn Data Template | &P of &N";
  ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
    cell.font = { ...(cell.font || {}), name: "Aptos" };
  }));
}

await wb.xlsx.writeFile(outputFile);
console.log(outputFile);
