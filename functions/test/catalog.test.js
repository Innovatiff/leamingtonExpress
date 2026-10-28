"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const { buildCatalogParts, catalogCard } = require("../lib/catalog");

const product = (i, extra = {}) => ({
  id: `p${i}`,
  name: `Product ${i}`,
  pricing: { price: 12.99, currentPrice: 0, cost: 5, profitRange: "x" },
  images: ["https://img/1.jpg", "https://img/2.jpg"],
  description: "long text ".repeat(50),
  specifications: [{ title: "a", description: "b" }],
  status: "active",
  createdAt: Timestamp.fromMillis(Date.UTC(2026, 0, 2)),
  updatedAt: Timestamp.fromMillis(1000 + i),
  offer: { endsAt: Timestamp.fromMillis(Date.UTC(2026, 11, 1)) },
  ...extra,
});

test("a catalog card keeps what the store's lists need, without the heavy or private parts", () => {
  const { id, ...raw } = product(1, { sourceLink: "https://walmart.ca/x" });
  const card = catalogCard(id, raw);
  assert.equal(card.id, "p1");
  assert.deepEqual(card.images, ["https://img/1.jpg"]);
  assert.deepEqual(card.pricing, { price: 12.99, currentPrice: 0 });
  assert.equal(card.createdAt, "2026-01-02T00:00:00.000Z");
  assert.equal(card.offer.endsAt, "2026-12-01T00:00:00.000Z");
  for (const k of ["description", "specifications", "updatedAt", "sourceLink"]) assert.equal(k in card, false, k);
});

test("parts: products on sale only, split by size, newest change remembered", () => {
  const list = Array.from({ length: 50 }, (_, i) => product(i));
  list.push(product(98, { status: "hidden" }), product(99, { hidden: true, status: undefined }));
  const { parts, count, newest } = buildCatalogParts(list, 2000);
  assert.equal(count, 50);
  assert.equal(newest, 1099);
  assert.ok(parts.length > 1);
  const all = parts.flatMap((json) => JSON.parse(json));
  assert.deepEqual(all.map((c) => c.id), list.slice(0, 50).map((p) => p.id));
  assert.ok(parts.every((json) => Buffer.byteLength(json) <= 2000));
  assert.deepEqual(buildCatalogParts([]).parts, ["[]"]); // an empty store still has one (empty) part
});
