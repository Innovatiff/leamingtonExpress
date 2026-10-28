"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../lib/tracking");
const { parseStaffInput } = require("../lib/staff");

const driver = { uid: "u1", name: "Carlos Méndez Ruiz", phone: "5195550142", photo: "", vehicle: { make: "Toyota", model: "Sienna", color: "Gris", plate: "CXKP 214" } };

test("ride live status follows the driver's steps", () => {
  const ride = { ref: "R-ABC123", status: "requested", driverUid: null, pickup: { address: "10 Erie St" }, dropoff: { address: "YQG" }, schedule: { type: "now" }, passengers: 2, trackToken: "x".repeat(24) };
  let v = T.trackingView("ride", ride, "r1");
  assert.equal(v.stage, "searching");
  assert.equal(v.staff, null);
  v = T.trackingView("ride", { ...ride, status: "assigned", driverUid: "u1", driver }, "r1");
  assert.equal(v.stage, "assigned");
  assert.equal(v.staff.name, "Carlos R.");
  assert.equal(v.staff.vehicle.plate, "CXKP 214");
  assert.equal(T.trackingView("ride", { ...ride, status: "in_progress", driverUid: "u1", driver }).stage, "in_progress");
  assert.equal(T.trackingView("ride", { ...ride, status: "cancelled", driverUid: "u1", driver }).staff, null);
});

test("order live status: courier, pick-up and delivery", () => {
  const order = { orderNumber: "ODR123456", status: "Opened", fulfilment: "Unfulfilled", payment: "Pending", paymentMethodKey: "cash", courierUid: null, productsCount: 2, total: { finalTotal: 45 }, customerInfo: { address: "1 Oak St", city: "Leamington", phone: "5195550100" }, accessToken: "a".repeat(48) };
  assert.equal(T.trackingView("order", order).stage, "received");
  assert.equal(T.trackingView("order", { ...order, paymentMethodKey: "card" }).stage, "awaitingPayment");
  const taken = { ...order, courierUid: "u1", courier: driver, fulfilment: "Preparing" };
  assert.equal(T.trackingView("order", taken).stage, "preparing");
  assert.equal(T.trackingView("order", taken).staff.name, "Carlos R.");
  assert.equal(T.trackingView("order", { ...taken, fulfilment: "Out for delivery" }).stage, "onTheWay");
  assert.equal(T.trackingView("order", { ...taken, fulfilment: "Fulfilled" }).stage, "delivered");
  const v = T.trackingView("order", order, "o1");
  assert.equal(v.detail.address, "1 Oak St, Leamington");
  assert.equal(v.detail.orderId, "o1");
  assert.equal(JSON.stringify(v).includes("5195550100"), false, "customer phone stays private");
});

test("trip booking live status", () => {
  const b = { ref: "V-1", status: "pending", guideUid: null, tripTitle: "Niagara", date: "2027-05-02", adults: 2, children: 1, pricing: { total: 500 } };
  assert.equal(T.trackingView("booking", b).stage, "pending");
  assert.equal(T.trackingView("booking", { ...b, status: "deposit_paid" }).stage, "confirmed");
  assert.equal(T.trackingView("booking", { ...b, status: "paid", guideUid: "u1", guide: driver, tripStage: "assigned" }).stage, "assigned");
  assert.equal(T.trackingView("booking", { ...b, status: "paid", guideUid: "u1", guide: driver, tripStage: "picked_up" }).stage, "on_trip");
  assert.equal(T.trackingView("booking", { ...b, status: "completed", guideUid: "u1", guide: driver, tripStage: "completed" }).stage, "completed");
  assert.equal(T.trackingView("booking", b).detail.people, 3);
});

test("tracking tokens", () => {
  assert.equal(T.tokenOf("ride", { trackToken: "short" }), "");
  assert.equal(T.tokenOf("ride", { trackToken: "a/b".repeat(10) }), "");
  assert.equal(T.tokenOf("ride", { trackToken: "Abc_def-ghijklmnopqrstuv" }), "Abc_def-ghijklmnopqrstuv");
  assert.equal(T.tokenOf("order", { accessToken: "f".repeat(48), trackToken: "x" }), "f".repeat(48));
});

