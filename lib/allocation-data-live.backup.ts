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

      return {
        id: item.id,
        domain: item.lane || "Unknown",
        mismatchType: "shortfall",

        theatre: item.where || "Unknown",
        where: item.where || "",
        label: item.title,

        joinKey: {
          theatreId: item.where || "",
        },

        demandQty: 0,
        supplyQty: 0,
        gapQty: 0,
        gapUnit: "",

        ageHours: 0,
        thresholdHours: 0,
        deadlineAt: "",

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

        actionStatus:
          action?.status ||
          "Detected",

        actionTemplateId: "constraint",

        nextAction:
          action?.action ||
          item.next ||
          "Review and resolve constraint",

        laneTarget: {
          screen: item.lane || "Overview",
        },

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