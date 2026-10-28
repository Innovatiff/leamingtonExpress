"use strict";

// Selling prices from what the supplier charges: the sales tax they charge us,
// plus our margin, rounded to the nearest of the store's endings — regular
// prices end in 2.99, 4.99, 7.99 or 9.99, offers in .00 — never leaving less
// than the minimum profit.
// Mirrors src/lib/margin.js — keep the two in sync (test/margin.test.js checks it).

/** Where a product comes from, and how soon it reaches the customer. */
const SUPPLIERS = {
  walmart: { name: "Walmart", label: "Walmart — local pick-up", delivery: { count: 2, unit: "hours" } }, // an employee buys it at the local store
  amazon: { name: "Amazon", label: "Amazon Prime", delivery: { count: 2, unit: "days" } },
  other: { name: "", label: "Other supplier", delivery: null },
};

const DEFAULT_PRICING = {
  margin: { walmart: 20, amazon: 15, other: 20 }, // % added to the cost
  minProfit: 1, // $ per unit, at least
  purchaseTax: 13, // % HST the supplier charges us
};

const ENDINGS = [299, 499, 799, 999]; // cents within each $10
const cents = (v) => Math.round((Number(v) || 0) * 100);
const round2 = (v) => Math.round(v * 100) / 100;

const up = (c) => {
  const tens = Math.floor(c / 1000) * 1000;
  return tens + ENDINGS.find((e) => tens + e >= c); // x.99 within the same $10 always fits
};
const down = (c) => {
  const tens = Math.floor(c / 1000) * 1000;
  const e = ENDINGS.findLast((x) => tens + x <= c);
  return e === undefined ? tens - 1 : tens + e; // tens − 1 = the previous $10's 9.99
};

/**
 * The price ending in 2.99, 4.99, 7.99 or 9.99 nearest to `value` (ties go up),
 * but never below `min` (cost + minimum profit).
 */
function priceEnding(value, min = 0) {
  const c = cents(value);
  const m = cents(min);
  if (c <= 0 && m <= 0) return 0;
  if (c < m) return up(m) / 100;
  const lo = down(c);
  const hi = up(c);
  return (lo > 0 && lo >= m && c - lo < hi - c ? lo : hi) / 100;
}

/**
 * Offer prices are whole dollars: the nearest one to `value`, never below `min`
 * (or rounded down, for our own "% off" offers).
 */
function offerEnding(value, { min = 0, down: roundDown = false } = {}) {
  const c = cents(value);
  if (c <= 0) return 0;
  if (roundDown) return Math.floor(c / 100);
  return Math.max(Math.round(c / 100), Math.ceil(cents(min) / 100));
}

const hasPriceEnding = (v) => cents(v) > 0 && ENDINGS.includes(cents(v) % 1000);
const hasOfferEnding = (v) => cents(v) > 0 && cents(v) % 100 === 0;

/** Saved settings (express_pricing) with the defaults filled in. */
function pricingRules(saved) {
  const s = saved || {};
  const num = (v, fallback, max) => {
    const n = v === "" || v == null ? NaN : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback;
  };
  return {
    margin: Object.fromEntries(Object.entries(DEFAULT_PRICING.margin).map(([k, d]) => [k, num(s.margin?.[k], d, 300)])),
    minProfit: num(s.minProfit, DEFAULT_PRICING.minProfit, 1000),
    purchaseTax: num(s.purchaseTax, DEFAULT_PRICING.purchaseTax, 30),
  };
}

/**
 * { supplier, supplierPrice, supplierRegular?, offerPct? } →
 * { price, currentPrice (0 = no offer), cost, profit } or null without a supplier price.
 * `supplierRegular` is the supplier's usual price when they have it on sale: our
 * regular price follows it and their sale becomes our offer. `offerPct` is our own
 * offer (% off our regular price). `cost` includes the tax we pay the supplier.
 */
function sellingPrices(input, saved) {
  const rules = pricingRules(saved);
  const now = Number(input?.supplierPrice) || 0;
  if (!(now > 0)) return null;
  const was = Math.max(now, Number(input.supplierRegular) || 0);
  const margin = (rules.margin[input.supplier] ?? rules.margin.other) / 100;
  const withTax = (p) => p * (1 + rules.purchaseTax / 100);
  const target = (p) => withTax(p) * (1 + margin);
  const floor = (p) => withTax(p) + rules.minProfit;

  const price = priceEnding(target(was), floor(was));
  const offers = [];
  if (was > now) offers.push(offerEnding(target(now), { min: floor(now) })); // the supplier's sale, keeping our margin
  const pct = Math.min(90, Math.max(0, Number(input.offerPct) || 0));
  if (pct > 0) offers.push(offerEnding(price * (1 - pct / 100), { down: true })); // at least that % off
  const sale = offers.length ? Math.min(...offers) : 0;
  const currentPrice = sale > 0 && sale < price ? sale : 0;
  const cost = round2(withTax(now));
  return { price, currentPrice, cost, profit: round2((currentPrice || price) - cost) };
}

module.exports = { SUPPLIERS, DEFAULT_PRICING, priceEnding, offerEnding, hasPriceEnding, hasOfferEnding, pricingRules, sellingPrices };