test("employee input checks", () => {
  const ok = parseStaffInput({ name: " Carlos  Méndez ", email: "Carlos@Example.com", phone: "(519) 555-0142", password: "secret123", can: { rides: 1, trips: 0, admin: true }, vehicle: { plate: "cxkp 214", seats: "7" } });
  assert.equal(ok.doc.name, "Carlos Méndez");
  assert.equal(ok.doc.email, "carlos@example.com");
  assert.equal(ok.doc.phone, "5195550142");
  assert.deepEqual(ok.doc.can, { rides: true, deliveries: false, trips: false });
  assert.equal(ok.doc.vehicle.plate, "CXKP 214");
  assert.equal(ok.doc.vehicle.seats, 7);
  assert.equal(ok.doc.active, true);
  assert.throws(() => parseStaffInput({ name: "Carlos", email: "carlos@example.com", phone: "5195550142", password: "123" }), /8 characters/);
  assert.throws(() => parseStaffInput({ name: "Carlos", email: "nope", phone: "5195550142", password: "secret123" }), /email/);
  // editing an employee doesn't need a new password
  assert.equal(parseStaffInput({ uid: "u1", name: "Carlos", email: "c@example.com", phone: "5195550142" }).password, "");
  assert.equal(parseStaffInput({ uid: "u1", name: "Carlos", email: "c@example.com", phone: "5195550142", photo: "javascript:alert(1)" }).doc.photo, "");
});

test("live map: who may share their position, and the map points", () => {
  const ride = { status: "assigned", driverUid: "u1", driver, pickup: { address: "10 Erie St", lat: null, lng: null }, schedule: { type: "now" }, trackToken: "x".repeat(24) };
  const v = T.trackingView("ride", ride, "r1");
  assert.equal(v.staffUid, "u1");
  assert.equal(v.detail.pickupAt, null);
  assert.deepEqual(T.trackingView("ride", { ...ride, pickupGeo: { lat: 42.05, lng: -82.6 } }).detail.pickupAt, { lat: 42.05, lng: -82.6 });
  assert.deepEqual(T.trackingView("ride", { ...ride, pickup: { address: "GPS", lat: 42.1, lng: -82.5 }, pickupGeo: { failed: true } }).detail.pickupAt, { lat: 42.1, lng: -82.5 });
  assert.equal(T.trackingView("ride", { ...ride, pickupGeo: { failed: true } }).detail.pickupAt, null);
  const order = { status: "Opened", fulfilment: "Out for delivery", courierUid: "u2", courier: driver, customerInfo: { address: "1 Oak St" }, addressGeo: { lat: 42.04, lng: -82.59 }, accessToken: "a".repeat(48) };
  assert.equal(T.trackingView("order", order).staffUid, "u2");
  assert.deepEqual(T.trackingView("order", order).detail.addressAt, { lat: 42.04, lng: -82.59 });
  assert.equal(T.trackingView("booking", { status: "paid", guideUid: "u3", tripStage: "assigned" }).staffUid, "u3");
  assert.deepEqual(T.MAP_STAGES.ride, ["assigned", "arrived", "in_progress"]);
  assert.equal(T.coordsOf({ lat: null, lng: null }), null);
  assert.equal(T.coordsOf({ lat: "x", lng: 2 }), null);
});

test("address lookup for the live map", async () => {
  const { geoQuery, geocode } = require("../lib/geo");
  assert.equal(geoQuery("ride", { city: "leamington", pickup: { address: "25 Erie St S" } }), "25 Erie St S, Leamington, Ontario, Canada");
  assert.equal(geoQuery("ride", { city: "leamington", pickup: { address: "25 Erie St S, Leamington" } }), "25 Erie St S, Leamington, Ontario, Canada");
  assert.equal(geoQuery("ride", { pickup: { address: "GPS" } }), "");
  assert.equal(
    geoQuery("order", { city: "leamington", customerInfo: { address: "1 Oak St", city: "Kingsville", postalCode: "N9Y 1A1" } }),
    "1 Oak St, Kingsville, N9Y 1A1, Ontario, Canada",
  );
  let asked = "";
  const fake = async (url, opts) => {
    asked = String(url);
    assert.match(opts.headers["User-Agent"], /LeamingtonExpress/);
    return { ok: true, json: async () => [{ lat: "42.0531", lon: "-82.5995" }] };
  };
  assert.deepEqual(await geocode("25 Erie St S, Leamington, Ontario, Canada", { fetchImpl: fake }), { lat: 42.0531, lng: -82.5995 });
  assert.match(asked, /nominatim\.openstreetmap\.org\/search\?q=25\+Erie/);
  assert.match(asked, /countrycodes=ca/);
  assert.equal(await geocode("nowhere", { fetchImpl: async () => ({ ok: true, json: async () => [] }) }), null);
  await assert.rejects(geocode("x", { fetchImpl: async () => ({ ok: false, status: 429 }) }));
});
