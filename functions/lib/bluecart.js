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

/** true / false, or null when the answer doesn't say */
function inStockOf(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (/out of stock|unavailable|not available|sold out|no disponible|agotado/i.test(v)) return false;
    if (/in stock|available|disponible/i.test(v)) return true;
  }
  return null;
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
  const list = Array.isArray(body?.search_results) ? body.search_results : Array.isArray(body?.category_results) ? body.category_results : [];
  return {
    items: list.map(searchItem).filter((x) => x.itemId && x.title),
    page: Number(first(body, ["pagination.current_page", "request_parameters.page"])) || 1,
    totalPages: Number(first(body, ["pagination.total_pages"])) || 0,
  };
}

/** type=product answer (with store_id) → what the import needs */
function productInfo(body) {
  const p = body?.product || {};
  const bb = p.buybox_winner || body?.buybox_winner || {};
  const availability = p.availability || bb.availability || body?.availability || {};
  const url = link(p.link);
  const images = [link(p.main_image), ...(Array.isArray(p.images) ? p.images.map(link) : [])].filter(Boolean);
  const cats = Array.isArray(p.categories) ? p.categories : Array.isArray(p.breadcrumbs) ? p.breadcrumbs : [];
  const bullets = Array.isArray(p.feature_bullets) ? p.feature_bullets.map(text).filter(Boolean).join("\n") : "";
  const inStock = inStockOf(first(availability, ["in_stock"])) ?? inStockOf(availability.raw) ?? inStockOf(first(p, ["in_stock"])) ?? null;
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
    aisle: text(typeof p.aisle === "string" ? p.aisle : first(p, ["aisle.location", "aisle.name", "aisle.raw"])),
    rating: Number(p.rating) || 0,
    reviews: Number(first(p, ["ratings_total", "reviews_total"])) || 0,
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
