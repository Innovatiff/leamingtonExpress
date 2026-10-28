"use strict";

// Pure order logic shared by the Cloud Functions (no Firebase imports, so it
// can be tested with plain Node). Prices always come from the database —
// never from the browser.

const METHODS = ["cash", "etransfer", "card"];
const METHOD_LABEL = { cash: "Cash", etransfer: "E-transfer", card: "Debit / Credit Card" };
const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LINES = 50;
const MAX_QTY = 20;

const STORE_DEFAULTS = {
  enabled: true,
  deliveryFee: 5,
  freeDeliveryOver: 0,
  payments: { cash: true, etransfer: true, card: false },
};

/** "$1,299.99" | "10.00" | 12 → number (0 when invalid). */
function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clean = (v, max = 200) => String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const digits = (v) => String(v || "").replace(/\D/g, "");

function phone10(v) {
  const d = digits(v);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

class OrderError extends Error {
  /**
   * @param {string} code Firebase HttpsError code
   * @param {string} message
   * @param {object} details sent to the browser (reason + context)
   */
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Validate and normalize what the checkout page sends. */
function parseOrderInput(data) {
  const d = data && typeof data === "object" ? data : {};
  const bad = (field) => new OrderError("invalid-argument", `Invalid ${field}`, { reason: "INVALID_INPUT", field });

  const city = clean(d.city, 40).toLowerCase() || "leamington";
  if (!/^[a-z-]{2,40}$/.test(city)) throw bad("city");

  if (!Array.isArray(d.items) || !d.items.length || d.items.length > MAX_LINES) throw bad("items");
  const merged = new Map();
  for (const it of d.items) {
    const id = clean(it && it.id, 128);
    const variant = clean(it && it.variant, 80);
    const qty = Math.floor(Number(it && it.qty));
    if (!id || id.includes("/") || !(qty >= 1)) throw bad("items");
    const key = JSON.stringify([id, variant]);
    const prev = merged.get(key);
    merged.set(key, { id, variant, qty: Math.min(MAX_QTY, (prev ? prev.qty : 0) + qty) });
  }

  const c = d.customer || {};
  const customer = {
    firstName: clean(c.firstName, 60),
    lastName: clean(c.lastName, 60),
    phone: phone10(c.phone),
    email: clean(c.email, 120).toLowerCase(),
  };
  if (customer.firstName.length < 2) throw bad("firstName");
  if (customer.phone.length !== 10) throw bad("phone");
  if (customer.email && !EMAIL_RE.test(customer.email)) throw bad("email");

  const a = d.address || {};
  const address = {
    street: clean(a.street, 120),
    unit: clean(a.unit, 30),
    town: clean(a.town, 60),
    postalCode: clean(a.postalCode, 7).toUpperCase(),
    notes: clean(a.notes, 300),
  };
  if (address.street.length < 3) throw bad("street");
  if (address.town.length < 2) throw bad("town");
  if (!POSTAL_RE.test(address.postalCode)) throw bad("postalCode");
  if (address.postalCode.length === 6) address.postalCode = `${address.postalCode.slice(0, 3)} ${address.postalCode.slice(3)}`;

  const paymentMethod = METHODS.includes(d.paymentMethod) ? d.paymentMethod : null;
  if (!paymentMethod) throw bad("paymentMethod");

  return {
    city,
    lang: d.lang === "en" ? "en" : "es",
    items: [...merged.values()],
    customer,
    address,
    paymentMethod,
    discountCode: clean(d.discountCode, 40),
    returnUrl: clean(d.returnUrl, 200),
  };
}

/** Selling price the store shows: sale price when set, otherwise the regular price. */
function productPrice(raw) {
  const pricing = raw && typeof raw.pricing === "object" && raw.pricing ? raw.pricing : {};
  const regular = parseMoney(pricing.price !== undefined ? pricing.price : raw.price);
  const current = parseMoney(pricing.currentPrice !== undefined ? pricing.currentPrice : raw.currentPrice);
  const price = round2(current > 0 ? current : regular);
  return { price, oldPrice: regular > price ? round2(regular) : price };
}

/** Can this product be bought on this city's site? */
function isSellable(raw, city) {
  if (!raw) return false;
  if (raw.hidden || (raw.status && raw.status !== "active")) return false;
  if (!(productPrice(raw).price > 0)) return false;
  return !Array.isArray(raw.cities) || !raw.cities.length || raw.cities.includes(city);
}

const stockOf = (raw) => (raw.stock === null || raw.stock === undefined || raw.stock === "" ? null : Math.max(0, Math.floor(Number(raw.stock) || 0)));

function variantsOf(raw) {
  const v = raw.variants !== undefined ? raw.variants : raw.variant;
  if (Array.isArray(v)) return v.map((x) => clean(x, 80)).filter(Boolean);
  return String(v || "").split(/[,|]/).map((x) => clean(x, 80)).filter(Boolean);
}

const UNIT_HOURS = { minutes: 1 / 60, hours: 1, days: 24, weeks: 168, months: 720 };

/**
 * Turn cart items + product docs into order lines.
 * @param {Array} items parsed items
 * @param {Map<string, object>} products id → product data (missing = deleted)
 * @param {string} city
 * @return {{lines: Array, productsTotal: number, totalSaved: number, points: number, delivery: object}}
 */
function buildLines(items, products, city) {
  const lines = [];
  const needed = new Map();
  let longest = { count: 0, unit: "hours", hours: -1 };
  for (const item of items) {
    const raw = products.get(item.id);
    if (!isSellable(raw, city)) {
      throw new OrderError("not-found", "Product not available", { reason: "PRODUCT_NOT_FOUND", productId: item.id });
    }
    const options = variantsOf(raw);
    if (options.length && !options.includes(item.variant)) {
      throw new OrderError("invalid-argument", "Choose an option", { reason: "VARIANT_REQUIRED", productId: item.id });
    }
    needed.set(item.id, (needed.get(item.id) || 0) + item.qty);
    const stock = stockOf(raw);
    if (stock !== null && stock < needed.get(item.id)) {
      throw new OrderError("failed-precondition", "Not enough stock", {
        reason: "OUT_OF_STOCK",
        productId: item.id,
        available: Math.max(0, stock - (needed.get(item.id) - item.qty)),
      });
    }
    const { price, oldPrice } = productPrice(raw);
    const delivery = raw.delivery && typeof raw.delivery === "object" ? raw.delivery : {};
    const unit = UNIT_HOURS[delivery.unit] ? delivery.unit : "hours";
    const count = Math.max(0, Number(delivery.count) || 0);
    const hours = count * UNIT_HOURS[unit];
    if (hours > longest.hours) longest = { count, unit, hours };
    lines.push({
      docId: item.id,
      productId: clean(raw.productId, 40),
      name: clean(raw.name || raw.productName, 160) || "Producto",
      image: Array.isArray(raw.images) && typeof raw.images[0] === "string" && /^https?:/.test(raw.images[0]) ? raw.images[0] : "",
      category: clean(raw.category, 60),
      brand: clean(raw.brand, 60),
      origin: clean(raw.origin, 60),
      sku: clean(raw.sku, 40),
      variant: item.variant,
      quantity: item.qty,
      price,
      oldPrice,
      lineTotal: round2(price * item.qty),
      lineSaved: round2((oldPrice - price) * item.qty),
      points: Math.max(0, Math.floor(Number(raw.expressPoints) || 0)),
      delivery: { count, unit },
    });
  }
  return {
    lines,
    productsTotal: round2(lines.reduce((s, l) => s + l.lineTotal, 0)),
    totalSaved: round2(lines.reduce((s, l) => s + l.lineSaved, 0)),
    points: lines.reduce((s, l) => s + l.points * l.quantity, 0),
    delivery: { count: longest.count, unit: longest.unit, label: `${longest.count} ${longest.unit}` },
  };
}

/** Find a code ignoring upper/lower case (old codes were typed freely). */
function findCode(codes, code) {
  const wanted = clean(code, 40).toLowerCase();
  if (!wanted) return null;
  return codes.find((c) => clean(c.Code, 40).toLowerCase() === wanted) || null;
}

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && "seconds" in v) return Number(v.seconds) * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Is the discount code usable for this purchase?
 * Fields: Code, Discount ("10.00"), Reusable, active, expiresAt, minSubtotal, usedCount/used.
 * @return {{valid: boolean, amount: number, reason: string, code: string}}
 */
function evaluateDiscount(codeDoc, productsTotal, now = Date.now()) {
  if (!codeDoc) return { valid: false, amount: 0, reason: "invalid", code: "" };
  const code = clean(codeDoc.Code, 40);
  if (codeDoc.active === false) return { valid: false, amount: 0, reason: "inactive", code };
  const expires = toMillis(codeDoc.expiresAt);
  if (expires && expires < now) return { valid: false, amount: 0, reason: "expired", code };
  if (!codeDoc.Reusable && (Number(codeDoc.usedCount) > 0 || codeDoc.used === true)) return { valid: false, amount: 0, reason: "used", code };
  const min = parseMoney(codeDoc.minSubtotal);
  if (min > 0 && productsTotal < min) return { valid: false, amount: 0, reason: "minimum", code, minSubtotal: min };
  const amount = round2(Math.min(parseMoney(codeDoc.Discount), productsTotal));
  if (!(amount > 0)) return { valid: false, amount: 0, reason: "invalid", code };
  return { valid: true, amount, reason: "", code };
}

function storeSettings(settingsDoc) {
  const s = (settingsDoc && settingsDoc.store) || {};
  return {
    enabled: s.enabled !== false,
    deliveryFee: s.deliveryFee === undefined ? STORE_DEFAULTS.deliveryFee : Math.max(0, parseMoney(s.deliveryFee)),
    freeDeliveryOver: Math.max(0, parseMoney(s.freeDeliveryOver)),
    payments: { ...STORE_DEFAULTS.payments, ...(s.payments || {}) },
  };
}

/** Free delivery is judged on the products' subtotal, before any discount code (same as the cart shows). */
function deliveryFee(store, productsTotal) {
  if (store.freeDeliveryOver > 0 && productsTotal >= store.freeDeliveryOver) return 0;
  return round2(store.deliveryFee);
}

module.exports = {
  METHOD_LABEL,
  OrderError,
  parseMoney,
  round2,
  clean,
  phone10,
  parseOrderInput,
  productPrice,
  isSellable,
  stockOf,
  buildLines,
  findCode,
  evaluateDiscount,
  storeSettings,
  deliveryFee,
  toMillis,
};
