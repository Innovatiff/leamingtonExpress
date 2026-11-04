// Products → Check suppliers: what a check saves, and the order products are checked in.
process.env.TZ = "America/Toronto";

import test from "node:test";
import assert from "node:assert/strict";
import { pricingRules, sellingPrices } from "../src/lib/margin.js";
import { checkedLabel, checkedToday, checkOrder, checkUpdate, previewPrice } from "../src/features/admin/supplierCheck.js";

const rules = pricingRules(null);
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const now = at(2026, 11, 4, 15, 0).getTime();

test("checked today means since midnight", () => {
  assert.equal(checkedToday(at(2026, 11, 4, 0, 5), now), true);
  assert.equal(checkedToday(at(2026, 11, 3, 23, 50), now), false);
  assert.equal(checkedToday(null, now), false);
  assert.equal(checkedToday({ seconds: at(2026, 11, 4, 9).getTime() / 1000 }, now), true, "Firestore timestamps too");
  assert.equal(checkedLabel(at(2026, 11, 4, 9), now), "today");
  assert.equal(checkedLabel(at(2026, 11, 3, 14), now), "yesterday");
  assert.equal(checkedLabel(at(2026, 10, 31, 14), now), "4 days ago");
  assert.equal(checkedLabel(undefined, now), "never");
});

const walmart = { supplier: "walmart", supplierPrice: 59.97, supplierRegular: 0, autoPrice: true, sourceLink: "https://www.walmart.ca/en/ip/x/6000196530731" };
const raw = { id: "p1", status: "active", stock: null, pricing: { price: 81.99, currentPrice: 0 } };

test("a new supplier price follows the pricing rules (and a sale becomes our offer)", () => {
  const when = at(2026, 11, 4, 15);
  const { publicData, privateData } = checkUpdate(raw, walmart, { supplierPrice: 49.97, supplierRegular: 59.97 }, rules, when);
  const want = sellingPrices({ supplier: "walmart", supplierPrice: 49.97, supplierRegular: 59.97 }, rules);
  assert.deepEqual(publicData.pricing, { price: want.price, currentPrice: want.currentPrice });
  assert.ok(want.currentPrice > 0 && want.currentPrice < want.price, "on offer while Walmart has it on sale");
  assert.deepEqual(privateData, { supplierPrice: 49.97, supplierRegular: 59.97, checkedAt: when, cost: want.cost });
  assert.equal(previewPrice(walmart, 49.97, 59.97, rules), want.currentPrice);
});

test("still good: same prices, marked as checked; a 'regular' price that isn't higher is dropped", () => {
  const { publicData, privateData } = checkUpdate(raw, walmart, {}, rules);
  assert.equal(privateData.supplierPrice, 59.97);
  assert.ok(privateData.checkedAt instanceof Date);
  assert.ok(publicData.pricing.price > 59.97);
  assert.equal(checkUpdate(raw, walmart, { supplierPrice: 50, supplierRegular: 45 }, rules).privateData.supplierRegular, 0);
});

test("automatic price off: only the supplier's price is noted", () => {
  const manual = { ...walmart, autoPrice: false };
  const { publicData, privateData } = checkUpdate(raw, manual, { supplierPrice: 44.97 }, rules);
  assert.equal(publicData.pricing, undefined, "your price stays as you typed it");
  assert.equal(privateData.supplierPrice, 44.97);
  assert.equal(previewPrice(manual, 44.97, 0, rules), null);
});

test("hide from the store, and back on sale (a sold-out count is cleared)", () => {
  assert.equal(checkUpdate(raw, walmart, { status: "hidden" }, rules).publicData.status, "hidden");
  const back = checkUpdate({ ...raw, status: "hidden", stock: 0 }, walmart, { status: "active" }, rules).publicData;
  assert.equal(back.status, "active");
  assert.equal(back.stock, null);
  assert.equal("stock" in checkUpdate({ ...raw, status: "hidden", stock: 3 }, walmart, { status: "active" }, rules).publicData, false);
});

test("checking order: never checked first, then the longest ago; newest products first among equals", () => {
  const rows = [
    { raw: { id: "a", createdAt: at(2026, 10, 1) }, priv: { checkedAt: at(2026, 11, 3) } },
    { raw: { id: "b", createdAt: at(2026, 10, 2) }, priv: {} },
    { raw: { id: "c", createdAt: at(2026, 10, 5) }, priv: {} },
    { raw: { id: "d", createdAt: at(2026, 10, 3) }, priv: { checkedAt: at(2026, 11, 1) } },
  ];
  assert.deepEqual(
    checkOrder(rows).map((r) => r.raw.id),
    ["c", "b", "d", "a"],
  );
});
