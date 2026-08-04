import { buildOpsData } from "./opsDataMapper";
import { NO_DATA, type ActionStatus, type Measured, type MismatchInput } from "./allocation-types";
import type { SupplyOption } from "./allocation-data";

export type LiveAllocationData = {
  mismatchInputs: MismatchInput[];
  supplyOptions: SupplyOption[];
  rootCause: any[];
  actions: any[];
  executionQueue: any[];
};

function text(row: any, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function number(row: any, keys: string[]): number | null {
  const value = text(row, keys);
  if (!value) return null;
  const parsed = Number(value.replace(/[,₹%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalise(value: any) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameEntity(left: any, right: any) {
  const a = normalise(left);
  const b = normalise(right);
  return Boolean(a && b && a === b);
}

function status(value: any): ActionStatus {
  const source = String(value || "").trim();
  if (source === "Open") return "Detected";
  return (["Detected", "Agreed", "Assigned", "Resolved", "Closed", "Verified", "Dismissed"] as const).includes(source as ActionStatus)
    ? source as ActionStatus
    : "Detected";
}

function measured(value: number | null): Measured<number> {
  return value === null || !Number.isFinite(value) ? NO_DATA : value;
}

function recoverableShare(value: number | null) {
  if (value === null) return null;
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
}

function confidence(value: any): "High" | "Medium" | "Low" | null {
  const label = String(value || "").trim();
  return label === "High" || label === "Medium" || label === "Low" ? label : null;
}

export async function buildAllocationData(period: string = "all"): Promise<LiveAllocationData> {
  const ops = await buildOpsData(period);

  const peopleById = new Map((ops.people ?? []).map((person: any) => [
    text(person, ["actor id", "Actor ID"]),
    text(person, ["display name", "Display Name", "name", "Name"]),
  ]));
  const ownerName = (actorId: string) => peopleById.get(actorId) || actorId;

  const constraintInputs: MismatchInput[] = (ops.constraints ?? []).map((item: any) => {

      const root = (ops.rootCause ?? []).find(
        (r: any) => r.constraintId === item.id
      );

      const action = (ops.actions ?? []).find(
        (a: any) => a.constraintId === item.id
      );

      const queueItem = (ops.executionQueue ?? []).find(
        (entry: any) => entry.constraintId === item.id
      );

      const lane = item.lane || "Shram Park";
      const domain = lane === "FONO" ? "FONO" : lane === "Essentials" ? "Essentials" : "Shram Park";
      const actionTemplateId = lane === "FONO" ? "fono-idle" : lane === "Shram Park" ? "sram-shortfall" : lane === "Essentials" ? "ess-stockout" : "constraint"
      const actionStatus = status(action?.status || queueItem?.status);

      const studio = (ops.studios ?? []).find((row: any) =>
        sameEntity(item.where, text(row, ["studio name", "Studio Name"])) ||
        sameEntity(item.where, text(row, ["studio id", "Studio ID"]))
      );
      const studioId = text(studio, ["studio id", "Studio ID"]);
      const livingSource = studioId
        ? (ops.living ?? []).find((row: any) => sameEntity(studioId, text(row, ["studio id", "Studio ID"])))
        : null;
      const demandSource = lane === "Shram Park"
        ? (ops.enterpriseDemand ?? []).find((row: any) =>
            sameEntity(item.where, text(row, ["plant name", "Plant Name", "plant id", "Plant ID", "demand id", "Demand ID"]))
          )
        : null;
      const essentialsSource = lane === "Essentials" && studioId
        ? (ops.essentials ?? []).find((row: any) => sameEntity(studioId, text(row, ["studio id", "Studio ID"])))
        : null;
      const inventorySource = lane === "Essentials" && studioId
        ? (ops.essentialsInventory ?? []).find((row: any) =>
            sameEntity(studioId, text(row, ["studio", "Studio"])) && text(row, ["stockout", "Stockout"]).toLowerCase() === "yes"
          )
        : null;

      let demandQty: Measured<number> = NO_DATA;
      let supplyQty: Measured<number> = NO_DATA;
      let gapQty: Measured<number> = measured(item.idleUnits);
      let gapUnit = lane === "Essentials" ? "units" : "Nests";
      let sourceAction = "";
      let sourceOwner = "";
      let sourceDeadline = "";
      let sourceBlocker = "";
      let sourceUpdatedAt = "";
      const sourceReferences: string[] = [];

      if (lane === "FONO" && livingSource) {
        const ready = number(livingSource, ["activation ready nests", "Activation Ready Nests"]);
        const occupied = number(livingSource, ["occupied nests", "Occupied Nests"]);
        demandQty = measured(occupied);
        supplyQty = measured(ready);
        gapQty = ready !== null && occupied !== null ? Math.max(0, ready - occupied) : gapQty;
        sourceAction = text(livingSource, ["next action", "Next Action"]);
        sourceOwner = ownerName(text(livingSource, ["next action owner actor id", "Next Action Owner Actor ID"]));
        sourceDeadline = text(livingSource, ["next action due at", "Next Action Due At"]);
        sourceBlocker = text(livingSource, ["primary blocker", "Primary Blocker"]);
        sourceUpdatedAt = text(livingSource, ["updated at", "captured at"]);
        sourceReferences.push("Living_Hourly", "Studio_Master");
      } else if (lane === "Shram Park" && demandSource) {
        const required = number(demandSource, ["headcount required", "Headcount Required"]);
        const matched = number(demandSource, ["headcount matched", "Headcount Matched"]);
        const remaining = number(demandSource, ["headcount remaining", "Headcount Remaining"]);
        demandQty = measured(required);
        supplyQty = measured(matched);
        gapQty = remaining !== null ? remaining : required !== null && matched !== null ? Math.max(0, required - matched) : gapQty;
        sourceOwner = ownerName(text(demandSource, ["owner actor id", "Owner Actor ID"]));
        sourceDeadline = text(demandSource, ["activation required at", "Activation Required At"]);
        sourceUpdatedAt = text(demandSource, ["updated at", "Updated At"]);
        sourceReferences.push("Enterprise_Demand");
      } else if (lane === "Essentials" && essentialsSource) {
        const stockouts = number(essentialsSource, ["current stockouts", "Current Stockouts"]);
        gapQty = stockouts === null ? gapQty : stockouts;
        gapUnit = "SKUs";
        sourceAction = text(essentialsSource, ["next action", "Next Action"]);
        sourceOwner = ownerName(text(essentialsSource, ["next action owner actor id", "Next Action Owner Actor ID"]));
        sourceDeadline = text(essentialsSource, ["next action due at", "Next Action Due At"]);
        sourceBlocker = text(essentialsSource, ["primary blocker", "Primary Blocker"]);
        sourceUpdatedAt = text(essentialsSource, ["updated at", "captured at"]);
        sourceReferences.push("Essentials_Hourly");
        if (inventorySource) sourceReferences.push("Essentials_Inventory");
      }

      if (sourceReferences.length === 0) sourceReferences.push("Constraints");

      const riskHours = item.riskHours ?? 24;
      const calculatedCm = item.idleUnits !== null && item.cmPerUnit !== null
        ? Math.round(item.idleUnits * item.cmPerUnit * (riskHours / 24))
        : null;
      const cmAtRisk = calculatedCm ?? item.impact ?? (queueItem ? Number(queueItem.cmRisk) : null);
      const timingAvailable = item.ageHours !== null && item.thresholdHours !== null;
      const liveRecoverableShare = recoverableShare(item.recoverableShare);
      const liveConfidence = confidence(item.confidence);
      const nextAction = sourceAction || action?.action || item.next || root?.nextStep || NO_DATA;
      const evidence = Array.from(new Set([
        sourceBlocker,
        root?.evidence,
        item.detail,
      ].filter(Boolean)));
      const evidenceReferences = Array.from(new Set([
        ...sourceReferences,
        root ? "rootCause" : "",
        action ? "actions" : "",
        queueItem ? "executionQueue" : "",
      ].filter(Boolean)));

      return {
        id: item.id,
        domain,
        mismatchType: lane === "FONO" ? "idle-capacity" : lane === "Essentials" ? "stockout" : "shortfall",

        theatre: item.theatre || item.where || "Unknown",
        where: item.where || "",
        label: item.title,

        joinKey: lane === "Shram Park"
          ? { theatreId: item.theatre || item.where || "", factoryId: item.where || "", demandBatchId: text(demandSource, ["demand id", "Demand ID"]) || undefined }
          : { theatreId: item.theatre || item.where || "", studioId: studioId || item.where || "", skuId: text(inventorySource, ["sku", "SKU"]) || undefined },

        demandQty,
        supplyQty,
        gapQty,
        gapUnit,

        ageHours: item.ageHours ?? 0,
        thresholdHours: item.thresholdHours ?? item.riskHours ?? 24,
        timingAvailable,
        deadlineAt: sourceDeadline || action?.dueDate || item.deadlineAt || NO_DATA,

        forwardCmAtRisk24h: measured(cmAtRisk),

        recoverableShare: liveRecoverableShare ?? 0,
        confidence: liveConfidence ?? "Low",
        scoringInputsAvailable: liveRecoverableShare !== null && liveConfidence !== null,
        attentionBucket: "Unassigned",

        sourceUpdatedAt: sourceUpdatedAt || ops.meta.updatedAt,
        sourceLabel: evidenceReferences.join(" · "),

        accountableOwner:
          sourceOwner ||
          action?.owner ||
          root?.owner ||
          queueItem?.owner ||
          item.owner ||
          NO_DATA,

        actionStatus,

        actionTemplateId,

        nextAction,
        alertStatus: queueItem?.alertStatus || NO_DATA,
        alertQueuedAt: queueItem?.alertQueuedAt || NO_DATA,

        laneTarget:
  item.lane === "FONO"
    ? { screen: "Living", subsection: "fono" }
    : item.lane === "Essentials"
    ? { screen: "Essentials" }
    : (item.lane === "Supply" || item.lane === "Shram Park")
    ? { screen: "Living", subsection: "supply" }
    : { screen: "Overview" },

        evidence: evidence.length ? evidence : [NO_DATA],

        rootCauseAnalysis: {
          whys: [
            root?.why1 || root?.evidence || item.detail || sourceBlocker || NO_DATA,
            root?.why2 || item.detail || sourceBlocker || NO_DATA,
            root?.why3 || sourceBlocker || NO_DATA,
            root?.why4 || root?.rootCause || NO_DATA,
            root?.why5 || root?.nextStep || action?.action || NO_DATA,
          ],

          rootCause:
            root?.rootCause ||
            item.title ||
            NO_DATA,

          recommendedSolution:
            sourceAction ||
            action?.action ||
            item.next ||
            NO_DATA,

          evidenceReferences,

          review: {
            status: root?.reviewStatus || NO_DATA,
            reviewedBy: root?.reviewedBy || root?.owner || action?.owner || NO_DATA,
            reviewedAt: root?.reviewedAt || NO_DATA,
          },
        },
      };
    }
  );

  const workInputs: MismatchInput[] = (ops.work ?? []).flatMap((row: any, index: number) => {
    const blocker = text(row, ["primary blocker", "Primary Blocker"]);
    const nextAction = text(row, ["next action", "Next Action"]);
    const attendanceExceptions = number(row, ["attendance exceptions", "Attendance Exceptions"]);
    const redeploymentNeeded = number(row, ["redeployment needed", "Redeployment Needed"]);
    const openHeadcount = number(row, ["open headcount", "Open Headcount"]);
    const matchedHeadcount = number(row, ["matched headcount", "Matched Headcount"]);
    const calculatedGap = openHeadcount !== null && matchedHeadcount !== null ? Math.max(0, openHeadcount - matchedHeadcount) : 0;
    const gap = Math.max(attendanceExceptions ?? 0, redeploymentNeeded ?? 0, calculatedGap);
    if (!blocker && !nextAction && gap === 0) return [];

    const theatreId = text(row, ["theatre id", "Theatre ID"]);
    const theatre = (ops.theatres ?? []).find((item: any) => sameEntity(theatreId, text(item, ["theatre id", "Theatre ID"])));
    const theatreName = text(theatre, ["theatre name", "Theatre Name"]) || text(row, ["Theatre", "theatre"]) || theatreId || "Unknown";
    const billed = number(row, ["work billed inr", "Work Billed INR"]);
    const collected = number(row, ["work collected inr", "Work Collected INR"]);
    const cmAtRisk = billed !== null && collected !== null ? Math.max(0, billed - collected) : null;
    const ownerActorId = text(row, ["next action owner actor id", "Next Action Owner Actor ID"]);
    const sourceUpdatedAt = text(row, ["updated at", "captured at", "Updated At", "Captured At"]) || ops.meta.updatedAt;
    const workId = text(row, ["work hourly id", "Work Hourly ID"]) || `work-${index + 1}`;
    const workRecoverableShare = recoverableShare(number(row, ["recoverable share", "Recoverable Share"]));
    const workConfidence = confidence(text(row, ["confidence", "Confidence"]));
    const workAgeHours = number(row, ["age hours", "Age Hours"]);
    const workThresholdHours = number(row, ["threshold hours", "Threshold Hours"]);

    return [{
      id: workId,
      domain: "Work",
      mismatchType: "shortfall",
      theatre: theatreName,
      where: text(row, ["enterprise or employer", "enterprise id", "Enterprise ID"]) || theatreName,
      label: blocker || "Work allocation action required",
      joinKey: { theatreId: theatreName, demandBatchId: text(row, ["demand id", "Demand ID"]) || workId },
      demandQty: measured(openHeadcount),
      supplyQty: measured(matchedHeadcount),
      gapQty: gap,
      gapUnit: "Members",
      ageHours: workAgeHours ?? 0,
      thresholdHours: workThresholdHours ?? 0,
      timingAvailable: workAgeHours !== null && workThresholdHours !== null,
      deadlineAt: text(row, ["next action due at", "Next Action Due At"]) || NO_DATA,
      forwardCmAtRisk24h: measured(cmAtRisk),
      recoverableShare: workRecoverableShare ?? 0,
      confidence: workConfidence ?? "Low",
      scoringInputsAvailable: workRecoverableShare !== null && workConfidence !== null,
      sourceUpdatedAt,
      sourceLabel: "Work_Hourly · Theatre_Master",
      accountableOwner: ownerName(ownerActorId) || NO_DATA,
      actionStatus: "Detected",
      actionTemplateId: "work-action",
      nextAction: nextAction || NO_DATA,
      alertStatus: NO_DATA,
      alertQueuedAt: NO_DATA,
      laneTarget: { screen: "Work" },
      evidence: blocker ? [blocker] : [NO_DATA],
      rootCauseAnalysis: {
        whys: [blocker || NO_DATA, NO_DATA, NO_DATA, NO_DATA, NO_DATA],
        rootCause: blocker || NO_DATA,
        recommendedSolution: nextAction || NO_DATA,
        evidenceReferences: ["Work_Hourly"],
        review: { status: NO_DATA, reviewedBy: NO_DATA, reviewedAt: NO_DATA },
      },
    }];
  });

  const mismatchInputs: MismatchInput[] = [...constraintInputs, ...workInputs];

  const supplyOptions: SupplyOption[] = [];

  return {
    mismatchInputs,
    supplyOptions,
    rootCause: ops.rootCause ?? [],
    actions: ops.actions ?? [],
    executionQueue: ops.executionQueue ?? [],
  };
}


