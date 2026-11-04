// Products → Check suppliers: every product with its supplier link and price, to confirm
// it's still available (for pickup today at Walmart) and still costs the same. What a check
// changes on the product. Plain functions (relative imports with extensions) so tests can
// use them.
import { sellingPrices } from "../../lib/margin.js";

const DAY = 24 * 60 * 60 * 1000;

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && "seconds" in v) return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};

/** Checked since midnight (local time) */
export function checkedToday(checkedAt, now = Date.now()) {
  const t = toMillis(checkedAt);
  if (!t) return false;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return t >= midnight.getTime();
}

/** "today", "yesterday", "3 days ago", "never" */
export function checkedLabel(checkedAt, now = Date.now()) {
  const t = toMillis(checkedAt);
  if (!t) return "never";
  if (checkedToday(t, now)) return "today";
  const days = Math.max(1, Math.round((now - t) / DAY));
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/**
 * What saving a check writes (merged into the product and its private data).
 * input = { supplierPrice, supplierRegular, status: "active" | "hidden" | undefined }
 * Prices: with "Automatic price" on, the store price follows the rules; otherwise only the
 * supplier's price is noted (your price stays as you typed it).
 */
export function checkUpdate(raw, priv, input, rules, now = new Date()) {
  const supplierPrice = input.supplierPrice === undefined ? money(priv?.supplierPrice) : money(input.supplierPrice);
  const regularIn = input.supplierRegular === undefined ? money(priv?.supplierRegular) : money(input.supplierRegular);
  const supplierRegular = regularIn > supplierPrice ? regularIn : 0;
  const privateData = { supplierPrice, supplierRegular, checkedAt: now };
  const publicData = {};
  if (priv?.autoPrice && supplierPrice > 0) {
    const prices = sellingPrices({ supplier: priv.supplier || "other", supplierPrice, supplierRegular, offerPct: Number(priv.offerPct) || 0 }, rules);
    if (prices) {
      publicData.pricing = { price: prices.price, currentPrice: prices.currentPrice };
      privateData.cost = prices.cost;
    }
  }
  if (input.status === "hidden" || input.status === "active") {
    publicData.status = input.status;
    // back on sale: a product marked sold out (0 units) can be bought again
    if (input.status === "active" && raw?.stock !== null && raw?.stock !== undefined && Number(raw.stock) <= 0) publicData.stock = null;
  }
  return { publicData, privateData };
}

/** The price your store would show for these supplier prices (null without one). */
export function previewPrice(priv, supplierPrice, supplierRegular, rules) {
  const now = money(supplierPrice);
  if (!priv?.autoPrice || !(now > 0)) return null;
  const was = money(supplierRegular);
  const p = sellingPrices({ supplier: priv.supplier || "other", supplierPrice: now, supplierRegular: was > now ? was : 0, offerPct: Number(priv.offerPct) || 0 }, rules);
  return p ? p.currentPrice || p.price : null;
}

/** Products in checking order: never checked first, then the longest ago; newest first among equals. */
export function checkOrder(rows) {
  return [...rows].sort((a, b) => toMillis(a.priv?.checkedAt) - toMillis(b.priv?.checkedAt) || toMillis(b.raw?.createdAt) - toMillis(a.raw?.createdAt));
}
