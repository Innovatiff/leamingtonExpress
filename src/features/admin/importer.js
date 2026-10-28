// Product import: read a spreadsheet (CSV/TSV) or a JSON export from a product
// data service, match its columns to our fields, and turn each row into a
// product with automatic prices. Pure functions — the page is ProductImport.jsx.
import { sellingPrices, SUPPLIERS } from "@/lib/margin";

/* ------------------------------- Reading -------------------------------- */

/** CSV / TSV / semicolon text → rows of cells (quotes, "" escapes and line breaks inside quotes). */
export function parseDelimited(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0];
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = [",", "\t", ";"].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Nested JSON → flat keys ("price.current", "images" joined with " | "). */
function flatten(value, prefix = "", out = {}) {
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== "object")) out[prefix] = value.filter((v) => v != null && v !== "").join(" | ");
    else value.slice(0, 5).forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) out[prefix] = value == null ? "" : String(value);
  return out;
}

/** Text from a file or pasted → { columns, records } (records are { column: text }). */
export function parseTable(text) {
  const t = String(text || "").trim();
  if (!t) return { columns: [], records: [] };
  if (t.startsWith("[") || t.startsWith("{")) {
    const data = JSON.parse(t);
    const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray) || [data];
    const records = list.filter((x) => x && typeof x === "object").map((x) => flatten(x));
    const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];
    return { columns, records };
  }
  const [header = [], ...rows] = parseDelimited(t);
  const columns = header.map((h, i) => h.trim() || `Column ${i + 1}`);
  const records = rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? "").trim()])));
  return { columns, records };
}

/* ------------------------------- Columns -------------------------------- */

// `guess`: column names that usually hold it (Keepa and BlueCart exports
// included), best first. `avoid`: words that mean it's another column.
export const FIELDS = [
  { key: "name", label: "Name", required: true, guess: ["name", "title", "product name", "product title"], avoid: ["brand", "seller", "category", "store", "variant"] },
  {
    key: "supplierPrice",
    label: "Supplier price",
    required: true,
    guess: ["price", "current price", "buy box current", "amazon current", "new current", "offers primary price", "primary price", "sale price", "offer price", "price current", "price value", "price amount", "price now"],
    avoid: ["was", "list", "regular", "original", "before", "avg", "average", "lowest", "highest", "drop", "rrp", "unit", "shipping", "currency", "symbol", "raw", "used"],
  },
  {
    key: "supplierRegular",
    label: "Their regular price",
    // a price they really charged before (not a "list price" suggested by the maker)
    guess: ["was price", "offers primary was price", "primary was price", "regular price", "original price", "price was", "price regular", "price before"],
    avoid: ["avg", "average", "lowest", "highest", "raw", "currency", "symbol", "list"],
  },
  { key: "link", label: "Link", guess: ["url", "link", "product url", "product link", "url amazon", "canonical url"], avoid: ["image", "img", "photo", "seller", "review", "brand", "category", "video"] },
  { key: "images", label: "Photo(s)", guess: ["images", "image", "main image link", "main image", "image url", "image link", "primary image", "thumbnail", "images 0", "image 0"], avoid: ["count", "alt"] },
  { key: "brand", label: "Brand", guess: ["brand", "brand name", "manufacturer"], avoid: ["link", "url", "id", "store"] },
  { key: "category", label: "Category", guess: ["categories tree", "category", "categories", "category path", "breadcrumbs", "categories sub", "product type", "category name"], avoid: ["id", "root", "url", "link"] },
  { key: "department", label: "Department", guess: ["department", "categories root", "dept", "department name"], avoid: ["id"] },
  { key: "description", label: "Description", guess: ["description", "short description", "about", "features", "feature bullets", "highlights"] },
  { key: "available", label: "In stock", guess: ["in stock", "inventory in stock", "availability", "available", "stock status", "is in stock", "availability status", "stock"], avoid: ["date", "quantity", "count"] },
  { key: "stars", label: "Rating", guess: ["rating", "reviews rating", "stars", "average rating", "rating average"], avoid: ["count", "total", "number", "breakdown"] },
  { key: "reviews", label: "Number of reviews", guess: ["reviews review count", "ratings total", "reviews", "reviews count", "review count", "number of reviews", "rating count", "reviews total"] },
  { key: "sku", label: "Item ID / SKU / ASIN", guess: ["asin", "sku", "item id", "us item id", "product id", "upc", "gtin", "id"], avoid: ["parent", "variation", "seller", "category"] },
];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const hasWords = (text, words) => ` ${text} `.includes(` ${words} `);

