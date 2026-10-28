// Demo backend — same API as src/services/firebase/index.js, but everything
// lives in this browser (localStorage). Used by `npm run demo`.
import { CITIES } from "@/config/cities";
import { OWNER_UIDS } from "@/config/firebase";
import { CITY } from "@/config/site";
import { newTrackToken, trackingView } from "@/lib/dispatch";
import { parseMoney, round2, toDate } from "@/lib/format";
import { readJSON, writeJSON } from "@/lib/storage";
import * as dbx from "./db";

export const MODE = "demo";
export const startAnalytics = () => {};

/* ---------------------------- Catalog ---------------------------------- */
export const subscribeProducts = (onData) => dbx.subscribe("products", onData);
export const subscribeCatalog = subscribeProducts; // the demo has no compact catalog: every product, as is
export const subscribeProduct = (id, onData) => dbx.subscribe("products", (list) => onData(list.find((p) => p.id === id) || null));

export function subscribeSettings(cityId, onData) {
  return dbx.subscribe("settings", (list) => onData(list.find((s) => s.id === cityId) || null));
}

export async function listTrips(cityId) {
  await dbx.delay(150);
  return dbx.all("trips").filter((t) => (t.cities || []).includes(cityId));
}

/* ------------------------- Store ("Cloud Functions") -------------------- */
function findCode(code) {
  const c = String(code || "").trim().toLowerCase();
  return dbx.all("discounts").find((d) => String(d.Code || "").trim().toLowerCase() === c) || null;
}

/** Same rules as the validateDiscountCode Cloud Function. */
function evaluateCode(d, subtotal) {
  if (!d || d.active === false) return { valid: false, reason: "invalid" };
  const expires = toDate(d.expiresAt);
  if (expires && expires.getTime() < Date.now()) return { valid: false, reason: "expired" };
  if (!d.Reusable && (Number(d.usedCount) > 0 || d.used)) return { valid: false, reason: "used" };
  const min = parseMoney(d.minSubtotal);
  if (min > 0 && subtotal < min) return { valid: false, reason: "minimum", minSubtotal: min };
  const amount = round2(Math.min(parseMoney(d.Discount), subtotal || 0));
  if (amount <= 0) return { valid: false, reason: "invalid" };
  return { valid: true, code: d.Code, amount };
}

export async function validateDiscount({ code, subtotal }) {
  await dbx.delay(400);
  return evaluateCode(findCode(code), subtotal || 0);
}

const METHOD_LABEL = { cash: "Cash", etransfer: "E-transfer", card: "Debit / Credit Card" };

