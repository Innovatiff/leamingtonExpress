// What a trip costs us and what it leaves, so prices cover renting the vehicle.
//
// Costs per departure (whatever the group size): the rented vehicle for each
// day, its fuel, the driver-guide's pay, meals and hotel room, parking, tolls
// and ferries. Costs per traveller: the trip's price-breakdown lines except
// the "transport, guide and organization" line (admissions, meals, the hotel
// share...). On top: card fees and a safety margin, as a % of the price.
//
// The rates live in Admin → Settings (pricing document, field "travel"); each
// trip has its own distances and fees in `ops`. Plain functions, no React, so
// tests and scripts can use them.

export const VEHICLES = {
  minivan: { label: "Minivan (7 seats)", seats: 6, dailyRate: 135, litresPer100: 11, kmIncludedPerDay: 0, extraKmRate: 0 },
  van12: { label: "12-passenger van", seats: 10, dailyRate: 250, litresPer100: 15, kmIncludedPerDay: 0, extraKmRate: 0 },
};

export const DEFAULT_TRAVEL_COSTS = {
  vehicle: "van12", // what the trips normally use
  vehicles: VEHICLES,
  fuelPrice: 1.45, // $ per litre
  crewPerDay: 300, // the driver-guide's pay per day
  crewMealsPerDay: 50,
  crewRoomPerNight: 180, // when the trip has no hotel price of its own
  cardFeePct: 2.5, // card payments (e-Transfer and cash have none)
  contingencyPct: 5, // tips for drivers' parking, a late night, price changes…
  targetMarginPct: 25, // profit left from the price
  planningGroup: 9, // travellers the prices are worked out for
};

const num = (v, fallback, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
};

/** The saved rates with the defaults filled in (and nonsense values ignored). */
export function travelCostRules(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const vehicles = {};
  for (const [key, d] of Object.entries(VEHICLES)) {
    const v = s.vehicles?.[key] || {};
    vehicles[key] = {
      label: d.label,
      seats: Math.max(1, Math.round(num(v.seats, d.seats, 60))),
      dailyRate: num(v.dailyRate, d.dailyRate),
      litresPer100: num(v.litresPer100, d.litresPer100, 60),
      kmIncludedPerDay: num(v.kmIncludedPerDay, d.kmIncludedPerDay),
      extraKmRate: num(v.extraKmRate, d.extraKmRate, 10),
    };
  }
  const d = DEFAULT_TRAVEL_COSTS;
  return {
    vehicle: VEHICLES[s.vehicle] ? s.vehicle : d.vehicle,
    vehicles,
    fuelPrice: num(s.fuelPrice, d.fuelPrice, 10),
    crewPerDay: num(s.crewPerDay, d.crewPerDay),
    crewMealsPerDay: num(s.crewMealsPerDay, d.crewMealsPerDay),
    crewRoomPerNight: num(s.crewRoomPerNight, d.crewRoomPerNight),
    cardFeePct: num(s.cardFeePct, d.cardFeePct, 20),
    contingencyPct: num(s.contingencyPct, d.contingencyPct, 50),
    targetMarginPct: num(s.targetMarginPct, d.targetMarginPct, 80),
    planningGroup: Math.max(1, Math.round(num(s.planningGroup, d.planningGroup, 60))),
  };
}

const SERVICE_RE = /transport|gu[ií]a|guide|coordina|organiza/i;

/**
 * Is this price line ours (transport, guide, organization)? Trips mark it with
 * kind "service"; in older trips without kinds it's the line named like that.
 */
export function isServiceLine(b, lines) {
  if (b?.kind) return b.kind === "service";
  if (lines?.some((x) => x?.kind)) return false;
  return SERVICE_RE.test(`${b?.label?.en || ""} ${b?.label?.es || ""}`);
}

/** What each traveller costs us: every price-breakdown line except ours. */
export const perPersonCost = (trip) => (trip?.breakdown || []).filter((b, _, all) => !isServiceLine(b, all)).reduce((s, b) => s + (Number(b.amount) || 0), 0);

/** A trip's own distances and fees (all optional). */
export function tripOps(trip) {
  const o = trip?.ops || {};
  const n = (v) => Math.max(0, Number(v) || 0);
  return {
    vehicle: VEHICLES[o.vehicle] ? o.vehicle : "",
    distanceKm: n(o.distanceKm ?? trip?.distanceKm), // one way from Leamington
    localKm: n(o.localKm),
    parkingPerDay: n(o.parkingPerDay),
    tolls: n(o.tolls), // the whole trip
    ferryVehicle: n(o.ferryVehicle), // the whole trip
    crewRoomPerNight: n(o.crewRoomPerNight),
    otherFixed: n(o.otherFixed), // anything else per departure
  };
}

