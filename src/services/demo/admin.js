// Demo admin API — same functions as src/services/firebase/admin.js.
import * as dbx from "./db";

export const subscribeCollection = (name, onData) => dbx.subscribe(name, onData);

export async function updateRecord(name, id, patch) {
  await dbx.delay(250);
  dbx.patch(name, id, patch);
}

export async function deleteRecord(name, id) {
  await dbx.delay(250);
  dbx.remove(name, id);
}

export async function saveProduct(id, publicData, privateData) {
  await dbx.delay(400);
  let productId = id;
  if (id) dbx.patch("products", id, publicData);
  else {
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
