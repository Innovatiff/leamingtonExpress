import test from "node:test";
import assert from "node:assert/strict";
import { breakEven, DEFAULT_TRAVEL_COSTS, fixedCosts, isServiceLine, nicePrice, perPersonCost, suggestedPrice, travelCostRules, tripEconomics } from "../src/features/travel/lib/costs.js";

const L = (es, en) => ({ es, en });
// A Niagara-style day trip: 380 km each way, admissions and two meals per person
const trip = {
  durationDays: 1,
  nights: 0,
  priceAdult: 359,
  offer: null,
  ops: { distanceKm: 380, localKm: 30, parkingPerDay: 35 },
  breakdown: [
    { kind: "service", label: L("Transporte, guía y organización", "Transport, guide and organization"), amount: 204 },
    { label: L("Crucero", "Boat cruise"), amount: 40 },
    { label: L("Túneles", "Tunnels"), amount: 30 },
    { label: L("Almuerzo", "Lunch"), amount: 45 },
    { label: L("Cena", "Dinner"), amount: 40 },
  ],
};
const rules = travelCostRules({});

test("the rates: defaults, saved values, and nonsense ignored", () => {
  assert.equal(rules.vehicle, "van12");
  assert.equal(rules.vehicles.van12.dailyRate, DEFAULT_TRAVEL_COSTS.vehicles.van12.dailyRate);
  const saved = travelCostRules({ vehicle: "minivan", fuelPrice: "1.6", vehicles: { minivan: { dailyRate: 120, seats: 6 } }, targetMarginPct: -5, planningGroup: "abc" });
  assert.deepEqual([saved.vehicle, saved.fuelPrice, saved.vehicles.minivan.dailyRate, saved.targetMarginPct, saved.planningGroup], ["minivan", 1.6, 120, 25, 9]);
  assert.equal(travelCostRules({ vehicle: "bus" }).vehicle, "van12");
});

test("our line vs. what each traveller costs", () => {
  assert.equal(perPersonCost(trip), 155);
  // older trips without kinds: the transport/guide line is ours
  assert.equal(isServiceLine({ label: L("Transporte ida y vuelta desde Leamington", "Round-trip transport from Leamington") }), true);
  assert.equal(isServiceLine({ label: L("Guía", "Guide") }), true);
  assert.equal(isServiceLine({ label: L("Crucero", "Boat cruise") }), false);
  assert.equal(isServiceLine({ kind: "cost", label: L("Transporte en la isla", "Island transport") }), false);
});

test("the costs of one departure: vehicle, fuel, crew, parking", () => {
  const f = fixedCosts(trip, rules);
  assert.equal(f.km, 790);
  assert.equal(f.parts.vehicle, 250);
  assert.equal(Math.round(f.parts.fuel), Math.round((790 * 15 * 1.45) / 100)); // 171.83
  assert.deepEqual([f.parts.crew, f.parts.crewMeals, f.parts.crewRooms, f.parts.parking], [300, 50, 0, 35]);
  // overnight: the crew's room for each night, the trip's own price when it has one
  const weekend = { ...trip, durationDays: 2, nights: 1, ops: { ...trip.ops, crewRoomPerNight: 260 } };
  assert.equal(fixedCosts(weekend, rules).parts.crewRooms, 260);
  assert.equal(fixedCosts({ ...weekend, ops: trip.ops }, rules).parts.crewRooms, 180);
  // a rental with a km limit charges the extra km
  const limited = travelCostRules({ vehicles: { van12: { kmIncludedPerDay: 300, extraKmRate: 0.25 } } });
  assert.equal(fixedCosts(trip, limited).parts.vehicle, 250 + (790 - 300) * 0.25);
});

test("profit for a departure, and how many travellers it takes", () => {
  const e = tripEconomics(trip, rules, { travellers: 9 });
  assert.equal(e.revenue, 359 * 9);
  assert.equal(e.variable, 155 * 9);
  assert.ok(Math.abs(e.profit - (e.revenue - e.cost)) < 0.01);
  assert.ok(e.marginPct > 20 && e.marginPct < 30, String(e.marginPct));
  assert.equal(e.overCapacity, false);
  assert.equal(tripEconomics(trip, rules, { travellers: 12 }).overCapacity, true);
  // the offer lowers what each traveller pays
  assert.equal(tripEconomics({ ...trip, offer: { pct: 10 } }, rules, { travellers: 9 }).price, Math.round(359 * 0.9));
  const be = breakEven(trip, rules);
  assert.ok(tripEconomics(trip, rules, { travellers: be }).profit >= 0);
  assert.ok(tripEconomics(trip, rules, { travellers: be - 1 }).profit < 0);
  assert.equal(breakEven({ ...trip, priceAdult: 100 }, rules), null); // never covers its own costs
});

test("suggested prices leave the target margin and end in 9", () => {
  assert.deepEqual([nicePrice(350), nicePrice(359), nicePrice(360.2), nicePrice(3)], [359, 359, 369, 9]);
  const p = suggestedPrice(trip, rules, { travellers: 9, marginPct: 25 });
  assert.equal(p % 10, 9);
  assert.ok(tripEconomics(trip, rules, { travellers: 9, price: p }).marginPct >= 25);
  assert.ok(tripEconomics(trip, rules, { travellers: 9, price: p - 10 }).marginPct < 25);
  // with an offer, the price before the offer is higher so the paid price still works
  const withOffer = suggestedPrice({ ...trip, offer: { pct: 10 } }, rules, { travellers: 9, marginPct: 25 });
  assert.ok(withOffer > p);
  assert.equal(suggestedPrice(trip, rules, { marginPct: 95 }), null);
});

test("lines with kinds: only the service line is ours, whatever the names", () => {
  const lines = [
    { kind: "service", label: L("Transporte, guía y organización", "Transport, guide and organization"), amount: 100 },
    { label: L("Museo Motown (visita guiada)", "Motown Museum guided tour"), amount: 35 },
  ];
  assert.equal(isServiceLine(lines[1], lines), false);
  assert.equal(perPersonCost({ breakdown: lines }), 35);
});
