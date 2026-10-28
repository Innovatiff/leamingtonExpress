"use strict";

// The store's catalog: a compact copy of every product for sale (no long
// descriptions or extra photos) packed into a few documents, so a visit reads
// a handful of documents instead of one per product. Built by the Cloud
// Functions; the product page still loads the full product.

const MAX_PART_BYTES = 700000; // a Firestore document holds up to 1 MiB
const LEFT_OUT = new Set(["description", "specifications", "updatedAt", "photosFailedAt", "sourceName", "sourceLink", "stockLocation", "cost", "profit"]);

/** Firestore values → plain JSON (Timestamps become ISO strings). */
function plain(v) {
  if (v == null) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") {
    if (typeof v.latitude === "number" && typeof v.longitude === "number") return { lat: v.latitude, lng: v.longitude };
    if (typeof v.path === "string" && v.firestore) return v.path;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const isHidden = (raw) => (raw.status ? raw.status !== "active" : raw.hidden === true);

const millis = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v instanceof Date ? v.getTime() : Date.parse(v) || 0);

/** One product as the store's lists need it. */
function catalogCard(id, raw) {
  const card = { id };
  for (const [k, v] of Object.entries(raw)) if (!LEFT_OUT.has(k)) card[k] = plain(v);
  if (Array.isArray(raw.images)) card.images = raw.images.slice(0, 1);
  if (card.pricing && typeof card.pricing === "object") {
    card.pricing = Object.fromEntries(Object.entries(card.pricing).filter(([k]) => k !== "cost" && k !== "profitRange"));
  }
  return card;
}

/**
 * Products ({ id, ...data }) → { parts: [JSON text], count, newest } — products on
 * sale only, packed into parts of at most MAX_PART_BYTES. `newest` is the latest
 * updatedAt (milliseconds), used to tell whether anything changed since.
 */
function buildCatalogParts(products, maxBytes = MAX_PART_BYTES) {
  let newest = 0;
  const cards = [];
  for (const { id, ...raw } of products) {
    newest = Math.max(newest, millis(raw.updatedAt));
    if (!isHidden(raw)) cards.push(JSON.stringify(catalogCard(id, raw)));
  }
  const parts = [];
  let current = [];
  let size = 2;
  for (const card of cards) {
    const bytes = Buffer.byteLength(card) + 1;
    if (current.length && size + bytes > maxBytes) {
      parts.push(`[${current.join(",")}]`);
      current = [];
      size = 2;
    }
    current.push(card);
    size += bytes;
  }
  if (current.length || !parts.length) parts.push(`[${current.join(",")}]`);
  return { parts, count: cards.length, newest };
}

module.exports = { buildCatalogParts, catalogCard, millis };
