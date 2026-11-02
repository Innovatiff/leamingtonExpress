// What the ride service (one vehicle) and the store leave each month after
// expenses — Admin → Profit calculator. Plain functions, no imports, so tests
// can use them.
//
// Customers pay prices with HST included. Everything here is worked out BEFORE
// HST: the HST collected belongs to the government, and the HST paid on fuel
// and parts comes back as input tax credits. Income tax is not included.

export const DEFAULT_BUSINESS = {
  hstPct: 13,
  rides: {
    vehiclePrice: 35000, // an 8-seat minivan
    downPayment: 0,
    loanRatePct: 8,
    loanYears: 5,
    insurancePerMonth: 800, // a guess until the broker's quote (paying passengers: OPCF 6A)
    otherPerMonth: 220, // phone and data, car washes, supplies, bookkeeping
    fuelPrice: 1.45, // $ per litre, with tax
    litresPer100: 7.5, // hybrid minivan, real-world
    upkeepPerKm: 0.07, // maintenance and tires
    kmPerRide: 17, // average, counting the drive to the pick-up and empty returns
    ridesPerMonth: 300,
    avgFare: 18, // what the customer pays, with tax
    cardSharePct: 30, // rides paid by card
    cardFeePct: 2.7,
    driver: "owner", // "owner" (you drive) | "hired" (an employee)
    driverHoursPerWeek: 44, // overtime starts after 44 h in Ontario
    driverWage: 17.95, // Ontario minimum wage since Oct 1, 2026
    employerExtrasPct: 15, // 4% vacation pay, CPP, EI and WSIB on top of the wage
    contractHours: 0, // hours booked by businesses (e.g. farms moving their workers)
    contractRate: 55, // $ per hour, before tax
    contractKmPerHour: 35,
  },
  store: {
    ordersPerMonth: 80,
    avgOrder: 180, // what the customer pays, with tax and the delivery fee
    markupPct: 20, // added to the supplier's price (Admin → Products → Pricing)
    deliveryFee: 5,
    deliveryCost: 2, // fuel and wear per order when the ride car delivers between rides
    returnsPct: 2, // of product sales lost to returns and damage
    toolsPerMonth: 117, // BlueCart plan, hosting, domain
    adsPerMonth: 300,
  },
};

export const WEEKS_PER_MONTH = 52 / 12;

const num = (v, fallback, max = 1e7) => {
  const n = v === "" || v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback;
};

/** Saved calculator inputs with the defaults filled in, as numbers. */
export function businessInputs(saved) {
  const s = saved || {};
  const pick = (group) =>
    Object.fromEntries(
      Object.entries(DEFAULT_BUSINESS[group]).map(([k, d]) => [k, typeof d === "number" ? num(s[group]?.[k], d) : s[group]?.[k] ?? d]),
    );
  const rides = pick("rides");
  rides.driver = rides.driver === "hired" ? "hired" : "owner";
  return { hstPct: num(s.hstPct, DEFAULT_BUSINESS.hstPct, 30), rides, store: pick("store") };
}

/** Monthly payment of a loan (0% → the principal split evenly). */
export function loanPayment(principal, ratePct, years) {
  const n = Math.round((Number(years) || 0) * 12);
  const p = Number(principal) || 0;
  if (p <= 0 || n <= 0) return 0;
  const r = (Number(ratePct) || 0) / 100 / 12;
  return r > 0 ? (p * r) / (1 - (1 + r) ** -n) : p / n;
}

/** Monthly cost of an employee driver: wage × hours plus the employer's extras. */
export const driverCostPerMonth = (x) => x.driverHoursPerWeek * WEEKS_PER_MONTH * x.driverWage * (1 + x.employerExtrasPct / 100);

/** One vehicle's month. `overrides` changes inputs (e.g. another number of rides). */
export function ridesMonth(input, hstPct = 13, overrides = {}) {
  const x = { ...input, ...overrides };
  const tax = 1 + hstPct / 100;
  const perKm = (x.litresPer100 / 100) * (x.fuelPrice / tax) + x.upkeepPerKm;
  const perRide = {
    fare: x.avgFare / tax,
    running: x.kmPerRide * perKm, // fuel and upkeep
    card: (x.cardSharePct / 100) * (x.cardFeePct / 100) * x.avgFare, // charged on the full amount
  };
  perRide.margin = perRide.fare - perRide.running - perRide.card;

  const vehicle = loanPayment(x.vehiclePrice - x.downPayment, x.loanRatePct, x.loanYears);
  const fixed = vehicle + x.insurancePerMonth + x.otherPerMonth;
  const driver = x.driver === "hired" ? driverCostPerMonth(x) : 0;

  const rideRevenue = x.ridesPerMonth * perRide.fare;
  const contractRevenue = x.contractHours * x.contractRate;
  const contractRunning = x.contractHours * x.contractKmPerHour * perKm;
  const running = x.ridesPerMonth * perRide.running + contractRunning;
  const cardFees = x.ridesPerMonth * perRide.card;
  const profit = rideRevenue + contractRevenue - running - cardFees - fixed - driver;

  // rides a month needed to cover the costs the contracts don't
  const toCover = fixed + driver - (contractRevenue - contractRunning);
  const breakEven = perRide.margin > 0 ? Math.max(0, Math.ceil(toCover / perRide.margin)) : null;
  return { revenue: rideRevenue + contractRevenue, rideRevenue, contractRevenue, running, cardFees, vehicle, insurance: x.insurancePerMonth, other: x.otherPerMonth, fixed, driver, profit, perRide, breakEven };
}

/** The store's month. */
export function storeMonth(input, hstPct = 13, overrides = {}) {
  const x = { ...input, ...overrides };
  const tax = 1 + hstPct / 100;
  const goods = Math.max(0, x.avgOrder - x.deliveryFee) / tax; // products, before HST
  const perOrder = {
    sales: x.avgOrder / tax,
    // a markup on the supplier's price is markup / (100 + markup) of our price
    grossProfit: goods * (x.markupPct / (100 + x.markupPct)),
    fee: x.deliveryFee / tax,
    delivery: x.deliveryCost,
    returns: goods * (x.returnsPct / 100),
  };
  perOrder.margin = perOrder.grossProfit + perOrder.fee - perOrder.delivery - perOrder.returns;
  const n = x.ordersPerMonth;
  const fixed = x.toolsPerMonth + x.adsPerMonth;
  return {
    sales: n * perOrder.sales,
    grossProfit: n * perOrder.grossProfit,
    fees: n * perOrder.fee,
    delivery: n * perOrder.delivery,
    returns: n * perOrder.returns,
    tools: x.toolsPerMonth,
    ads: x.adsPerMonth,
    fixed,
    profit: n * perOrder.margin - fixed,
    perOrder,
    breakEven: perOrder.margin > 0 ? Math.ceil(fixed / perOrder.margin) : null,
  };
}

/** Both, from saved inputs (or a draft). */
export function businessMonth(saved, overrides = {}) {
  const inputs = businessInputs(saved);
  const rides = ridesMonth(inputs.rides, inputs.hstPct, overrides.rides);
  const store = storeMonth(inputs.store, inputs.hstPct, overrides.store);
  return { inputs, rides, store, profit: rides.profit + store.profit };
}
