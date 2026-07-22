import { getSheet, batchGet } from "./googleSheets";

export async function getDashboardData() {
  const sourceRegistry = await getSheet("Source_Registry!A:Z");

  console.log(
    "SOURCE_REGISTRY",
    Array.isArray(sourceRegistry),
    sourceRegistry.length,
    sourceRegistry[0]
  );

  return {
    sourceRegistry,
  };
}

/**
 * Adapter layer
 */
export async function buildOpsData() {
  const data = await getDashboardData();

  return {
    meta: {},
    monthlyCMTarget: 0,
    monthEndProjection: 0,
    askRateMultiple: 0,
    spine: [],
    constraints: [],
    history: [],
    previousBlock: {},
    _raw: data,
  };
}

