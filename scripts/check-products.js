// Checks the live store's products: photos copied to Express's storage, prices that follow
// the pricing rules, supplier link, specs, description, category, duplicates, names that are
// still the store's long title, sold-out items. Reads only; changes nothing.
//
//   node scripts/check-products.js                 products added or changed in the last 2 days
//   node scripts/check-products.js --days 7
//   node scripts/check-products.js --all
//   node scripts/check-products.js --out report.md also writes the report to a file
//
// Without an admin login it checks what customers see. With one (a separate admin account,
// its email and password in EXPRESS_ADMIN_EMAIL / EXPRESS_ADMIN_PASSWORD — never in the
// repository) it also checks the private side: supplier, its price and link, cost and profit.
import { writeFileSync } from "node:fs";
import { pricingRules, sellingPrices } from "../src/lib/margin.js";

const PROJECT = "express-corp";
const API_KEY = "AIzaSyBgrPM2Pe3jP6N6pfqAqHROY0mXSEPJBRA"; // the website's public key (src/config/firebase.js)
const BUCKET = "express-corp.firebasestorage.app";
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const COPY_GRACE = 15 * 60 * 1000; // photos are copied within minutes of adding a product

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ALL = args.includes("--all");
const DAYS = Number(arg("--days")) || 2;
const OUT = arg("--out");

/* ------------------------------ Reading -------------------------------- */

async function signIn() {
  const email = process.env.EXPRESS_ADMIN_EMAIL;
  const password = process.env.EXPRESS_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Admin sign-in failed: ${d.error?.message || r.status}`);
  return d.idToken;
}

/** Firestore's typed values → plain JSON */
function plain(v) {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(plain);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  return null;
}

async function list(collection, token) {
  const docs = [];
  let page = "";
  do {
    const q = new URLSearchParams({ pageSize: "300", key: API_KEY, ...(page ? { pageToken: page } : {}) });
    const r = await fetch(`${DB}/${collection}?${q}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const d = await r.json();
    if (!r.ok) throw new Error(`${collection}: ${d.error?.message || r.status}`);
    for (const doc of d.documents || []) docs.push({ id: doc.name.split("/").pop(), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, plain(v)])) });
    page = d.nextPageToken || "";
  } while (page);
  return docs;
}

