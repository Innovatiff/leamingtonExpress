"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const M = require("../lib/margin");

test("prices end in 2.99, 4.99, 7.99 or 9.99: the nearest one, never below the minimum", () => {
  const cases = [
    [0.5, 2.99],
    [2.99, 2.99],
    [3, 2.99],
    [4.5, 4.99],
    [10, 9.99],
    [12.3, 12.99],
    [20, 19.99],
    [27.12, 27.99],
    [33.86, 32.99],
    [100, 99.99],
    [1234.56, 1234.99],
  ];
  for (const [value, want] of cases) assert.equal(M.priceEnding(value), want, `${value}`);
  assert.equal(M.priceEnding(11.48, 10.57), 12.99); // $9.99 would leave less than the minimum profit
  assert.equal(M.priceEnding(5.38, 5.49), 7.99); // the minimum profit decides
  for (let c = 1; c < 300000; c += 13) {
    const v = M.priceEnding(c / 100);
    assert.ok(M.hasPriceEnding(v) && (Math.abs(v - c / 100) <= 1.51 || (c < 299 && v === 2.99)), `${c / 100} → ${v}`);
    const floor = c / 100 + 0.5;
    assert.ok(M.priceEnding(c / 100, floor) >= floor, `${c / 100} min ${floor}`);
  }
  assert.equal(M.priceEnding(0), 0);
});

test("offers are whole dollars", () => {
  assert.equal(M.offerEnding(20.34), 20);
  assert.equal(M.offerEnding(20.5), 21);
  assert.equal(M.offerEnding(20.34, { min: 20.5 }), 21);
  assert.equal(M.offerEnding(61.19, { down: true }), 61);
  assert.ok(M.hasOfferEnding(21) && !M.hasOfferEnding(20.99));
});

test("selling prices: margin, tax we pay, minimum profit and offers", () => {
  // Walmart $8.47 + 13% HST = $9.57 → +20% = $11.48 → $12.99 ($9.99 would leave under $1 profit)
  assert.deepEqual(M.sellingPrices({ supplier: "walmart", supplierPrice: 8.47 }), { price: 12.99, currentPrice: 0, cost: 9.57, profit: 3.42 });
  // cheap item: the minimum profit decides ($3.39 + $1 → $4.99)
  assert.equal(M.sellingPrices({ supplier: "walmart", supplierPrice: 3 }).price, 4.99);
  // Amazon uses its own margin (15%): $33.89 → $38.97 → nearest $37.99
  assert.equal(M.sellingPrices({ supplier: "amazon", supplierPrice: 29.99 }).price, 37.99);
  // the supplier's sale ($20 → $15) becomes our offer, ending in .00
  assert.deepEqual(M.sellingPrices({ supplier: "walmart", supplierPrice: 15, supplierRegular: 20 }), { price: 27.99, currentPrice: 20, cost: 16.95, profit: 3.05 });
  // our own 10% offer: at least 10% off, whole dollars
  assert.equal(M.sellingPrices({ supplier: "walmart", supplierPrice: 49.97, offerPct: 10 }).currentPrice, 61);
  // a tiny supplier discount that rounds past our regular price is no offer ($9.50 → $10.00 ≥ $9.99)
  assert.equal(M.sellingPrices({ supplier: "walmart", supplierPrice: 9.5, supplierRegular: 9.99 }, { margin: { walmart: 0 }, minProfit: 0, purchaseTax: 0 }).currentPrice, 0);
  // settings change the result; bad values fall back to the defaults
  assert.equal(M.sellingPrices({ supplier: "walmart", supplierPrice: 100 }, { margin: { walmart: 10 }, purchaseTax: 0 }).price, 109.99);
  assert.deepEqual(M.pricingRules({ margin: { walmart: "abc", amazon: -5 }, minProfit: "", purchaseTax: 99 }), { margin: { walmart: 20, amazon: 0, other: 20 }, minProfit: 1, purchaseTax: 30 });
  assert.equal(M.sellingPrices({ supplier: "walmart", supplierPrice: 0 }), null);
  // never less than the minimum profit, whatever the price
  for (let p = 0.5; p < 3000; p = p * 1.07 + 0.03) {
    const r = M.sellingPrices({ supplier: "walmart", supplierPrice: Math.round(p * 100) / 100 });
    assert.ok(r.price - r.cost >= 0.995, `${p}: ${JSON.stringify(r)}`);
  }
});

test("the website and the Cloud Functions price the same way", async () => {
  const web = await import(pathToFileURL(path.join(__dirname, "../../src/lib/margin.js")).href);
  const rules = [null, { margin: { walmart: 35, amazon: 8, other: 50 }, minProfit: 3.5, purchaseTax: 0 }];
  for (const saved of rules) {
    for (let p = 0.37; p < 2500; p = p * 1.17 + 0.11) {
      for (const supplier of ["walmart", "amazon", "other", "unknown"]) {
        const input = { supplier, supplierPrice: Math.round(p * 100) / 100, supplierRegular: Math.round(p * 130) / 100, offerPct: p > 50 ? 15 : 0 };
        assert.deepEqual(web.sellingPrices(input, saved), M.sellingPrices(input, saved));
      }
    }
  }
  assert.deepEqual(web.SUPPLIERS, M.SUPPLIERS);
  assert.deepEqual(web.DEFAULT_PRICING, M.DEFAULT_PRICING);
});