/** How likely a column holds this field (0 = not at all). */
function score(column, field) {
  const c = norm(column);
  if (!c || (field.avoid || []).some((w) => hasWords(c, w))) return 0;
  let best = 0;
  field.guess.forEach((g, i) => {
    const rank = field.guess.length - i; // earlier guesses win ties
    if (c === g) best = Math.max(best, 300 + rank);
    else if (c.endsWith(` ${g}`)) best = Math.max(best, 200 + rank);
    else if (g.length > 3 && hasWords(c, g)) best = Math.max(best, 100 + rank);
  });
  return best;
}

/** Our field → the file's column it most likely comes from ("" = none). */
export function guessMapping(columns) {
  const taken = new Set();
  const map = {};
  for (const f of FIELDS) {
    let pick = "";
    let top = 0;
    for (const c of columns) {
      const v = taken.has(c) ? 0 : score(c, f);
      if (v > top) [pick, top] = [c, v];
    }
    map[f.key] = pick;
    if (pick) taken.add(pick);
  }
  return map;
}

/** Remembering the columns chosen for a file layout (same export, same columns). */
export function mappingKey(columns) {
  let h = 5381;
  for (const ch of columns.join("\u0001")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `lx_import_map_${h.toString(36)}`;
}

/* ------------------------------- Products ------------------------------- */

const money = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};
const yes = (v) => {
  const t = norm(v);
  if (!t) return null; // not given
  if (/^(false|no|0|out of stock|outofstock|out stock|unavailable|not available|sold out)$/.test(t) || t.includes("out of stock")) return false;
  return true;
};

