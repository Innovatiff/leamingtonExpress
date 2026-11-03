// Products sent by the Express browser extension ("Add to Express" on walmart.ca and
// amazon.ca, see /extension): they arrive in the admin's address (#add=…) and wait in this
// browser until you add them to the store on Products → Add from Walmart & Amazon.
import { linkKey } from "./links.js";

const KEY = "lx_store_queue_v1";
const INSTALLED = "lx_extension_installed";
export const QUEUE_EVENT = "lx-store-queue";
const MAX = 300;
const SUPPLIERS = ["walmart", "amazon", "other"];

/* ------------------------------ Payloads -------------------------------- */

/** JSON → base64url (the extension writes the same) */
export function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → the products in it (checked and trimmed); [] when it can't be read. */
export function decodePayload(text) {
  try {
    const s = String(text || "").trim();
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return (Array.isArray(data) ? data : [data]).map(sanitizeItem).filter(Boolean);
  } catch {
    return [];
  }
}

const line = (v, max) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const httpUrl = (v) => {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
};
const amount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** What a page sent, kept only if it's a product (text only, web links only). */
export function sanitizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = line(raw.name, 200);
  const link = httpUrl(raw.link);
  if (!name || !link) return null;
  return {
    supplier: SUPPLIERS.includes(raw.supplier) ? raw.supplier : "other",
    name,
    link,
    price: amount(raw.price),
    was: amount(raw.was),
    images: (Array.isArray(raw.images) ? raw.images : [])
      .map(httpUrl)
      .filter((u) => u.startsWith("https://"))
      .slice(0, 8),
    brand: line(raw.brand, 80),
    category: line(raw.category, 200),
    description: String(raw.description ?? "")
      .replace(/\r/g, "")
      .trim()
      .slice(0, 5000),
    available: raw.available === true ? true : raw.available === false ? false : null,
    specs: (Array.isArray(raw.specs) ? raw.specs : [])
      .map((x) => ({ title: line(x?.title, 60), description: line(x?.description, 300) }))
      .filter((x) => x.title && x.description)
      .slice(0, 25),
    sku: line(raw.sku, 40),
    store: line(raw.store, 80),
    // changed by you on the list: kept when the same product is sent again
    ...(raw.customName === true ? { customName: true } : {}),
    ...(raw.customCategory === true ? { customCategory: true } : {}),
    addedAt: Number.isFinite(Number(raw.addedAt)) && Number(raw.addedAt) > 0 ? Number(raw.addedAt) : Date.now(),
  };
}

/** The same product added twice (same page, or same item number) → one key. */
export const itemKey = (item) => linkKey(item.link) || (item.sku ? `${item.supplier}:${item.sku}` : line(item.name, 200).toLowerCase());

/** Newest first; a product added again replaces the older copy (with its new price), keeping the name and category you gave it. */
export function mergeQueue(list, incoming) {
  let next = [...(list || [])];
  for (const item of incoming) {
    const key = itemKey(item);
    const old = next.find((x) => itemKey(x) === key);
    const kept = {
      ...(old?.customName ? { name: old.name, customName: true } : {}),
      ...(old?.customCategory ? { category: old.category, customCategory: true } : {}),
    };
    next = [{ ...item, ...kept }, ...next.filter((x) => itemKey(x) !== key)];
  }
  return next.slice(0, MAX);
}

/* ------------------------------- Storage -------------------------------- */

let cache = { raw: undefined, list: [] };

/** The waiting products (the same array until it changes, for React). */
export function readQueue() {
  let raw;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    let list;
    try {
      const parsed = JSON.parse(raw || "[]");
      list = (Array.isArray(parsed) ? parsed : []).map(sanitizeItem).filter(Boolean);
    } catch {
      list = [];
    }
    cache = { raw, list };
  }
  return cache.list;
}

function writeQueue(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the list stays as it was */
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export const addToQueue = (items) => writeQueue(mergeQueue(readQueue(), items));
export const removeFromQueue = (keys) => {
  const drop = new Set(keys);
  writeQueue(readQueue().filter((x) => !drop.has(itemKey(x))));
};
export const updateQueueItem = (key, patch) => writeQueue(readQueue().map((x) => (itemKey(x) === key ? { ...x, ...patch } : x)));
export const clearQueue = () => writeQueue([]);

/** Listen for changes (this tab, and other admin tabs). */
export function subscribeQueue(fn) {
  const onStorage = (e) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener(QUEUE_EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(QUEUE_EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Did the extension open the admin right after being installed (in this tab)? */
export function justInstalled() {
  try {
    return window.sessionStorage.getItem(INSTALLED) === "1";
  } catch {
    return false;
  }
}

/* ----------------------------- The address ------------------------------ */

/** Take products out of the address (#add=…), before or after signing in. */
function takeFromHash() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#add=")) {
    const items = decodePayload(hash.slice(5));
    if (items.length) addToQueue(items);
  } else if (hash === "#installed") {
    try {
      window.sessionStorage.setItem(INSTALLED, "1");
    } catch {
      /* no sessionStorage */
    }
  } else return;
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
}

/** Called once when the admin starts: the extension changes only the #part, so listen for it. */
export function listenForStoreProducts() {
  takeFromHash();
  window.addEventListener("hashchange", takeFromHash);
}