export async function placeOrder(input) {
  await dbx.delay(900);
  const products = dbx.all("products");
  const lines = [];
  let longest = { count: 0, unit: "hours", hours: 0 };
  for (const item of input.items) {
    const raw = products.find((p) => p.id === item.id);
    if (!raw) throw Object.assign(new Error("Producto no disponible"), { code: "functions/not-found", details: { reason: "PRODUCT_NOT_FOUND", productId: item.id } });
    const stock = raw.stock == null ? Infinity : Number(raw.stock);
    if (stock < item.qty) throw Object.assign(new Error("Sin stock suficiente"), { code: "functions/failed-precondition", details: { reason: "OUT_OF_STOCK", productId: item.id, available: stock } });
    const regular = parseMoney(raw.pricing?.price);
    const current = parseMoney(raw.pricing?.currentPrice);
    const price = current > 0 ? current : regular;
    const oldPrice = regular > price ? regular : price;
    const hours = (raw.delivery?.count || 0) * ({ minutes: 1 / 60, hours: 1, days: 24, weeks: 168 }[raw.delivery?.unit] || 24);
    if (hours >= longest.hours) longest = { count: raw.delivery?.count || 0, unit: raw.delivery?.unit || "hours", hours };
    lines.push({
      docId: raw.id,
      productId: raw.productId || "",
      name: raw.name,
      image: raw.images?.[0] || "",
      category: raw.category || "",
      brand: raw.brand || "",
      origin: raw.origin || "",
      sku: raw.sku || "",
      variant: item.variant || "",
      quantity: item.qty,
      price,
      oldPrice,
      lineTotal: round2(price * item.qty),
      lineSaved: round2((oldPrice - price) * item.qty),
      points: Number(raw.expressPoints) || 0,
      delivery: { count: raw.delivery?.count || 0, unit: raw.delivery?.unit || "hours" },
    });
  }
  const settings = dbx.all("settings").find((s) => s.id === input.city) || {};
  const productsTotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const totalSaved = round2(lines.reduce((s, l) => s + l.lineSaved, 0));
  let discount = 0;
  if (input.discountCode) {
    const d = findCode(input.discountCode);
    const check = evaluateCode(d, productsTotal);
    if (!check.valid) throw Object.assign(new Error("Código no válido"), { code: "functions/invalid-argument", details: { reason: "DISCOUNT_INVALID" } });
    discount = check.amount;
    dbx.patch("discounts", d.id, { usedCount: (Number(d.usedCount) || 0) + 1, ...(d.Reusable ? {} : { used: true }) });
  }
  const free = Number(settings.store?.freeDeliveryOver) || 0;
  const deliveryFee = free > 0 && productsTotal >= free ? 0 : (settings.store?.deliveryFee ?? 5);
  // inventory (after every check passed)
  for (const l of lines) {
    const raw = dbx.get("products", l.docId);
    if (raw.stock != null) dbx.patch("products", l.docId, { stock: Number(raw.stock) - l.quantity, performance: (raw.performance || 0) + l.quantity });
  }
  const id = dbx.newId();
  const token = dbx.newId() + dbx.newId();
  const c = input.customer;
  const order = {
    id,
    orderNumber: `ODR${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" }),
    payment: "Pending",
    paymentMethod: METHOD_LABEL[input.paymentMethod],
    paymentMethodKey: input.paymentMethod,
    customer: `${c.firstName} ${c.lastName}`.trim(),
    customerInfo: {
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: `${c.firstName} ${c.lastName}`.trim(),
      phone: c.phone,
      email: c.email || "",
      address: input.address.street,
      unit: input.address.unit || "",
      city: input.address.town,
      province: "Ontario",
      country: "Canada",
      postalCode: input.address.postalCode,
      orderNotes: input.address.notes || "",
    },
    total: {
      productsTotal,
      shipping: deliveryFee,
      discount,
      tax: 0,
      totalSaved,
      totalAccumulatedPoints: lines.reduce((s, l) => s + l.points * l.quantity, 0),
      finalTotal: round2(productsTotal - discount + deliveryFee),
    },
    discountCode: discount ? input.discountCode.toUpperCase() : "",
    discountAmount: discount,
    delivery: { count: longest.count, unit: longest.unit, label: `${longest.count} ${longest.unit}` },
    productsCount: lines.reduce((s, l) => s + l.quantity, 0),
    fulfilment: "Unfulfilled",
    status: "Opened",
    priority: false,
    inventoryApplied: true,
    courierUid: null,
    products: lines,
    source: "web",
    channel: "web-v2",
    city: input.city,
    lang: input.lang,
    userId: readJSON(AUTH_KEY, null)?.uid || null,
    accessToken: token,
    addressGeo: demoGeo(input.address?.street, input.city),
    createdAt: dbx.nowTs(),
    updatedAt: dbx.nowTs(),
  };
  dbx.put("orders", order);
  const result = { orderId: id, orderNumber: order.orderNumber, token };
  if (input.paymentMethod === "card") {
    // Simulate Stripe: the "webhook" marks the order paid a moment later
    result.checkoutUrl = `/tienda/pedido/${id}?t=${token}&paid=1`;
    setTimeout(() => dbx.patch("orders", id, { payment: "Success", paidAt: dbx.nowTs() }), 2500);
  }
  return result;
}

export async function fetchOrder({ orderId, token }) {
  await dbx.delay(300);
  const o = dbx.get("orders", orderId);
  const me = readJSON(AUTH_KEY, null)?.uid;
  // Same as the Cloud Function: the private link token, or the signed-in owner
  if (!o || (o.accessToken !== token && !(me && o.userId === me))) throw Object.assign(new Error("not found"), { code: "functions/not-found" });
  const { accessToken: _t, adminNote: _n, ...safe } = o;
  return safe;
}

export async function cancelOrder({ orderId, token }) {
  await dbx.delay(200);
  const o = dbx.get("orders", orderId);
  if (!o || o.accessToken !== token || o.payment === "Success") return { ok: false };
  for (const l of o.products) {
    const raw = dbx.get("products", l.docId);
    if (raw && raw.stock != null) dbx.patch("products", l.docId, { stock: Number(raw.stock) + l.quantity });
  }
  dbx.patch("orders", orderId, { status: "Cancelled", payment: "Expired", inventoryApplied: false });
  return { ok: true };
}

/* ------------------------ Rides / travel / contact ---------------------- */
function addRecord(name, data, status) {
  const id = dbx.newId();
  dbx.put(name, { id, ...data, status, userId: readJSON(AUTH_KEY, null)?.uid || null, createdAt: dbx.nowTs(), updatedAt: dbx.nowTs() });
  return { id };
}
// Stand-in for the Cloud Functions' address lookup: a point near the town centre
function demoGeo(text, cityId) {
  const c = CITIES[cityId]?.center || CITY.center;
  if (!c) return { failed: true };
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { lat: c.lat + ((h % 1000) / 1000 - 0.5) * 0.02, lng: c.lng + (((h >> 10) % 1000) / 1000 - 0.5) * 0.03 };
}

export async function createRide(data) {
  await dbx.delay(700);
  const token = newTrackToken();
  const pickupGeo = data.pickup?.lat != null ? undefined : demoGeo(data.pickup?.address, data.city);
  return { ...addRecord("rides", { ...data, ...(pickupGeo ? { pickupGeo } : {}), trackToken: token, driverUid: null }, "requested"), token };
}

export async function createBooking(data) {
  await dbx.delay(700);
  const token = newTrackToken();
  return { ...addRecord("bookings", { ...data, trackToken: token, guideUid: null, tripStage: "" }, "pending"), token };
}

export const createMessage = async (data) => (await dbx.delay(500), addRecord("messages", data, "new"));

/* ------------------------------ Live status ----------------------------- */
// The Cloud Functions keep express_tracking/{token} up to date; here we build
// the same view straight from the demo data.
function findTracked(token) {
  const ride = dbx.all("rides").find((r) => r.trackToken === token);
  if (ride) return trackingView("ride", ride);
  const booking = dbx.all("bookings").find((b) => b.trackToken === token);
  if (booking) return trackingView("booking", booking);
  const order = dbx.all("orders").find((o) => o.accessToken === token);
  if (order) return trackingView("order", order);
  return null;
}

export function subscribeTracking(token, onData) {
  let last = "";
  const push = () => {
    const view = token ? findTracked(token) : null;
    const key = JSON.stringify(view);
    if (key !== last) {
      last = key;
      onData(view);
    }
  };
  const unsubs = ["rides", "bookings", "orders"].map((name) => dbx.subscribe(name, push));
  return () => unsubs.forEach((u) => u());
}

/** The employee's position (shared from the employee app in another tab). */
export function subscribeLivePosition(token, onData) {
  let last = "";
  return dbx.subscribe("live", (list) => {
    const pos = list.find((p) => p.id === token) || null;
    const key = JSON.stringify(pos);
    if (key !== last) {
      last = key;
      onData(pos);
    }
  });
}

/* -------------------------------- Auth ---------------------------------- */
const AUTH_KEY = "lx_demo_auth";
const authListeners = new Set();
const emitAuth = () => authListeners.forEach((cb) => cb(readJSON(AUTH_KEY, null)));

export function onAuth(cb) {
  authListeners.add(cb);
  queueMicrotask(() => cb(readJSON(AUTH_KEY, null)));
  return () => authListeners.delete(cb);
}

function setUser(user) {
  writeJSON(AUTH_KEY, user);
  emitAuth();
}

export async function signIn(email) {
  await dbx.delay(500);
  const existing = dbx.all("users").find((u) => u.email === email.trim().toLowerCase());
  const uid = existing?.id || `demo-${dbx.newId()}`;
  if (!existing) dbx.put("users", { id: uid, email: email.trim().toLowerCase(), name: "", userInformation: {} });
  setUser({ uid, email: email.trim().toLowerCase(), displayName: existing?.name || "" });
}

export async function signUp({ email, firstName, lastName, phone }) {
  await dbx.delay(600);
  const uid = `demo-${dbx.newId()}`;
  const name = `${firstName} ${lastName}`.trim();
  dbx.put("users", { id: uid, email: email.trim().toLowerCase(), name, userInformation: { firstName, lastName, phoneNumber: phone || "", email } });
  setUser({ uid, email: email.trim().toLowerCase(), displayName: name });
}

export async function signInWithGoogle() {
  await signUp({ email: "demo.google@example.com", firstName: "Demo", lastName: "Google", phone: "" });
}

/** Demo-only: sign in as the owner to explore the admin panel. */
export async function signInDemoAdmin() {
  await dbx.delay(300);
  setUser({ uid: OWNER_UIDS[0], email: "admin@demo.local", displayName: "Admin Demo" });
}

export const signOutUser = async () => setUser(null);
export const sendReset = async () => dbx.delay(400);

/* ------------------------------- Profile -------------------------------- */
export function subscribeProfile(uid, onData) {
  return dbx.subscribe("users", (list) => onData(list.find((u) => u.id === uid) || null));
}

export async function saveProfile(uid, patch) {
  await dbx.delay(300);
  const current = dbx.get("users", uid) || { id: uid };
  const merged = {
    ...current,
    ...patch,
    userInformation: { ...(current.userInformation || {}), ...(patch.userInformation || {}) },
    address: { ...(current.address || {}), ...(patch.address || {}) },
  };
  dbx.put("users", merged);
}

export async function listMine(kind, uid) {
  await dbx.delay(250);
  return dbx.all(kind).filter((r) => r.userId === uid);
}

export async function checkAdmin(uid) {
  return OWNER_UIDS.includes(uid);
}

export const resetDemo = dbx.resetDemo;
