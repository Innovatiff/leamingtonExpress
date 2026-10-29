// Demo admin API — same functions as src/services/firebase/admin.js.
import { staffSnapshot } from "@/lib/dispatch";
import * as dbx from "./db";
import { DEMO_PRODUCTS } from "./products";

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

/* ------------------------------- Pricing -------------------------------- */
export async function savePricing(data) {
  await dbx.delay(300);
  dbx.put("pricing", { ...(dbx.get("pricing", "default") || {}), ...data, id: "default", updatedAt: dbx.nowTs() });
}

export async function applyPrices(changes, onProgress) {
  await dbx.delay(300);
  const at = dbx.nowTs();
  dbx.putMany("products", changes.map((c) => ({ ...dbx.get("products", c.id), pricing: c.pricing, updatedAt: at })));
  dbx.putMany("productsPrivate", changes.map((c) => ({ ...(dbx.get("productsPrivate", c.id) || { id: c.id }), cost: c.cost, updatedAt: at })));
  onProgress?.(changes.length);
}

export async function importProducts(rows, onProgress) {
  await dbx.delay(400);
  const at = dbx.nowTs();
  const ids = rows.map((r) => r.id || dbx.newId());
  dbx.putMany(
    "products",
    rows.map((r, i) => (r.id ? { ...dbx.get("products", r.id), ...r.publicData, updatedAt: at } : { id: ids[i], ...r.publicData, performance: 0, createdAt: at, updatedAt: at })),
  );
  dbx.putMany("productsPrivate", rows.map((r, i) => ({ ...(dbx.get("productsPrivate", ids[i]) || {}), ...r.privateData, id: ids[i], updatedAt: at })));
  onProgress?.(rows.length);
  return ids;
}

export async function setProductsStatus(ids, status) {
  await dbx.delay(300);
  const at = dbx.nowTs();
  dbx.putMany("products", ids.map((id) => ({ ...dbx.get("products", id), status, updatedAt: at })));
}

export const publishCatalog = async () => ({ count: dbx.all("products").length });

/** The demo has no storage: photos stay where they are. */
export const copyPhotos = async (ids) => ({ items: ids.map((id) => ({ id, copied: 0, removed: 0, failed: 0 })) });

/* ------------------------- Walmart.ca (BlueCart) ------------------------ */
export async function saveIntegration(name, data) {
  await dbx.delay(250);
  dbx.put("integrations", { ...(dbx.get("integrations", name) || {}), ...data, id: name, updatedAt: dbx.nowTs() });
}

// The demo never calls BlueCart: sample walmart.ca answers, 100 free credits counting down
const SAMPLE = [
  ["Mainstays 12-Cup Programmable Coffee Maker", "Mainstays", 24.97, 29.97, "Home > Kitchen > Coffee makers", true, "A14"],
  ["Hamilton Beach 1.7L Electric Kettle", "Hamilton Beach", 29.88, 0, "Home > Kitchen > Kettles", true, "A15"],
  ["onn. 32\" HD Roku Smart TV", "onn.", 148, 178, "Electronics > TVs", true, "E2"],
  ["onn. Bluetooth Speaker", "onn.", 19.97, 0, "Electronics > Speakers", false, "E7"],
  ["Ninja Professional Blender 1000W", "Ninja", 99.97, 129.97, "Home > Kitchen > Blenders", true, "A18"],
  ["Hyper Tough 20V Cordless Drill", "Hyper Tough", 49.97, 0, "Home > Tools > Drills", true, "H3"],
  ["Ozark Trail 4-Person Dome Tent", "Ozark Trail", 59.97, 0, "Sports > Camping > Tents", null, ""],
  ["Better Homes & Gardens Throw Pillow", "Better Homes & Gardens", 12.97, 0, "Home > Decor > Pillows", true, "D9"],
  ["Equate Electric Toothbrush", "Equate", 24.96, 0, "Health > Oral care", true, "P4"],
  ["Paw Patrol Lookout Tower Playset", "Paw Patrol", 69.97, 89.97, "Toys > Playsets", false, "T1"],
  ["Mainstays 5-Piece Towel Set", "Mainstays", 19.97, 0, "Home > Bath > Towels", true, "D2"],
  ["Philips Hue White Smart Bulb 2-Pack", "Philips", 34.97, 0, "Electronics > Smart home", true, "E11"],
].map(([title, brand, price, wasPrice, category, inStock, aisle], i) => {
  const itemId = `60009000${String(i + 1).padStart(5, "0")}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const image = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length]?.images?.[0] || "";
  return { itemId, title, brand, price, wasPrice, category, inStock, aisle, link: `https://www.walmart.ca/en/ip/${slug}/${itemId}`, image };
});
const spend = (n) => {
  const left = Math.max(0, (dbx.get("integrations", "bluecart")?.credits ?? 100) - n);
  dbx.put("integrations", { ...(dbx.get("integrations", "bluecart") || { id: "bluecart" }), credits: left });
  return left;
};

