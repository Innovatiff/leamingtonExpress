import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG_VERSION, DEFAULT_TRIPS } from "../src/features/travel/data/trips.js";
import { builtInTrip, catalogUpdates } from "../src/features/travel/lib/catalog.js";
import { breakEven, fixedCosts, isServiceLine, travelCostRules, tripEconomics } from "../src/features/travel/lib/costs.js";

const rules = travelCostRules({});
const both = (v) => typeof v?.es === "string" && v.es.trim() && typeof v?.en === "string" && v.en.trim();
const PHOTO = /^https:\/\/(images\.unsplash\.com\/photo-|upload\.wikimedia\.org\/wikipedia\/commons\/)/;

test("updating the saved trips: built-in ones replaced, the owner's kept", () => {
  const [a, b, c] = DEFAULT_TRIPS;
  const saved = [
    { ...a, catalogVersion: undefined, cities: ["leamington", "kingsville"], active: false, priceAdult: 1 },
    { ...b, catalogVersion: CATALOG_VERSION },
    { id: "my-own-trip", title: { es: "Mío", en: "Mine" }, cities: ["leamington"] },
  ];
  const updates = catalogUpdates(saved, "leamington", [a, b, c, { ...c, id: "brand-new-trip" }]);
  const byId = Object.fromEntries(updates.map((u) => [u.trip.id, u]));
  // a: replaced, keeps where it's sold and that it was hidden
  assert.equal(byId[a.id].isNew, false);
  assert.deepEqual(byId[a.id].trip.cities, ["leamington", "kingsville"]);
  assert.equal(byId[a.id].trip.active, false);
  assert.equal(byId[a.id].trip.priceAdult, a.priceAdult);
  assert.equal(byId[a.id].trip.catalogVersion, CATALOG_VERSION);
  // b: already up to date; c: the owner deleted it, so it isn't added back
  assert.equal(byId[b.id], undefined);
  assert.equal(byId[c.id], undefined);
  // a trip new in this catalog is added; the owner's own trip is never touched
  assert.equal(byId["brand-new-trip"].isNew, true);
  assert.deepEqual(byId["brand-new-trip"].trip.cities, ["leamington"]);
  assert.equal(byId["my-own-trip"], undefined);
  assert.equal(builtInTrip(a).catalogVersion, CATALOG_VERSION);
});

test("the built-in trips are complete and in both languages", () => {
  const ids = new Set();
  for (const t of DEFAULT_TRIPS) {
    assert.ok(!ids.has(t.id), `${t.id} twice`);
    ids.add(t.id);
    for (const key of ["title", "tagline", "summary"]) assert.ok(both(t[key]), `${t.id}: ${key}`);
    assert.match(t.image, PHOTO, `${t.id}: main photo`);
    assert.ok(t.distanceKm > 0, `${t.id}: distance`);
    assert.ok(["easy", "moderate", "active"].includes(t.activity), `${t.id}: activity`);
    assert.ok(t.sights?.length >= 2, `${t.id}: places to see`);
    assert.ok(t.goodToKnow?.length >= 2, `${t.id}: tips`);
    for (const s of t.sights) {
      assert.ok(both(s.name) && both(s.text), `${t.id}: place text`);
      if (s.image) assert.match(s.image, PHOTO, `${t.id}: ${s.name.en} photo`);
    }
    for (const h of t.hotels || []) {
      assert.ok(h.name && h.address && h.website, `${t.id}: ${h.name} details`);
      assert.ok(both(h.text) && both(h.room), `${t.id}: ${h.name} text`);
      if (h.image) assert.match(h.image, PHOTO, `${t.id}: ${h.name} photo`);
    }
    for (const m of t.meals || []) {
      assert.ok(m.place && both(m.cuisine), `${t.id}: meal ${m.place}`);
      if (m.image) assert.match(m.image, PHOTO, `${t.id}: ${m.place} photo`);
    }
    for (const x of [t, ...(t.sights || []), ...(t.hotels || []), ...(t.meals || [])]) {
      if (x.image && x.image.includes("wikimedia.org")) assert.ok(x.photoBy && x.photoLicense && x.photoLink, `${t.id}: Commons photo credit`);
      if (x.photoMatch) assert.ok(["area", "representative"].includes(x.photoMatch), `${t.id}: photoMatch`);
    }
    if (t.nights > 0) assert.ok(t.hotels?.length > 0, `${t.id}: hotel`);
  }
});

test("built-in prices add up and leave a profit with a normal group", () => {
  for (const t of DEFAULT_TRIPS) {
    const sum = t.breakdown.reduce((s, b) => s + b.amount, 0);
    assert.equal(sum, t.priceAdult, `${t.id}: lines add up to the price`);
    assert.equal(t.breakdown.filter((b) => isServiceLine(b, t.breakdown)).length, 1, `${t.id}: one transport/guide line`);
    assert.equal(t.priceAdult % 10, 9, `${t.id}: price ends in 9`);
    const seats = fixedCosts(t, rules).seats;
    assert.ok(t.groupSize <= seats, `${t.id}: group fits the van`);
    const plan = tripEconomics(t, rules, { travellers: rules.planningGroup });
    assert.ok(plan.marginPct >= rules.targetMarginPct - 1, `${t.id}: ${plan.marginPct}% margin with ${rules.planningGroup}`);
    const even = breakEven(t, rules);
    assert.ok(even && even <= 7, `${t.id}: no loss from ${even} travellers`);
    if (t.priceChild != null) assert.ok(t.priceChild <= t.priceAdult, `${t.id}: child price`);
  }
});
