// Departure dates from a trip's schedule. No imports, so tests can use it.

const DAY_MS = 86400000;

/**
 * Next departure dates from the trip's schedule.
 * schedule = { weekdays: [0-6], months: [1-12], weeks: [1-5] (nth weekday of the month), dates: ["YYYY-MM-DD"], blackout: [...] }
 */
export function upcomingDepartures(trip, { count = 8, leadDays = 2, horizonDays = 430, from = new Date() } = {}) {
  const s = trip.schedule || {};
  const out = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + leadDays);
  const explicit = Array.isArray(s.dates) ? s.dates.filter(Boolean) : [];
  const blackout = new Set(Array.isArray(s.blackout) ? s.blackout : []);
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (explicit.length) {
    for (const iso of [...explicit].sort()) {
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (date >= start && !blackout.has(iso)) out.push(date);
      if (out.length >= count) break;
    }
    return out;
  }

  const weekdays = Array.isArray(s.weekdays) && s.weekdays.length ? s.weekdays : [6];
  const months = Array.isArray(s.months) && s.months.length ? s.months : null;
  const weeks = Array.isArray(s.weeks) && s.weeks.length ? s.weeks : null;
  for (let i = 0; i < horizonDays && out.length < count; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (!weekdays.includes(date.getDay())) continue;
    if (months && !months.includes(date.getMonth() + 1)) continue;
    if (weeks && !weeks.includes(Math.ceil(date.getDate() / 7))) continue;
    if (blackout.has(key(date))) continue;
    out.push(date);
  }
  return out;
}
