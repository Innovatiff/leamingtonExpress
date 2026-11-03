// The dashboard works on Ontario time; clocks went back on Nov 1, 2026.
process.env.TZ = "America/Toronto";

import test from "node:test";
import assert from "node:assert/strict";
import { dashboardPeriod } from "../src/lib/period.js";

const HOUR = 3600000;
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test("today: since midnight, by hour, compared with yesterday up to the same time", () => {
  const now = at(2026, 11, 3, 15, 30);
  const p = dashboardPeriod(1, now);
  assert.equal(p.today, true);
  assert.equal(p.unit, "hour");
  assert.equal(p.label, "today");
  assert.equal(p.vsLabel, "vs yesterday at this time");
  assert.equal(p.from, at(2026, 11, 3));
  assert.equal(p.to, at(2026, 11, 4));
  assert.equal(p.prevFrom, at(2026, 11, 2));
  assert.equal(p.prevTo, at(2026, 11, 2, 15, 30));
  assert.equal(p.columns.length, 24);
  assert.equal(p.columnOf(at(2026, 11, 3, 0, 5)), 0);
  assert.equal(p.columnOf(at(2026, 11, 3, 9, 15)), 9);
  assert.equal(p.columnOf(at(2026, 11, 3, 23, 59)), 23);
  assert.equal(p.columnOf(at(2026, 11, 2, 23, 59)), -1);
  assert.equal(p.columnOf(at(2026, 11, 4)), -1);
});

test("today on the day the clocks go back (25 hours)", () => {
  const p = dashboardPeriod(1, at(2026, 11, 1, 18));
  assert.equal(p.to - p.from, 25 * HOUR);
  assert.equal(p.prevTo, at(2026, 10, 31, 18));
  assert.equal(p.columnOf(at(2026, 11, 1, 1, 30)), 1);
  assert.equal(p.columnOf(at(2026, 11, 1, 1, 30) + HOUR), 1, "the repeated 1 a.m. hour joins the same column");
  assert.equal(p.columnOf(at(2026, 11, 1, 23, 30)), 23);
});

test("last 7 days: today and the 6 days before, compared with the 7 days before that", () => {
  const now = at(2026, 11, 3, 15, 30);
  const p = dashboardPeriod(7, now);
  assert.equal(p.today, false);
  assert.equal(p.unit, "day");
  assert.equal(p.label, "last 7 days");
  assert.equal(p.vsLabel, "vs previous 7 days");
  assert.equal(p.from, at(2026, 10, 28));
  assert.equal(p.prevFrom, at(2026, 10, 21));
  assert.equal(p.prevTo, p.from);
  assert.deepEqual(
    p.columns.map((d) => d.getDate()),
    [28, 29, 30, 31, 1, 2, 3],
  );
  assert.ok(
    p.columns.every((d) => d.getHours() === 0),
    "every column starts at midnight, even after the clock change",
  );
  // late on Nov 1 (a 25-hour day) still counts for Nov 1
  assert.equal(p.columnOf(at(2026, 11, 1, 23, 30)), 4);
  assert.equal(p.columnOf(at(2026, 11, 2, 0, 30)), 5);
  assert.equal(p.columnOf(now), 6);
  assert.equal(p.columnOf(at(2026, 10, 27, 23, 59)), -1);
});

test("30 and 90 days", () => {
  const now = at(2026, 11, 3, 8);
  const month = dashboardPeriod(30, now);
  assert.equal(month.columns.length, 30);
  assert.equal(month.from, at(2026, 10, 5));
  assert.equal(month.prevFrom, at(2026, 9, 5));
  assert.equal(month.columnOf(now), 29);
  const quarter = dashboardPeriod(90, now);
  assert.equal(quarter.columns.length, 90);
  assert.equal(quarter.from, at(2026, 8, 6));
  assert.equal(quarter.columnOf(at(2026, 8, 6, 12)), 0);
});
