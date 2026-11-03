// The admin dashboard's date range: "today" or the last N days, the period it is
// compared with, and the chart's columns (one per hour for today, one per day
// otherwise). Plain functions on local time, no imports, so tests can use them.

const DAY = 86400000;

function midnight(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * range 1 → today so far, compared with yesterday up to the same time of day.
 * range N → the last N days (today included), compared with the N days before.
 * Calendar arithmetic, so days with a clock change (DST) still start at midnight.
 */
export function dashboardPeriod(range, now = Date.now()) {
  const days = Math.max(1, Math.round(Number(range) || 1));
  const today = days === 1;

  const start = midnight(now);
  start.setDate(start.getDate() - (days - 1));
  const end = midnight(now);
  end.setDate(end.getDate() + 1); // tomorrow at midnight
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);

  let prevTo = start.getTime();
  if (today) {
    const sameTimeYesterday = new Date(now);
    sameTimeYesterday.setDate(sameTimeYesterday.getDate() - 1);
    prevTo = sameTimeYesterday.getTime();
  }

  const columns = today
    ? Array.from({ length: 24 }, (_, h) => {
        const d = new Date(start);
        d.setHours(h);
        return d;
      })
    : Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });

  const from = start.getTime();
  const to = end.getTime();

  return {
    days,
    today,
    from,
    to,
    prevFrom: prevStart.getTime(),
    prevTo,
    unit: today ? "hour" : "day",
    columns,
    label: today ? "today" : `last ${days} days`,
    vsLabel: today ? "vs yesterday at this time" : `vs previous ${days} days`,
    /** Which column a time belongs to, or -1 outside the period. */
    columnOf(t) {
      if (!(t >= from && t < to)) return -1;
      if (today) return new Date(t).getHours();
      return Math.round((midnight(t).getTime() - from) / DAY);
    },
  };
}