// Sample stores for the demo's store finder (BlueCart has its own numbers for the real ones)
const SAMPLE_STORES = [
  { id: "9001", label: "Sample Supercentre · Erie St S · Leamington · ON" },
  { id: "9002", label: "Sample Supercentre · Walker Rd · Windsor · ON" },
  { id: "9003", label: "Sample Supercentre · Wellington Rd · London · ON" },
];

export async function walmart(action, data = {}) {
  await dbx.delay(600);
  if (action === "stores") {
    const q = String(data.query || "").toLowerCase();
    return { stores: SAMPLE_STORES.filter((s) => s.label.toLowerCase().includes(q)), total: SAMPLE_STORES.length };
  }
  const cfg = dbx.get("integrations", "bluecart") || {};
  if (!cfg.apiKey) throw Object.assign(new Error("Add your BlueCart API key first"), { code: "functions/failed-precondition", details: { reason: "NO_KEY" } });
  if (action === "search") {
    if (/^toys?$/i.test(String(data.term || "").trim())) {
      // like walmart.ca: a broad word opens a section with its parts
      const parts = ["Video games", "LEGO", "Dolls", "Playsets"];
      return { items: [], categories: parts.map((title) => ({ title, link: "" })), category: "Toys", page: 1, totalPages: 0, credits: spend(1) };
    }
    const words = String(data.term || "").toLowerCase().split(/\s+/).filter(Boolean);
    const items = SAMPLE.filter((x) => words.some((w) => `${x.title} ${x.category}`.toLowerCase().includes(w)));
    const page = Number(data.page) || 1;
    return { items: (items.length ? items : SAMPLE).slice((page - 1) * 8, page * 8).map(({ inStock: _s, aisle: _a, category: _c, ...x }) => x), page, totalPages: 2, credits: spend(1) };
  }
  if (action === "products") {
    const mode = cfg.stockBy === "postal" ? "postal" : "store";
    if (mode === "store" ? !cfg.storeId : !cfg.postalCode) throw Object.assign(new Error("Add your Walmart store first"), { code: "functions/failed-precondition", details: { reason: "NO_STORE" } });
    const ids = (data.itemIds || []).slice(0, 9);
    const items = ids.map((itemId) => {
      const x = SAMPLE.find((s) => s.itemId === itemId);
      if (!x) return { itemId, ok: false, error: "Item not found" };
      const said = mode === "postal" ? { stockNote: `product.fulfillment.pickup=${x.inStock}, product.fulfillment.pickup_information=${x.inStock ? "Pickup today at Sample Supercentre" : "Not available"}` } : {};
      return { itemId, ok: true, product: { ...x, ...said, images: [x.image], description: `${x.title}. Sample description.`, rating: 0, reviews: 0 } };
    });
    return { items, credits: spend(ids.length), mode };
  }
  throw new Error("Unknown action");
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

