"use strict";

// Walmart.ca product data through the BlueCart API (Traject Data):
// https://docs.trajectdata.com/bluecartapi — type=search finds products (no
// store stock on walmart.ca); type=product with the store's store_id gives one
// product with the stock and aisle at that store. Every request uses a credit.
// The answers are read defensively: several field names are accepted for each value.

const BASE = process.env.BLUECART_URL || "https://api.bluecartapi.com/request";

const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function first(obj, paths) {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** 12.97 · "$12.97" · { value: 12.97 } → 12.97 (0 = none) */
function amount(v) {
  if (v && typeof v === "object") return amount(v.value ?? v.amount ?? v.price ?? v.raw);
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : typeof v === "number" ? String(v) : "");
const link = (v) => {
  const s = typeof v === "string" ? v : v && typeof v === "object" ? v.link || v.url || v.src || "" : "";
  return /^https?:\/\//.test(s) ? s : "";
};

/** true / false, or null when the answer doesn't say ("IN_STOCK", "Out of stock", 3, …) */
function inStockOf(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v > 0;
  if (typeof v === "string") {
    const s = v.replace(/[_-]+/g, " ");
    if (/out of stock|not in stock|unavailable|not available|sold out|no disponible|agotado|en rupture/i.test(s)) return false;
    if (/(shipping|online|delivery) only|not sold in stores?/i.test(s)) return false; // not on the store's shelves
    if (/in stock|available|disponible|limited stock|low stock|only \d+ left|en stock/i.test(s)) return true;
  }
  return null;
}

// Where an answer may say whether the product is in stock (the store's, with store_id)
const STOCK_PATHS = [
  "availability.in_stock", "in_stock", "is_in_stock", "inventory.in_stock", "store_availability.in_stock",
  "availability.raw", "availability.status", "availability", "availability_status", "stock_status",
  "inventory.status", "inventory.quantity", "store_availability.raw", "store_availability.status",
];
const AISLE_PATHS = ["aisle", "aisle.location", "aisle.name", "aisle.raw", "location.aisle", "store_location.aisle", "in_store.aisle", "store_availability.aisle"];

/** Fields that look like stock information, as "path=value" (shown when the stock can't be read, to adapt this file) */
function stockHints(obj, path = "", out = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 3) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (out.length >= 4) break;
    const here = path ? `${path}.${k}` : k;
    const plain = v === null || typeof v !== "object" || (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"));
    if (plain && /stock|avail|fulfil|pickup|inventory|aisle|store/i.test(k)) out.push(`${here}=${String(Array.isArray(v) ? v.join("|") : v).slice(0, 40)}`);
    else if (!plain && !Array.isArray(v)) stockHints(v, here, out, depth + 1);
  }
  return out;
}

/** walmart.ca/en/ip/<name>/<item id> → item id */
function itemIdFrom(url) {
  const m = String(url || "").match(/\/ip\/(?:[^/?#]+\/)?([A-Za-z0-9]+)(?:[/?#]|$)/);
  return m ? m[1].toUpperCase() : "";
}

function searchItem(r) {
  const p = r.product || r;
  const url = link(first(p, ["link", "url"]) || r.link);
  return {
    itemId: text(first(p, ["item_id", "us_item_id", "product_id", "id"])) || itemIdFrom(url),
    title: text(first(p, ["title", "name"])),
    link: url,
    image: link(first(p, ["main_image", "image", "thumbnail", "images.0"])),
    brand: text(p.brand),
    price: amount(first(r, ["offers.primary.price", "price", "product.price", "buybox_winner.price"])),
    wasPrice: amount(first(r, ["offers.primary.was_price", "was_price", "product.was_price", "buybox_winner.was_price"])),
    rating: Number(first(p, ["rating"])) || 0,
    reviews: Number(first(p, ["ratings_total", "reviews_total", "reviews"])) || 0,
  };
}

/** type=search answer → { items, page, totalPages } */
function searchResults(body) {
  const list = ["search_results", "category_results", "results", "products"].map((k) => body?.[k]).find(Array.isArray) || [];
  const items = list.map(searchItem).filter((x) => x.itemId && x.title);
  return {
    items,
    page: Number(first(body, ["pagination.current_page", "request_parameters.page"])) || 1,
    totalPages: Number(first(body, ["pagination.total_pages"])) || 0,
    found: list.length,
    // nothing readable: the field names of what came back, to adapt this file
    ...(items.length ? {} : { keys: Object.keys((list.length ? list[0] : body) || {}).slice(0, 12) }),
  };
}

/** type=product answer (with store_id) → what the import needs */
function productInfo(body) {
  const p = body?.product || {};
  const bb = p.buybox_winner || body?.buybox_winner || {};
  const url = link(p.link);
  const images = [link(p.main_image), ...(Array.isArray(p.images) ? p.images.map(link) : [])].filter(Boolean);
  const cats = Array.isArray(p.categories) ? p.categories : Array.isArray(p.breadcrumbs) ? p.breadcrumbs : [];
  const bullets = Array.isArray(p.feature_bullets) ? p.feature_bullets.map(text).filter(Boolean).join("\n") : "";
  let inStock = null;
  for (const where of [p, bb, body || {}]) {
    for (const path of STOCK_PATHS) {
      if (inStock === null) inStock = inStockOf(get(where, path));
    }
  }
  const aisle = AISLE_PATHS.map((path) => get(p, path)).find((v) => (typeof v === "string" && v.trim()) || (Array.isArray(v) && v.length));
  return {
    itemId: text(first(p, ["item_id", "us_item_id"])) || itemIdFrom(url),
    title: text(p.title),
    link: url,
    images: [...new Set(images)].slice(0, 8),
    brand: text(p.brand),
    description: text(first(p, ["description", "description_full", "short_description"])) || bullets,
    category: cats.map((c) => text(typeof c === "string" ? c : c?.name)).filter(Boolean).join(" > "),
    price: amount(first(bb, ["price"]) ?? p.price),
    wasPrice: amount(first(bb, ["was_price"]) ?? p.was_price),
    inStock,
    aisle: Array.isArray(aisle) ? aisle.map((x) => text(typeof x === "string" ? x : x?.name || x?.location || x?.raw)).filter(Boolean).join(", ") : text(aisle),
    rating: Number(p.rating) || 0,
    reviews: Number(first(p, ["ratings_total", "reviews_total"])) || 0,
    ...(inStock === null ? { stockNote: stockHints(body?.product ? body : { product: p }).join(", ").slice(0, 200) } : {}),
  };
}

const creditsLeft = (body) => {
  const n = Number(first(body, ["request_info.credits_remaining"]));
  return Number.isFinite(n) ? n : null;
};

/** One BlueCart request on walmart.ca → its JSON (throws an Error with `status` and BlueCart's message). */
async function bluecart(apiKey, params, { fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  const url = new URL(BASE);
  url.search = new URLSearchParams({ api_key: apiKey, walmart_domain: "walmart.ca", ...params }).toString();
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || body?.request_info?.success === false) {
    const err = new Error(text(body?.request_info?.message) || text(body?.message) || `BlueCart answered ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

module.exports = { bluecart, searchResults, productInfo, creditsLeft, itemIdFrom };
