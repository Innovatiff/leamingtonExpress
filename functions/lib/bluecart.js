"use strict";

// Walmart.ca product data through the BlueCart API (Traject Data):
// https://docs.trajectdata.com/bluecartapi — type=search finds products (no
// store stock on walmart.ca); type=product with the store's store_id gives one
// product with the stock and aisle at that store. Every request uses a credit.
// The answers are read defensively: several field names are accepted for each value.

const BASE = process.env.BLUECART_URL || "https://api.bluecartapi.com/request";
// The stores BlueCart accepts as store_id (walmart.ca ones included); reading it costs no request
const STORES_URL = process.env.BLUECART_STORES_URL || "https://data.bluecartapi.com/walmart-stores.json";

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

const productLike = (x) => Boolean(x) && typeof x === "object" && ("product" in x || "item_id" in x || ("title" in x && ("link" in x || "price" in x)));

/** The results of a search answer: where BlueCart usually puts them, or the first list of product-like entries */
function resultList(body) {
  const usual = ["search_results", "category_results", "results", "products", "organic_results", "items"].map((k) => body?.[k]).find((v) => Array.isArray(v) && v.length);
  if (usual) return usual;
  for (const v of Object.values(body || {})) {
    if (Array.isArray(v) && v.some(productLike)) return v;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = Object.values(v).find((w) => Array.isArray(w) && w.some(productLike));
      if (inner) return inner;
    }
  }
  return [];
}

/** What BlueCart answered, in short (never the key), for when nothing in it could be read */
function answerSummary(body, sample) {
  return {
    fields: Object.keys(body || {}).slice(0, 15),
    message: text(get(body, "request_info.message") || body?.message || ""),
    page: link(first(body, ["request_metadata.walmart_url", "request_metadata.url", "search_metadata.walmart_url"])),
    total: Number(first(body, ["pagination.total_results", "search_information.total_results"])) || 0,
    sample: String(JSON.stringify(sample ?? null) || "").slice(0, 600),
  };
}

/** type=search answer → { items, page, totalPages, found } (+ answer when nothing could be read) */
function searchResults(body) {
  const list = resultList(body);
  const items = list.map(searchItem).filter((x) => x.itemId && x.title);
  return {
    items,
    page: Number(first(body, ["pagination.current_page", "request_parameters.page"])) || 1,
    totalPages: Number(first(body, ["pagination.total_pages"])) || 0,
    found: list.length,
    ...(items.length ? {} : { answer: answerSummary(body, list.length ? list[0] : body?.search_results) }),
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
  const title = text(first(p, ["title", "name"]));
  return {
    itemId: text(first(p, ["item_id", "us_item_id"])) || itemIdFrom(url),
    title,
    link: url,
    images: [...new Set(images)].slice(0, 8),
    brand: text(p.brand),
    description: text(first(p, ["description", "description_full", "short_description"])) || bullets,
    category: cats.map((c) => text(typeof c === "string" ? c : c?.name)).filter(Boolean).join(" > "),
    price: amount(first(bb, ["price"]) ?? first(p, ["price", "offers.primary.price", "current_price"]) ?? first(body, ["offers.primary.price"])),
    wasPrice: amount(first(bb, ["was_price"]) ?? first(p, ["was_price", "offers.primary.was_price"]) ?? first(body, ["offers.primary.was_price"])),
    inStock,
    aisle: Array.isArray(aisle) ? aisle.map((x) => text(typeof x === "string" ? x : x?.name || x?.location || x?.raw)).filter(Boolean).join(", ") : text(aisle),
    rating: Number(p.rating) || 0,
    reviews: Number(first(p, ["ratings_total", "reviews_total"])) || 0,
    ...(inStock === null ? { stockNote: stockHints(body?.product ? body : { product: p }).join(", ").slice(0, 200) } : {}),
    ...(title ? {} : { answer: answerSummary(body, body?.product) }),
  };
}

/* ------------------------------ Store list ------------------------------ */
const STORE_ID = ["store_id", "storeId", "store_number", "storeNumber", "id", "number"];
const STORE_LABEL = ["name", "store_name", "display_name", "address", "address1", "street", "street_address", "city", "state", "province", "zip", "zipcode", "postal_code", "postalCode"];
const isPlain = (v) => typeof v === "string" || typeof v === "number";

/** Every plain value of a store, a few levels down (for searching) */
function plainValues(node, depth = 0) {
  if (isPlain(node)) return [String(node)];
  if (!node || typeof node !== "object" || depth > 2) return [];
  return Object.values(node).flatMap((v) => plainValues(v, depth + 1));
}

/** "Leamington Supercentre · 304 Erie St S · Leamington · ON · N8H 3C5" */
function storeLabel(node) {
  const parts = STORE_LABEL.map((k) => node[k]).flatMap((v) => (isPlain(v) ? [String(v)] : v && typeof v === "object" ? plainValues(v) : []));
  return [...new Set((parts.length ? parts : plainValues(node)).map((x) => x.trim()).filter(Boolean))].join(" · ").slice(0, 160);
}

/**
 * BlueCart's list of Walmart stores, in whatever shape it comes (a list, lists by
 * domain, or stores keyed by their id) → [{ id, label, text }]
 */
function storeList(json) {
  const out = [];
  const add = (id, node, context) => {
    const label = typeof node === "string" ? node.slice(0, 160) : storeLabel(node);
    out.push({ id: String(id), label, text: ` ${[label, ...plainValues(node), context].join(" ").toLowerCase()} ` });
  };
  const walk = (node, context, depth) => {
    if (depth > 4 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x, context, depth + 1));
      return;
    }
    const id = first(node, STORE_ID);
    if (isPlain(id) && Object.values(node).filter(isPlain).length >= 2) {
      add(id, node, context);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (/^\d+$/.test(k) && (typeof v === "string" || (v && typeof v === "object" && !Array.isArray(v) && first(v, STORE_ID) === undefined))) add(k, v, context);
      else walk(v, `${context} ${k}`, depth + 1);
    }
  };
  walk(json, "", 0);
  return out;
}

/** The stores whose details have every word of the query (city, street, postal code…), Canadian ones first */
function findStores(list, query, limit = 20) {
  const words = String(query || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const canadian = (s) => /walmart\.ca|canada|\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe)\b|[a-z]\d[a-z] ?\d[a-z]\d/.test(s.text);
  return list
    .filter((s) => words.every((w) => s.text.includes(w)))
    .sort((a, b) => Number(canadian(b)) - Number(canadian(a)))
    .slice(0, limit)
    .map(({ id, label }) => ({ id, label }));
}

/** Download BlueCart's store list → storeList() */
async function walmartStores({ fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const res = await fetchImpl(STORES_URL, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`BlueCart's store list answered ${res.status}`), { status: res.status });
  return storeList(await res.json());
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

module.exports = { bluecart, searchResults, productInfo, creditsLeft, itemIdFrom, storeList, findStores, walmartStores };
