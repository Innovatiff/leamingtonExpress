import test from "node:test";
import assert from "node:assert/strict";
import { estimateFare, urgentFeeOf, urgentOn, withFee } from "../src/lib/rideFare.js";

const rates = { showEstimates: true, baseFare: 4.5, perKm: 1.95, minFare: 12, xlMultiplier: 1.35, maxEstimateKm: 120 };

test("ride estimates: a range from the rates, quotes for long trips", () => {
  assert.deepEqual(estimateFare(42, "standard", rates), { low: 78, high: 95 });
  assert.deepEqual(estimateFare(3, "standard", rates), { low: 12, high: 13 }); // minimum fare
  assert.ok(estimateFare(42, "xl", rates).low > 78);
  assert.equal(estimateFare(320, "standard", rates), null); // longer than 120 km: we quote
  assert.equal(estimateFare(42, "standard", { ...rates, showEstimates: false }), null);
});

test("urgent rides: $5 unless the settings change it, nothing when they're off", () => {
  assert.equal(urgentOn({}), true);
  assert.equal(urgentFeeOf({}), 5);
  assert.equal(urgentFeeOf({ urgentFee: 8 }), 8);
  assert.equal(urgentFeeOf({ urgentFee: "7" }), 7);
  assert.equal(urgentFeeOf({ urgentFee: -3 }), 0);
  assert.equal(urgentOn({ urgentEnabled: false }), false);
  assert.equal(urgentFeeOf({ urgentEnabled: false, urgentFee: 5 }), 0);
});

test("the urgent fee is added to both ends of the estimate", () => {
  assert.deepEqual(withFee({ low: 78, high: 95 }, 5), { low: 83, high: 100 });
  assert.deepEqual(withFee({ low: 78, high: 95 }, 0), { low: 78, high: 95 });
  assert.equal(withFee(null, 5), null); // quotes stay quotes
});
