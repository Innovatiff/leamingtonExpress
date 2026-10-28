// Demo admin API — same functions as src/services/firebase/admin.js.
import { staffSnapshot } from "@/lib/dispatch";
import * as dbx from "./db";

export const subscribeCollection = (name, onData) => dbx.subscribe(name, onData);

export async function updateRecord(name, id, patch) {
  await dbx.delay(250);
  const current = dbx.get(name, id);
  // Cancelling an order puts its items back in stock (the Cloud Function does this in production)
  if (name === "orders" && patch.status === "Cancelled" && current?.status !== "Cancelled" && current?.inventoryApplied) {
    for (const line of current.products || []) {
      const raw = dbx.get("products", line.docId);
      if (raw && raw.stock != null) dbx.patch("products", line.docId, { stock: Number(raw.stock) + Number(line.quantity || 0) });
    }
    patch = { ...patch, inventoryApplied: false };
  }
  dbx.patch(name, id, patch);
}

export async function deleteRecord(name, id) {
  await dbx.delay(250);
  dbx.remove(name, id);
}

export async function saveProduct(id, publicData, privateData) {
  await dbx.delay(400);
  let productId = id;
  if (id) {
    const current = dbx.get("products", id) || { id };
    const next = { ...current, ...publicData, updatedAt: dbx.nowTs() };
    if (privateData) ["sourceName", "sourceLink", "stockLocation"].forEach((k) => delete next[k]);
    dbx.put("products", next);
  } else {
    productId = dbx.newId();
    dbx.put("products", { id: productId, ...publicData, performance: 0, createdAt: dbx.nowTs(), updatedAt: dbx.nowTs() });
  }
  if (privateData) {
    const current = dbx.get("productsPrivate", productId) || { id: productId };
    dbx.put("productsPrivate", { ...current, ...privateData, updatedAt: dbx.nowTs() });
  }
  return productId;
}

export async function deleteProduct(id) {
  await dbx.delay(250);
  dbx.remove("products", id);
  dbx.remove("productsPrivate", id);
}

export function hasExposedPrivateData(raw) {
  return raw?.pricing?.cost !== undefined || ["sourceName", "sourceLink", "stockLocation"].some((f) => raw?.[f] !== undefined);
}

export async function migratePrivateFields(rawProducts) {
  const todo = rawProducts.filter(hasExposedPrivateData);
  for (const p of todo) {
    const { pricing = {}, sourceName, sourceLink, stockLocation, ...rest } = p;
    const { cost, profitRange: _pr, ...pricingRest } = pricing;
    dbx.put("productsPrivate", { id: p.id, cost: Number(cost) || 0, sourceName: sourceName || "", sourceLink: sourceLink || "", stockLocation: stockLocation || "" });
    dbx.put("products", { ...rest, pricing: pricingRest });
  }
  return todo.length;
}

export async function saveTrip(id, data) {
  await dbx.delay(300);
  dbx.put("trips", { ...data, id, updatedAt: dbx.nowTs() });
}

export async function seedTrips(trips) {
  await dbx.delay(500);
  trips.forEach((t) => dbx.put("trips", { ...t, updatedAt: dbx.nowTs() }));
}

export async function saveDiscount(id, data) {
  await dbx.delay(250);
  if (id) dbx.patch("discounts", id, data);
  else dbx.put("discounts", { id: dbx.newId(), ...data, createdAt: dbx.nowTs() });
}

export async function saveSettings(cityId, data) {
  await dbx.delay(300);
  const current = dbx.get("settings", cityId) || { id: cityId };
  dbx.put("settings", deepMerge(current, data));
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(a?.[k] || {}, v) : v;
  }
  return out;
}

/* ------------------------------ Employees ------------------------------- */
export async function saveStaff(input) {
  await dbx.delay(500);
  const email = String(input.email || "").trim().toLowerCase();
  const clash = dbx.all("staff").find((s) => s.email === email && s.id !== input.uid);
  if (clash) throw Object.assign(new Error("Email already used by another employee"), { code: "functions/already-exists", details: { reason: "EMAIL_TAKEN" } });
  const { password: _pw, uid, ...data } = input;
  const id = uid || `demo-staff-${dbx.newId()}`;
  const current = dbx.get("staff", id) || { id, uid: id, online: false, createdAt: dbx.nowTs() };
  dbx.put("staff", { ...current, ...data, email, id, uid: id, updatedAt: dbx.nowTs() });
  return { uid: id };
}

export async function deleteStaff(uid) {
  await dbx.delay(300);
  dbx.remove("staff", uid);
  return { ok: true };
}

/* -------------------------------- Dispatch ------------------------------ */
export async function assignRide(id, staff) {
  await dbx.delay(250);
  dbx.patch(
    "rides",
    id,
    staff
      ? { driverUid: staff.uid, driver: staffSnapshot(staff), status: "assigned", assignedAt: dbx.nowTs() }
      : { driverUid: null, driver: null, status: "confirmed", assignedAt: null, arrivedAt: null },
  );
}

export async function assignDelivery(id, staff, fulfilment) {
  await dbx.delay(250);
  dbx.patch(
    "orders",
    id,
    staff
      ? { courierUid: staff.uid, courier: staffSnapshot(staff), courierAt: dbx.nowTs(), ...(fulfilment === "Unfulfilled" || !fulfilment ? { fulfilment: "Preparing" } : {}) }
      : { courierUid: null, courier: null, courierAt: null },
  );
}

export async function assignDeparture(ids, staff) {
  await dbx.delay(250);
  ids.forEach((id) =>
    dbx.patch(
      "bookings",
      id,
      staff ? { guideUid: staff.uid, guide: staffSnapshot(staff), tripStage: "assigned", guideAt: dbx.nowTs() } : { guideUid: null, guide: null, tripStage: "", guideAt: null },
    ),
  );
}

