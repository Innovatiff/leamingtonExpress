"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../lib/pricing");

const product = (over = {}) => ({
  name: "Bocina",
  status: "active",
  pricing: { price: "100.00", currentPrice: "80.00" },
  stock: 3,
  expressPoints: 5,
  delivery: { count: 2, unit: "hours" },
  ...over,
});

const input = (over = {}) => ({
  city: "leamington",
  lang: "es",
  items: [{ id: "p1", variant: "", qty: 1 }],
  customer: { firstName: "María", lastName: "López", phone: "(519) 555-0100", email: "" },
  address: { street: "10 Erie St S", unit: "", town: "Leamington", postalCode: "n8h3a1", notes: "" },
  paymentMethod: "cash",
  ...over,
});

test("parses and normalizes checkout input", () => {
  const parsed = P.parseOrderInput(input({ items: [{ id: "p1", qty: 2 }, { id: "p1", qty: 1 }] }));
  assert.equal(parsed.customer.phone, "5195550100");
  assert.equal(parsed.address.postalCode, "N8H 3A1");
  assert.deepEqual(parsed.items, [{ id: "p1", variant: "", qty: 3 }]);
});

test("rejects bad input", () => {
  assert.throws(() => P.parseOrderInput(input({ paymentMethod: "bitcoin" })), /paymentMethod/);
  assert.throws(() => P.parseOrderInput(input({ items: [] })), /items/);
  assert.throws(() => P.parseOrderInput(input({ customer: { firstName: "M", phone: "123" } })), /firstName/);
  assert.throws(() => P.parseOrderInput(input({ address: { street: "10 Erie", town: "Leamington", postalCode: "12345" } })), /postalCode/);
});

test("prices come from the product, not the browser", () => {
  const products = new Map([["p1", product()]]);
  const built = P.buildLines([{ id: "p1", variant: "", qty: 2 }], products, "leamington");
  assert.equal(built.productsTotal, 160);
  assert.equal(built.totalSaved, 40);
  assert.equal(built.points, 10);
  assert.equal(built.lines[0].oldPrice, 100);
});

test("stock, hidden products and options are enforced", () => {
  const products = new Map([
    ["p1", product()],
    ["p2", product({ status: "hidden" })],
    ["p3", product({ variants: ["Negro", "Azul"] })],
    ["p4", product({ cities: ["windsor"] })],
  ]);
  assert.throws(() => P.buildLines([{ id: "p1", variant: "", qty: 4 }], products, "leamington"), (e) => e.details.reason === "OUT_OF_STOCK" && e.details.available === 3);
  assert.throws(() => P.buildLines([{ id: "p2", variant: "", qty: 1 }], products, "leamington"), (e) => e.details.reason === "PRODUCT_NOT_FOUND");
  assert.throws(() => P.buildLines([{ id: "p3", variant: "Rojo", qty: 1 }], products, "leamington"), (e) => e.details.reason === "VARIANT_REQUIRED");
  assert.throws(() => P.buildLines([{ id: "p4", variant: "", qty: 1 }], products, "leamington"), (e) => e.details.reason === "PRODUCT_NOT_FOUND");
  assert.throws(() => P.buildLines([{ id: "missing", variant: "", qty: 1 }], products, "leamington"), (e) => e.details.reason === "PRODUCT_NOT_FOUND");
  // two options of the same product share its stock
  assert.throws(
    () => P.buildLines([{ id: "p3", variant: "Negro", qty: 2 }, { id: "p3", variant: "Azul", qty: 2 }], products, "leamington"),
    (e) => e.details.reason === "OUT_OF_STOCK" && e.details.available === 1,
  );
});

test("untracked stock is always available", () => {
  const products = new Map([["p1", product({ stock: null })]]);
  assert.equal(P.buildLines([{ id: "p1", variant: "", qty: 20 }], products, "leamington").lines[0].quantity, 20);
});

test("discount codes", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const codes = [{ id: "a", Code: "Bienvenido10", Discount: "10.00", Reusable: true }];
  assert.equal(P.findCode(codes, "BIENVENIDO10").id, "a");
  assert.deepEqual(P.evaluateDiscount(codes[0], 50, now), { valid: true, amount: 10, reason: "", code: "Bienvenido10" });
  assert.equal(P.evaluateDiscount(codes[0], 6, now).amount, 6);
  assert.equal(P.evaluateDiscount({ ...codes[0], active: false }, 50, now).reason, "inactive");
  assert.equal(P.evaluateDiscount({ ...codes[0], Reusable: false, usedCount: 1 }, 50, now).reason, "used");
  assert.equal(P.evaluateDiscount({ ...codes[0], expiresAt: new Date("2026-10-01") }, 50, now).reason, "expired");
  assert.equal(P.evaluateDiscount({ ...codes[0], minSubtotal: 100 }, 50, now).reason, "minimum");
  assert.equal(P.evaluateDiscount(null, 50, now).valid, false);
});

test("delivery fee and settings", () => {
  const store = P.storeSettings({ store: { deliveryFee: 5, freeDeliveryOver: 100, payments: { card: true } } });
  assert.equal(store.payments.cash, true); // cash on delivery unless turned off in Settings
  assert.equal(store.payments.card, true);
  assert.equal(P.storeSettings({ store: { payments: { cash: false } } }).payments.cash, false);
  assert.equal(P.deliveryFee(store, 99), 5);
  assert.equal(P.deliveryFee(store, 100), 0);
  assert.equal(P.deliveryFee(store, 120), 0);
  assert.equal(P.storeSettings(null).payments.card, false);
});
