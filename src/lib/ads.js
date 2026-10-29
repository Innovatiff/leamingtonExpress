// Ads on the shop and travel pages. The owner manages them in Admin → Ads and
// they're saved with the city settings (express_settings/{city}.ads), so every
// visitor already has them with the settings and no extra reads are needed.
//
// Two kinds:
// - "side": local businesses and restaurants, in the columns beside the page
//   (on phones and tablets: a row of cards between sections)
// - "banner": a sponsored product or brand, a wide banner between sections

export const AD_KINDS = ["side", "banner"];
export const AD_PAGES = ["shop", "travel"];
export const AD_THEMES = ["blue", "red", "dark", "green", "gold", "purple", "light"];

const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");

/** Links an ad may use: web pages, pages of this site, phone and email. Anything else (javascript:, data:…) is dropped. */
export function safeUrl(url) {
  const s = str(url, 1000);
  if (!s) return "";
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^(https?:\/\/|tel:|mailto:)/i.test(s)) return s;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s.replace(/^\/+/, "")}`;
  return "";
}

/** Opens in a new tab: links to other websites. */
export const isExternal = (url) => /^https?:\/\//i.test(url || "");

/** A clean copy of an ad as saved by the admin (unknown values get safe defaults). */
export function normalizeAd(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const pages = Array.isArray(r.pages) ? r.pages.filter((p) => AD_PAGES.includes(p)) : [];
  return {
    id: str(r.id, 60) || `ad-${Math.random().toString(36).slice(2, 10)}`,
    kind: AD_KINDS.includes(r.kind) ? r.kind : "side",
    active: r.active !== false,
    pages: pages.length ? [...new Set(pages)] : [...AD_PAGES],
    name: str(r.name, 80),
    title: str(r.title, 120),
    text: str(r.text, 240),
    note: str(r.note, 140),
    cta: str(r.cta, 40),
    url: safeUrl(r.url),
    image: str(r.image, 1000),
    creative: str(r.creative, 1000),
    productId: str(r.productId, 120),
    theme: AD_THEMES.includes(r.theme) ? r.theme : r.kind === "banner" ? "blue" : "light",
    // banner photo: "cover" fills the circle, "contain" shows the whole product ("" = cover for a photo, contain for a product)
    fit: ["cover", "contain"].includes(r.fit) ? r.fit : "",
    startsAt: day(r.startsAt),
    endsAt: day(r.endsAt),
  };
}

const startOf = (d) => new Date(`${d}T00:00:00`);
const endOf = (d) => new Date(`${d}T23:59:59.999`);

/** "live", "off", "scheduled" (starts later) or "ended". */
export function adState(ad, now = new Date()) {
  if (!ad.active) return "off";
  if (ad.startsAt && startOf(ad.startsAt) > now) return "scheduled";
  if (ad.endsAt && endOf(ad.endsAt) < now) return "ended";
  return "live";
}

/** Can it show at all? A side ad needs something to show; a banner a title, a design or a product. */
const showable = (ad) => Boolean(ad.creative || ad.image || ad.title || ad.name || (ad.kind === "banner" && ad.productId));

/** The ads showing now on a page ("shop" or "travel"), in the owner's order. */
export function liveAds(list, page, now = new Date()) {
  const out = { side: [], banner: [] };
  for (const raw of Array.isArray(list) ? list : []) {
    const ad = normalizeAd(raw);
    if (!ad.pages.includes(page) || adState(ad, now) !== "live" || !showable(ad)) continue;
    out[ad.kind].push(ad);
  }
  return out;
}

/** The list starting at `offset` (so every advertiser gets the first spot sometimes). */
export function rotate(list, offset = 0) {
  if (!list.length) return [];
  const n = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

/** Side ads split between the left and right columns, alternating. */
export function splitRails(side) {
  const left = [];
  const right = [];
  side.forEach((ad, i) => (i % 2 ? right : left).push(ad));
  return { left, right };
}