/** walmart.ca / amazon.ca link → { supplier, itemId } */
export function supplierFromLink(link) {
  const url = String(link || "");
  const walmart = url.match(/walmart\.(?:ca|com)\/(?:[a-z]{2}\/)?ip\/(?:[^/?#]+\/)?([A-Za-z0-9]+)/i);
  if (walmart) return { supplier: "walmart", itemId: walmart[1].toUpperCase() };
  const amazon = url.match(/amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (amazon) return { supplier: "amazon", itemId: amazon[1].toUpperCase() };
  if (/walmart\./i.test(url)) return { supplier: "walmart", itemId: "" };
  if (/amazon\.|amzn\./i.test(url)) return { supplier: "amazon", itemId: "" };
  return { supplier: "", itemId: "" };
}

/** The same link written differently (tracking parameters, http, trailing /) → one key. */
export const linkKey = (link) => {
  const s = String(link || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
};

/** "Electronics > TV & Video > TVs" → { department: "Electronics", category: "TVs" } */
function splitCategory(text) {
  const parts = String(text || "")
    .split(/\s*(?:>|\/|\||›|»)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { department: "", category: parts[0] || "" };
  return { department: parts[0], category: parts.at(-1) };
}

const newProductId = () => String(10000000 + Math.floor(Math.random() * 89999999));

/**
 * File rows → import plan. options = { mapping, supplier (default), department,
 * category, publish, onlyPrices (for products we already have), skipOutOfStock }.
 * existing = { byLink: Map, byItem: Map, bySku: Map } → { id, raw, priv }.
 */
export function planImport(records, options, existing, rules) {
  const { mapping } = options;
  const get = (r, key) => (mapping[key] ? String(r[mapping[key]] ?? "").trim() : "");
  const seen = new Set();
  return records.map((r, index) => {
    const name = get(r, "name");
    const supplierPrice = money(get(r, "supplierPrice"));
    const link = get(r, "link");
    const fromLink = supplierFromLink(link);
    const supplier = fromLink.supplier || options.supplier;
    const sku = get(r, "sku");
    const itemId = fromLink.itemId || (supplier === "amazon" && /^[A-Z0-9]{10}$/i.test(sku) ? sku.toUpperCase() : "");
    const available = yes(get(r, "available"));
    const base = { index, name: name || "(no name)", link, supplier };

    if (!name) return { ...base, action: "skip", reason: "No name" };
    if (!supplierPrice) return { ...base, action: "skip", reason: "No price" };
    if (available === false && options.skipOutOfStock) return { ...base, action: "skip", reason: "Out of stock" };
    const key = linkKey(link) || (itemId && `${supplier}:${itemId}`) || (sku && `sku:${sku}`) || "";
    if (key && seen.has(key)) return { ...base, action: "skip", reason: "Repeated in the file" };
    if (key) seen.add(key);

    const match = (link && existing.byLink.get(linkKey(link))) || (itemId && existing.byItem.get(`${supplier}:${itemId}`)) || (sku && existing.bySku.get(sku)) || null;
    const supplierRegular = money(get(r, "supplierRegular"));
    const prices = sellingPrices({ supplier, supplierPrice, supplierRegular, offerPct: match?.priv?.offerPct || 0 }, rules);
    const privateData = {
      supplier,
      supplierPrice,
      supplierRegular: supplierRegular > supplierPrice ? supplierRegular : 0,
      autoPrice: true,
      cost: prices.cost,
      ...(link ? { sourceLink: link } : {}),
      ...(itemId ? { supplierItemId: itemId } : {}),
      ...(SUPPLIERS[supplier]?.name ? { sourceName: SUPPLIERS[supplier].name } : {}),
    };
    // a product that tracks units keeps its count while the supplier has it
    const keepUnits = match && Number.isFinite(Number(match.raw?.stock)) && match.raw.stock !== null && match.raw.stock !== "" && Number(match.raw.stock) > 0;
    const stock = available === false ? 0 : keepUnits ? Number(match.raw.stock) : null;
    const pricing = { price: prices.price, currentPrice: prices.currentPrice };

    if (match && options.onlyPrices) {
      return { ...base, action: "update", id: match.id, prices, publicData: { pricing, stock }, privateData };
    }

    const cat = splitCategory(get(r, "category"));
    const images = get(r, "images")
      .split(/\s*[|,;]\s*(?=https?:)|\s+\|\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u))
      .slice(0, 8);
    const stars = Math.min(5, Math.max(0, Number(get(r, "stars").replace(/[^0-9.]/g, "")) || 0));
    const reviews = Math.max(0, Math.floor(Number(get(r, "reviews").replace(/[^0-9]/g, "")) || 0));
    const publicData = {
      name: name.slice(0, 140),
      brand: get(r, "brand").slice(0, 60),
      category: (cat.category || options.category || "Other").slice(0, 60),
      categoryDetail: (get(r, "department") || cat.department || options.department || "").slice(0, 60),
      description: get(r, "description").slice(0, 5000),
      images,
      pricing,
      stock,
      delivery: SUPPLIERS[supplier]?.delivery || match?.raw?.delivery || { count: 2, unit: "days" },
      stars: Math.round(stars * 10) / 10,
      ratingsNumber: reviews,
      ...(match
        ? {}
        : {
            productId: newProductId(),
            sku: sku.slice(0, 40),
            variants: [],
            expressPoints: 0,
            offer: { endsAt: null },
            sectionDisplay: { allProducts: true },
            specifications: [],
            status: options.publish ? "active" : "hidden",
            cities: null,
          }),
    };
    return { ...base, action: match ? "update" : "new", id: match?.id || null, prices, publicData, privateData };
  });
}

/** Our products, findable by supplier link, supplier item number and SKU. */
export function indexExisting(products, privates) {
  const priv = new Map(privates.map((p) => [p.id, p]));
  const byLink = new Map();
  const byItem = new Map();
  const bySku = new Map();
  for (const raw of products) {
    const v = priv.get(raw.id) || {};
    const entry = { id: raw.id, raw, priv: v };
    const link = v.sourceLink || raw.sourceLink;
    if (link) byLink.set(linkKey(link), entry);
    const fromLink = supplierFromLink(link);
    const item = v.supplierItemId || fromLink.itemId;
    const supplier = v.supplier || fromLink.supplier;
    if (item && supplier) byItem.set(`${supplier}:${item}`, entry);
    if (raw.sku) bySku.set(String(raw.sku), entry);
  }
  return { byLink, byItem, bySku };
}

/** A small example file to start from. */
export const SAMPLE_CSV = [
  "name,price,was_price,url,image,brand,category,in_stock,rating,reviews,description",
  '"Onn 32"" HD Roku Smart TV",148.00,178.00,https://www.walmart.ca/en/ip/onn-32-hd-roku-smart-tv/6000203849173,https://i5.walmartimages.ca/images/Enlarge/example.jpg,onn,Electronics > TVs,yes,4.4,1532,"Roku built in, 3 HDMI ports"',
  "Example Bluetooth Speaker,39.99,,https://www.amazon.ca/dp/B000000000,https://m.media-amazon.com/images/I/example.jpg,Example,Electronics > Speakers,yes,4.6,880,Waterproof portable speaker",
].join("\n");