/** The cost of one departure that doesn't depend on how many travel. */
export function fixedCosts(trip, rules) {
  const ops = tripOps(trip);
  const vehicle = rules.vehicles[ops.vehicle || rules.vehicle];
  const days = Math.max(1, Number(trip?.durationDays) || 1);
  const nights = Math.max(0, Number(trip?.nights) || 0);
  const km = ops.distanceKm * 2 + ops.localKm;
  const extraKm = vehicle.kmIncludedPerDay > 0 ? Math.max(0, km - vehicle.kmIncludedPerDay * days) : 0;
  const parts = {
    vehicle: vehicle.dailyRate * days + extraKm * vehicle.extraKmRate,
    fuel: (km * vehicle.litresPer100 * rules.fuelPrice) / 100,
    crew: rules.crewPerDay * days,
    crewMeals: rules.crewMealsPerDay * days,
    crewRooms: nights * (ops.crewRoomPerNight || rules.crewRoomPerNight),
    parking: ops.parkingPerDay * days,
    tollsAndFerries: ops.tolls + ops.ferryVehicle,
    other: ops.otherFixed,
  };
  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { parts, total, km, seats: vehicle.seats, vehicle };
}

const round = (v) => Math.round(v * 100) / 100;

/**
 * Money for one departure with `travellers` adults paying `price` each (the
 * trip's price after its offer, unless given): revenue, costs, profit.
 */
export function tripEconomics(trip, rules, { travellers, price } = {}) {
  const n = Math.max(1, Math.round(Number(travellers) || rules.planningGroup));
  const unit = price != null ? Number(price) : Math.round((Number(trip?.priceAdult) || 0) * (1 - (Number(trip?.offer?.pct) || 0) / 100));
  const fixed = fixedCosts(trip, rules);
  const revenue = unit * n;
  const perPerson = perPersonCost(trip);
  const variable = perPerson * n;
  const fees = (revenue * rules.cardFeePct) / 100;
  const contingency = (revenue * rules.contingencyPct) / 100;
  const cost = fixed.total + variable + fees + contingency;
  const profit = revenue - cost;
  return {
    travellers: n,
    price: unit,
    revenue: round(revenue),
    fixed: round(fixed.total),
    fixedParts: Object.fromEntries(Object.entries(fixed.parts).map(([k, v]) => [k, round(v)])),
    perPerson: round(perPerson),
    variable: round(variable),
    fees: round(fees),
    contingency: round(contingency),
    cost: round(cost),
    profit: round(profit),
    marginPct: revenue > 0 ? round((profit / revenue) * 100) : 0,
    seats: fixed.seats,
    overCapacity: n > fixed.seats,
  };
}

/** Prices end in 9 (149, 359, 1,249). */
export const nicePrice = (v) => Math.max(9, Math.ceil((v + 1) / 10) * 10 - 1);

/**
 * The adult price that leaves `marginPct` profit when `travellers` go
 * (before any offer), rounded up to end in 9.
 */
export function suggestedPrice(trip, rules, { travellers, marginPct } = {}) {
  const n = Math.max(1, Math.round(Number(travellers) || rules.planningGroup));
  const margin = Number(marginPct ?? rules.targetMarginPct) || 0;
  const share = 1 - (margin + rules.cardFeePct + rules.contingencyPct) / 100;
  if (share <= 0.05) return null;
  const needed = (perPersonCost(trip) + fixedCosts(trip, rules).total / n) / share;
  const offer = Number(trip?.offer?.pct) || 0;
  return nicePrice(needed / (1 - offer / 100));
}

/** The fewest paying travellers for this departure not to lose money (null if never). */
export function breakEven(trip, rules, price) {
  const unit = price != null ? Number(price) : Math.round((Number(trip?.priceAdult) || 0) * (1 - (Number(trip?.offer?.pct) || 0) / 100));
  const perTraveller = unit * (1 - (rules.cardFeePct + rules.contingencyPct) / 100) - perPersonCost(trip);
  if (perTraveller <= 0) return null;
  return Math.max(1, Math.ceil(fixedCosts(trip, rules).total / perTraveller));
}
