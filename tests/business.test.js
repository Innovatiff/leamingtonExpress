import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUSINESS, businessInputs, businessMonth, driverCostPerMonth, loanPayment, ridesMonth, storeMonth } from "../src/lib/business.js";

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test("loan payments", () => {
  near(loanPayment(35000, 8, 5), 709.7, 0.5);
  assert.equal(loanPayment(12000, 0, 1), 1000);
  assert.equal(loanPayment(0, 8, 5), 0);
  assert.equal(loanPayment(-5, 8, 5), 0);
});

test("saved inputs: numbers, defaults and the driver choice", () => {
  const x = businessInputs({ rides: { insurancePerMonth: "950", ridesPerMonth: "", driver: "boss" }, store: { adsPerMonth: -20 } });
  assert.equal(x.rides.insurancePerMonth, 950);
  assert.equal(x.rides.ridesPerMonth, DEFAULT_BUSINESS.rides.ridesPerMonth);
  assert.equal(x.rides.driver, "owner");
  assert.equal(x.store.adsPerMonth, 0);
  assert.equal(businessInputs({ rides: { driver: "hired" } }).rides.driver, "hired");
});

test("rides: the owner drives — about $13 a ride over $1,730 of monthly costs", () => {
  const r = ridesMonth(DEFAULT_BUSINESS.rides, 13);
  near(r.perRide.fare, 18 / 1.13, 0.01);
  near(r.perRide.margin, 12.96, 0.05);
  near(r.fixed, 1730, 1);
  assert.equal(r.driver, 0);
  near(r.profit, 300 * r.perRide.margin - r.fixed, 0.01);
  assert.equal(r.breakEven, Math.ceil(r.fixed / r.perRide.margin));
  // twice the rides, twice the margin
  const busy = ridesMonth(DEFAULT_BUSINESS.rides, 13, { ridesPerMonth: 600 });
  near(busy.profit - r.profit, 300 * r.perRide.margin, 0.01);
});

test("rides: an employee driver and hours sold to businesses", () => {
  const hired = { ...DEFAULT_BUSINESS.rides, driver: "hired" };
  near(driverCostPerMonth(hired), 44 * (52 / 12) * 17.95 * 1.15, 0.01);
  const r = ridesMonth(hired, 13);
  assert.ok(r.profit < 0, "300 rides don't pay a full-time employee");
  assert.ok(r.breakEven > 400);
  // contract hours lower the rides needed
  const withContracts = ridesMonth({ ...hired, contractHours: 120 }, 13);
  assert.ok(withContracts.breakEven < r.breakEven);
  assert.ok(withContracts.contractRevenue === 120 * 55);
});

test("store: markup on the supplier's price, the delivery fee and returns", () => {
  const s = storeMonth(DEFAULT_BUSINESS.store, 13);
  const goods = 175 / 1.13;
  near(s.perOrder.grossProfit, goods * (20 / 120), 0.01);
  near(s.perOrder.fee, 5 / 1.13, 0.01);
  near(s.perOrder.margin, goods / 6 + 5 / 1.13 - 2 - goods * 0.02, 0.01);
  near(s.profit, 80 * s.perOrder.margin - 417, 0.01);
  assert.equal(s.breakEven, Math.ceil(417 / s.perOrder.margin));
  assert.equal(storeMonth({ ...DEFAULT_BUSINESS.store, markupPct: 0, deliveryFee: 0, deliveryCost: 5 }, 13).breakEven, null);
});

test("the whole month adds both up", () => {
  const m = businessMonth({});
  near(m.profit, m.rides.profit + m.store.profit, 0.001);
  const more = businessMonth({}, { rides: { ridesPerMonth: 450 }, store: { ordersPerMonth: 150 } });
  assert.ok(more.profit > m.profit);
});
