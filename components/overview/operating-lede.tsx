import { contentValue } from "@/lib/dashboard-content";

function interpolate(template: string, values: Record<string, string | number | undefined>) {
  return template.replace(/\{([\w]+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

export function OperatingLede({ liveOpsData }: { liveOpsData: any }) {
  // The overview freshness indicator remains global, while this financial
  // lede follows Finance_Daily's business date for its pace calculation.
  const meta = liveOpsData?.cmReportingPeriod ?? liveOpsData?.meta ?? {};
  const projection = Number(liveOpsData?.monthEndProjection ?? 0).toLocaleString("en-IN");
  const hasSourcePeriod = Boolean(meta.snapshotAt);
  const content = liveOpsData?.dashboardContent;
  const values = {
    projection,
    daysLeft: meta.daysLeft,
    day: meta.day,
    daysInMonth: meta.daysInMonth,
    updatedAt: meta.updatedAt,
    block: meta.block,
  };

  const kicker = interpolate(
    contentValue(content, "Overview", "reporting_lede", "kicker", "WHERE WE ARE NOW · {block}"),
    values,
  );
  const headline = interpolate(
    contentValue(
      content,
      "Overview",
      "reporting_lede",
      hasSourcePeriod ? "headline_template" : "headline_without_period_template",
      hasSourcePeriod
        ? "{projection} projected CM by month end. {daysLeft} days remain."
        : "{projection} projected CM by month end. Source reporting period is pending.",
    ),
    values,
  );
  const periodText = interpolate(
    contentValue(
      content,
      "Overview",
      "reporting_lede",
      hasSourcePeriod ? "period_template" : "period_pending_text",
      hasSourcePeriod ? "This month · day {day} of {daysInMonth}" : "Source reporting period pending",
    ),
    values,
  );
  const snapshotText = interpolate(
    contentValue(
      content,
      "Overview",
      "reporting_lede",
      hasSourcePeriod ? "snapshot_template" : "snapshot_pending_text",
      hasSourcePeriod ? "Google Sheet snapshot · {updatedAt}" : "Google Sheet timestamp required",
    ),
    values,
  );

  return (
    <section className="operating-lede" aria-labelledby="operating-lede-title">
      <div>
        <p className="story-kicker">{kicker}</p>
        <h2 id="operating-lede-title">{headline}</h2>
      </div>
      <p className="lede-context">
        {periodText}
        <br />
        <span>{snapshotText}</span>
      </p>
    </section>
  );
}