async function get(path, token) {
  const r = await fetch(`${DB}/${path}?key=${API_KEY}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (r.status === 404) return null;
  const d = await r.json();
  if (!r.ok) throw new Error(`${path}: ${d.error?.message || r.status}`);
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, plain(v)]));
}

/* ------------------------------ Checking ------------------------------- */

const own = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname === "res.cloudinary.com") return true;
    return ["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(u.hostname) && (u.pathname.startsWith(`/v0/b/${BUCKET}/`) || u.pathname.startsWith(`/${BUCKET}/`));
  } catch {
    return true; // not a link: nothing to copy
  }
};
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const keyOf = (link) => {
  try {
    const u = new URL(link);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return String(link || "").toLowerCase();
  }
};

function checkProduct(p, priv, rules, now) {
  const problems = []; // must fix
  const notes = []; // worth a look
  const added = p.createdAt instanceof Date ? p.createdAt.getTime() : 0;
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const outside = images.filter((u) => !own(u));
  if (!images.length) problems.push("no photo");
  else if (outside.length) (now - added > COPY_GRACE ? problems : notes).push(`${outside.length} photo(s) still on ${new URL(outside[0]).hostname}${now - added > COPY_GRACE ? "" : " (being copied)"}`);
  const name = String(p.name || "").trim();
  if (/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/.test(name)) notes.push("invisible characters in the name (retype it)");
  if (name.length < 3) problems.push("no name");
  else if (name.length > 80) notes.push(`long name (${name.length} characters): probably the store's title`);
  const price = Number(p.pricing?.price) || 0;
  const sale = Number(p.pricing?.currentPrice) || 0;
  const selling = sale > 0 ? sale : price;
  if (!(price > 0)) problems.push("no price");
  if (!Array.isArray(p.specifications) || !p.specifications.length) notes.push("no specs");
  if (!String(p.description || "").trim()) notes.push("no description");
  if (!p.category || /^other$/i.test(p.category)) notes.push("category: Other");
  if (p.status === "hidden") notes.push("hidden (not on sale)");
  if (p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0) notes.push("sold out");
  if (priv) {
    if (!priv.sourceLink) problems.push("no supplier link (the order can't be bought)");
    if (!(Number(priv.supplierPrice) > 0)) problems.push("no supplier price");
    if (priv.autoPrice && Number(priv.supplierPrice) > 0) {
      const want = sellingPrices(priv, rules);
      if (want && (Math.abs(want.price - price) > 0.005 || Math.abs(want.currentPrice - sale) > 0.005)) {
        problems.push(`price ${money(selling)} doesn't follow the rules (should be ${money(want.currentPrice || want.price)}): Settings → Prices → Update product prices`);
      }
    }
    const cost = Number(priv.cost) || 0;
    if (cost > 0 && selling > 0 && selling - cost < rules.minProfit - 0.005) problems.push(`profit ${money(selling - cost)} is under the minimum ${money(rules.minProfit)}`);
  }
  return { problems, notes, selling, supplier: priv?.supplier || "", link: priv?.sourceLink || "", cost: Number(priv?.cost) || 0 };
}

/* -------------------------------- Run ---------------------------------- */

const token = await signIn();
const [products, privates, pricing] = await Promise.all([
  list("express_products", token),
  token ? list("express_products_private", token) : [],
  token ? get("express_pricing/default", token) : null,
]);
const rules = pricingRules(pricing);
const privById = new Map(privates.map((x) => [x.id, x]));
const now = Date.now();
const since = now - DAYS * 24 * 60 * 60 * 1000;
const time = (d) => (d instanceof Date ? d.getTime() : 0);
const chosen = products.filter((p) => ALL || Math.max(time(p.createdAt), time(p.updatedAt)) >= since).sort((a, b) => time(b.createdAt) - time(a.createdAt));

// the same supplier link or the same name on two products
const byLink = new Map();
const byName = new Map();
for (const p of products) {
  const link = privById.get(p.id)?.sourceLink;
  if (link) byLink.set(keyOf(link), [...(byLink.get(keyOf(link)) || []), p.id]);
  const n = String(p.name || "").trim().toLowerCase();
  if (n) byName.set(n, [...(byName.get(n) || []), p.id]);
}

const rows = chosen.map((p) => {
  const priv = token ? privById.get(p.id) || {} : null;
  const r = checkProduct(p, priv, rules, now);
  const twins = new Set([...(priv?.sourceLink ? byLink.get(keyOf(priv.sourceLink)) || [] : []), ...(byName.get(String(p.name || "").trim().toLowerCase()) || [])]);
  twins.delete(p.id);
  if (twins.size) r.problems.push(`duplicate of ${[...twins].join(", ")}`);
  return { p, ...r };
});

const lines = [];
const bad = rows.filter((r) => r.problems.length);
const look = rows.filter((r) => !r.problems.length && r.notes.length);
lines.push(`# Product check — ${new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC`);
lines.push("");
lines.push(`${ALL ? "All products" : `Products added or changed in the last ${DAYS} day(s)`}: **${rows.length}** of ${products.length}. ${token ? "Signed in as admin: private details checked too." : "Without admin login: what customers see only."}`);
lines.push(`- OK: ${rows.length - bad.length - look.length}`);
lines.push(`- Worth a look: ${look.length}`);
lines.push(`- To fix: ${bad.length}`);
for (const [title, list] of [
  ["To fix", bad],
  ["Worth a look", look],
]) {
  if (!list.length) continue;
  lines.push("", `## ${title}`);
  for (const r of list) {
    const supplier = r.supplier ? ` · ${r.supplier}` : "";
    const refill = r.link && r.notes.some((n) => n === "no specs" || n === "no description") ? ` — send again: ${r.link}#express-add` : "";
    lines.push(`- **${r.p.name}** (${r.p.id}) · ${money(r.selling)}${supplier}: ${[...r.problems, ...r.notes].join("; ")}${refill}`);
  }
}
const report = lines.join("\n");
console.log(report);
if (OUT) writeFileSync(OUT, `${report}\n`);
