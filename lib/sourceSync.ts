import { syncTeamInputs } from "@/lib/teamInputSync";
import { syncEssentialsBotData } from "@/lib/essentialsBotSync";
import { syncShramParkDemandBotData } from "@/lib/shramParkDemandBotSync";
import { syncVerticalInputs } from "@/lib/verticalInputSync";
import { syncMemberFeedback } from "@/lib/memberFeedbackSync";
import { clearSheetCache } from "@/lib/googleSheets";
import { syncFreshDashboardInputs } from "@/lib/freshDashboardInputSync";
import { syncFonoTrackerData } from "@/lib/fonoTrackerSync";

let activeSync: Promise<SourceSyncReport> | null = null;
let activeLiveSync: Promise<LiveSourceSyncReport> | null = null;
let activeFreshInputSync: Promise<Awaited<ReturnType<typeof syncFreshDashboardInputs>>> | null = null;
let lastSuccessfulSync: SourceSyncReport | null = null;
let lastFailureAt = 0;
let lastFailure: unknown = null;
const SOURCE_SYNC_COOLDOWN_MS = 300_000;

export type SourceSyncReport = {
  report: Awaited<ReturnType<typeof syncTeamInputs>>;
  essentialsReport: Awaited<ReturnType<typeof syncEssentialsBotData>>;
  essentialsSchema: unknown;
  shramParkDemandReport: Awaited<ReturnType<typeof syncShramParkDemandBotData>>;
  shramParkDemandSchema: unknown;
  verticalReport: Awaited<ReturnType<typeof syncVerticalInputs>>;
  memberFeedbackReport: Awaited<ReturnType<typeof syncMemberFeedback>>;
  freshDashboardInputReport: Awaited<ReturnType<typeof syncFreshDashboardInputs>>;
  fonoTrackerReport: Awaited<ReturnType<typeof syncFonoTrackerData>>;
  syncedAt: string;
};

export type LiveSourceSyncReport = {
  essentialsReport: Awaited<ReturnType<typeof syncEssentialsBotData>> | null;
  shramParkDemandReport: Awaited<ReturnType<typeof syncShramParkDemandBotData>> | null;
  fonoTrackerReport: Awaited<ReturnType<typeof syncFonoTrackerData>> | null;
  freshDashboardInputReport: Awaited<ReturnType<typeof syncFreshDashboardInputs>> | null;
  changedRows: number;
  failures: readonly { source: string; error: string }[];
  syncedAt: string;
};

async function runLiveSourceSync(): Promise<LiveSourceSyncReport> {
  // The 45-second hot path moves only the four live operator/bot feeds. The
  // slower governance/history reconciliation remains on the daily full sync.
  // Manual dashboard inputs run first so a failure in an unrelated bot feed
  // cannot prevent UI_Targets (or another UI_* tab) from reaching the backend.
  const failures: { source: string; error: string }[] = [];
  const attempt = async <T,>(source: string, operation: () => Promise<T>) => {
    try {
      return await operation();
    } catch (error) {
      failures.push({ source, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };
  const freshDashboardInputReport = await attempt("fresh-dashboard-inputs", syncFreshDashboardInputs);
  const shramParkDemandReport = await attempt("shram-park-demand", syncShramParkDemandBotData);
  const fonoTrackerReport = await attempt("fono-tracker", syncFonoTrackerData);
  const essentialsReport = await attempt("essentials", syncEssentialsBotData);
  clearSheetCache();
  const reports = [freshDashboardInputReport, shramParkDemandReport, fonoTrackerReport, essentialsReport];
  if (reports.every((report) => report === null)) throw new AggregateError(failures.map((failure) => new Error(`${failure.source}: ${failure.error}`)), "Every live source sync failed");
  const changedRows = reports.reduce((sum, report) => sum + (report && typeof report === "object" && "changedRows" in report ? Number(report.changedRows) || 0 : 0), 0);
  return { essentialsReport, shramParkDemandReport, fonoTrackerReport, freshDashboardInputReport, changedRows, failures, syncedAt: new Date().toISOString() };
}

export function syncLiveSources() {
  if (activeLiveSync) return activeLiveSync;
  activeLiveSync = runLiveSourceSync().finally(() => { activeLiveSync = null; });
  return activeLiveSync;
}

export function syncFreshInputs() {
  if (activeFreshInputSync) return activeFreshInputSync;
  activeFreshInputSync = syncFreshDashboardInputs()
    .then((report) => { clearSheetCache(); return report; })
    .finally(() => { activeFreshInputSync = null; });
  return activeFreshInputSync;
}

async function runSourceSync(): Promise<SourceSyncReport> {
  // Google Sheets applies a strict per-user read quota. Run the governed
  // connectors sequentially so their internal batch reads do not create one
  // large burst on a serverless cold start.
  const report = await syncTeamInputs();
  const essentialsReport = await syncEssentialsBotData();
  const shramParkDemandReport = await syncShramParkDemandBotData();
  const memberFeedbackReport = await syncMemberFeedback();
  const verticalReport = await syncVerticalInputs();
  const fonoTrackerReport = await syncFonoTrackerData();
  const freshDashboardInputReport = await syncFreshDashboardInputs();
  // Schemas are provisioned separately; live refresh only moves data. Keeping
  // schema discovery out of this hot path saves dozens of quota-bearing reads.
  const essentialsSchema: unknown = { provisioned: true };
  const shramParkDemandSchema: unknown = { provisioned: true };
  clearSheetCache();
  return { report, essentialsReport, essentialsSchema, shramParkDemandReport, shramParkDemandSchema, verticalReport, memberFeedbackReport, fonoTrackerReport, freshDashboardInputReport, syncedAt: new Date().toISOString() };
}

export function syncAllSources(options: { force?: boolean } = {}) {
  if (activeSync) return activeSync;
  if (!options.force && lastSuccessfulSync && Date.now() - Date.parse(lastSuccessfulSync.syncedAt) < SOURCE_SYNC_COOLDOWN_MS) {
    return Promise.resolve(lastSuccessfulSync);
  }
  if (!options.force && lastFailureAt && Date.now() - lastFailureAt < SOURCE_SYNC_COOLDOWN_MS) {
    return lastSuccessfulSync ? Promise.resolve(lastSuccessfulSync) : Promise.reject(lastFailure);
  }
  activeSync = runSourceSync()
    .then((report) => { lastSuccessfulSync = report; lastFailureAt = 0; lastFailure = null; return report; })
    .catch((error) => { lastFailureAt = Date.now(); lastFailure = error; throw error; })
    .finally(() => { activeSync = null; });
  return activeSync;
}
