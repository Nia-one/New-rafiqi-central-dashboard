import { buildOpsData } from "./opsDataMapper";
import type { MismatchInput } from "./allocation-types";
import type { SupplyOption } from "./allocation-data";

export type LiveAllocationData = {
  mismatchInputs: MismatchInput[];
  supplyOptions: SupplyOption[];
  rootCause: any[];
  actions: any[];
  executionQueue: any[];
};

export async function buildAllocationData(): Promise<LiveAllocationData> {
  const ops = await buildOpsData();

  const mismatchInputs: MismatchInput[] = (ops.constraints ?? []).map(
    (item: any) => {

      const root = (ops.rootCause ?? []).find(
        (r: any) => r.constraintId === item.id
      );

      const action = (ops.actions ?? []).find(
        (a: any) => a.constraintId === item.id
      );

      const lane = item.lane || "Unknown"
      const actionTemplateId = lane === "FONO" ? "fono-idle" : lane === "Shram Park" ? "sram-shortfall" : lane === "Essentials" ? "ess-stockout" : "constraint"
      const actionStatus = action?.status === "Open" ? "Detected" : (action?.status || "Detected")
      const gapQty = Number(item.idleUnits || 0)
      return {
        id: item.id,
        domain: item.lane || "Unknown",
        mismatchType: lane === "FONO" ? "idle-capacity" : "shortfall",

        theatre: item.where || "Unknown",
        where: item.where || "",
        label: item.title,

        joinKey: lane === "Shram Park" ? { theatreId: item.where || "", factoryId: item.where || "" } : { theatreId: item.where || "", studioId: item.where || "" },

        demandQty: gapQty,
        supplyQty: 0,
        gapQty,
        gapUnit: "Nests",

        ageHours: Number(item.ageHours || 0),
        thresholdHours: Number(item.thresholdHours || item.riskHours || 24),
        deadlineAt: item.deadlineAt || action?.dueDate || "Not scheduled",

        forwardCmAtRisk24h:
          item.idleUnits && item.cmPerUnit
            ? Math.round(
                item.idleUnits *
                item.cmPerUnit *
                ((item.riskHours || 24) / 24)
              )
            : 0,

        recoverableShare: 1,
        confidence: "Medium",
        attentionBucket: "Unassigned",

        sourceUpdatedAt: ops.meta.updatedAt,
        sourceLabel: "Google Sheet constraints",

        accountableOwner:
          action?.owner ||
          root?.owner ||
          item.owner ||
          "",

        actionStatus,

        actionTemplateId,

        nextAction:
          action?.action ||
          item.next ||
          "Review and resolve constraint",

        laneTarget:
  item.lane === "FONO"
    ? { screen: "Living", subsection: "fono" }
    : item.lane === "Essentials"
    ? { screen: "Essentials" }
    : (item.lane === "Supply" || item.lane === "Shram Park")
    ? { screen: "Living", subsection: "supply" }
    : { screen: "Overview" },

        evidence: [
          item.detail ||
          "Live constraint from Google Sheet",
        ],

        rootCauseAnalysis: {
          whys: [
            root?.evidence ||
            item.detail ||
            "Constraint identified from live data",
            "Additional evidence review required",
            "Operational impact assessment pending",
            "Owner validation pending",
            "Resolution tracking pending",
          ],

          rootCause:
            root?.rootCause ||
            item.title ||
            "Operational constraint",

          recommendedSolution:
            action?.action ||
            item.next ||
            "Review and resolve constraint",

          evidenceReferences: [
            "Google Sheet constraints",
          ],

          review: {
            status: "Evidence-backed authored",
            reviewedBy: "system",
            reviewedAt: new Date().toISOString(),
          },
        },
      };
    }
  );

  const supplyOptions: SupplyOption[] = [];

  return {
    mismatchInputs,
    supplyOptions,
    rootCause: ops.rootCause ?? [],
    actions: ops.actions ?? [],
    executionQueue: ops.executionQueue ?? [],
  };
}


