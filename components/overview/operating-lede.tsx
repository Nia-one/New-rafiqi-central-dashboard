
export function OperatingLede({ liveOpsData }: { liveOpsData: any }) {
  return (
    <section className="operating-lede" aria-labelledby="operating-lede-title">
      <div>
        <p className="story-kicker">WHERE WE ARE NOW · {liveOpsData.meta.block}</p>
        <h2 id="operating-lede-title">{`${liveOpsData.monthEndProjection.toLocaleString("en-IN")} projected CM by month end. ${liveOpsData.meta.daysLeft} days remain.`}</h2>
      </div>
      <p className="lede-context">This month · day {liveOpsData.meta.day} of {liveOpsData.meta.daysInMonth}<br /><span>Live operations data</span></p>
    </section>
  )
}

