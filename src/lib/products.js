import { parseMoney, round2, toDate } from "./format";
import { cleanStr, normalize, slugify } from "./text";

/* ------------------------------------------------------------------------ */
/* Categories & departments                                                  */
/* ------------------------------------------------------------------------ */
// Keys are normalized versions of the `category` / `categoryDetail` values
// typed in the admin. Unknown values still work — they just show as typed.
export const CATEGORY_META = {
  earbuds: { es: "Audífonos inalámbricos", en: "Earbuds", icon: "Headset" },
  headphones: { es: "Audífonos", en: "Headphones", icon: "Headphones" },
  television: { es: "Televisores", en: "TVs", icon: "Television" },
  tv: { es: "Televisores", en: "TVs", icon: "Television" },
  phone: { es: "Celulares", en: "Phones", icon: "DeviceMobile" },
  speaker: { es: "Bocinas", en: "Speakers", icon: "SpeakerHifi" },
  tablet: { es: "Tabletas", en: "Tablets", icon: "DeviceTablet" },
  printer: { es: "Impresoras", en: "Printers", icon: "Printer" },
  laptop: { es: "Laptops", en: "Laptops", icon: "Laptop" },
  pc: { es: "Computadoras", en: "Desktop PCs", icon: "Desktop" },
  monitor: { es: "Monitores", en: "Monitors", icon: "Monitor" },
  watch: { es: "Relojes inteligentes", en: "Smartwatches", icon: "Watch" },
  purse: { es: "Bolsos", en: "Handbags", icon: "Handbag" },
  "hair straightener": { es: "Planchas para cabello", en: "Hair straighteners", icon: "HairDryer" },
  gaming: { es: "Videojuegos", en: "Gaming", icon: "GameController" },
  vacuum: { es: "Aspiradoras", en: "Vacuums", icon: "Broom" },
  scooter: { es: "Scooters", en: "Scooters", icon: "Scooter" },
  bike: { es: "Bicicletas", en: "Bikes", icon: "Bicycle" },
  camera: { es: "Cámaras", en: "Cameras", icon: "Camera" },
  other: { es: "Otros", en: "Other", icon: "Package" },
};

export const DEPARTMENT_META = {
  electronics: { es: "Electrónica", en: "Electronics", icon: "Lightning" },
  electronicos: { es: "Electrónica", en: "Electronics", icon: "Lightning" },
  handbags: { es: "Bolsos y accesorios", en: "Bags & accessories", icon: "Handbag" },
  "hair care": { es: "Cuidado personal", en: "Personal care", icon: "Sparkle" },
  casa: { es: "Hogar", en: "Home", icon: "House" },
  home: { es: "Hogar", en: "Home", icon: "House" },
};

const metaFor = (table, value) => table[normalize(value)] || null;

export function categoryLabel(value, lang = "es") {
  const meta = metaFor(CATEGORY_META, value);
  return meta ? meta[lang] : cleanStr(value);
}

export function departmentLabel(value, lang = "es") {
  const meta = metaFor(DEPARTMENT_META, value);
  return meta ? meta[lang] : cleanStr(value);
}

export const categoryIcon = (value) => metaFor(CATEGORY_META, value)?.icon || "Tag";
export const departmentIcon = (value) => metaFor(DEPARTMENT_META, value)?.icon || "SquaresFour";

/* ------------------------------------------------------------------------ */
/* Home-page sections (the `sectionDisplay` checkboxes in the admin)         */
/* ------------------------------------------------------------------------ */
export const SECTIONS = [
  { key: "dayOffer", emoji: "🎁", es: "Ofertas del día", en: "Deals of the day", max: 10 },
  { key: "mostSearched", emoji: "🔥", es: "Lo más buscado hoy", en: "Trending today", max: 10 },
  { key: "fastOffer", emoji: "⚡", es: "Ofertas rápidas", en: "Flash deals", max: 8 },
  { key: "recommended", emoji: "✨", es: "Recomendado para ti", en: "Recommended for you", max: 12 },
  { key: "EveryoneLikes", emoji: "👀", es: "A todos les encantan", en: "Everyone loves these", max: 12 },
  { key: "mostBought", emoji: "🙌", es: "Lo más comprado", en: "Best sellers", max: 12 },
  { key: "bestOffers", emoji: "👌", es: "Mejores ofertas", en: "Best offers", max: 8 },
  { key: "events", emoji: "🎉", es: "Temporada de regalos", en: "Gift season", max: 12 },
];
export const SECTION_KEYS = SECTIONS.map((s) => s.key);

/* ------------------------------------------------------------------------ */
/* Product normalizer — accepts every shape the old admin ever saved         */
/* ------------------------------------------------------------------------ */
const UNIT_ALIASES = {
  minute: "minutes", minutes: "minutes", min: "minutes", mins: "minutes",
  hour: "hours", hours: "hours", hr: "hours", hrs: "hours", h: "hours",
  day: "days", days: "days", d: "days",
  week: "weeks", weeks: "weeks",
  month: "months", months: "months",
};
const normUnit = (u) => UNIT_ALIASES[normalize(u)] || "days";

const isUrl = (v) => typeof v === "string" && /^(https?:|data:image\/)/.test(v.trim());

function toList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(cleanStr).filter(Boolean);
  return String(v)
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function deliveryHours({ count, unit }) {
  const n = Number(count) || 0;
  const mult = { minutes: 1 / 60, hours: 1, days: 24, weeks: 168, months: 720 }[unit] || 24;
  return n * mult;
}

export function normalizeProduct(raw = {}, id = raw.id) {
  const pricing = raw.pricing && typeof raw.pricing === "object" ? raw.pricing : {};
  const regular = parseMoney(pricing.price ?? raw.price ?? raw.oldPrice);
  const current = parseMoney(pricing.currentPrice ?? raw.currentPrice ?? raw.actualPrice);
  const price = round2(current > 0 ? current : regular);
  const compareAt = regular > price ? round2(regular) : 0;
  const savings = compareAt ? round2(compareAt - price) : 0;
  const discountPct = compareAt ? Math.round((savings / compareAt) * 100) : 0;

  const images = (Array.isArray(raw.images) ? raw.images : [raw.image, raw.mainImage])
    .filter(isUrl)
    .map((s) => s.trim());

  const stockRaw = raw.stock ?? raw.Stock ?? raw.quantity;
  const stock =
    stockRaw === undefined || stockRaw === null || stockRaw === ""
      ? null // not tracked → always available
      : Math.max(0, Math.floor(Number(stockRaw) || 0));

  const deliveryObj = raw.delivery && typeof raw.delivery === "object" ? raw.delivery : {};
  const delivery = {
    count: Number(deliveryObj.count ?? raw.deliveryCount) || 0,
    unit: normUnit(deliveryObj.unit ?? raw.deliveryUnit),
  };

  const offerObj = raw.offer && typeof raw.offer === "object" ? raw.offer : {};
  const offerEndsAt = toDate(offerObj.endsAt);

  const specs = (Array.isArray(raw.specifications) ? raw.specifications : [])
    .map((s) => ({ title: cleanStr(s?.title), description: cleanStr(s?.description) }))
    .filter((s) => s.title || s.description);

  const name = cleanStr(raw.name || raw.productName || raw.porductName || raw.title) || "Producto";
  const brand = cleanStr(raw.brand || raw.Brand);
  const category = cleanStr(raw.category || raw.productTag || raw.Category) || "Other";
  const department = cleanStr(raw.categoryDetail || raw.department);
  const variants = toList(raw.variants ?? raw.variant);
  const sections = raw.sectionDisplay && typeof raw.sectionDisplay === "object" ? raw.sectionDisplay : {};
  const stars = Math.min(5, Math.max(0, Number(raw.stars ?? raw.rating) || 0));
  const ratingsCount = Math.max(0, Math.floor(Number(raw.ratingsNumber ?? raw.reviewsCount) || 0));

  const searchText = normalize(
    [
      name,
      brand,
      category,
      department,
      categoryLabel(category, "es"),
      categoryLabel(category, "en"),
      departmentLabel(department, "es"),
      departmentLabel(department, "en"),
      variants.join(" "),
      raw.sku,
      raw.productId,
    ].join(" "),
  );

  return {
    id,
    productId: cleanStr(raw.productId),
    sku: cleanStr(raw.sku),
    name,
    slug: slugify(name),
    brand,
    category,
    department,
    origin: cleanStr(raw.origin) || "",
    description: cleanStr(raw.description),
    images,
    image: images[0] || "",
    variants,
    price,
    compareAt,
    savings,
    discountPct,
    onSale: compareAt > 0,
    stock,
    inStock: stock === null || stock > 0,
    stars,
    ratingsCount,
    points: Math.max(0, Math.floor(Number(raw.expressPoints ?? raw.ExpressPoints ?? raw.points) || 0)),
    delivery,
    deliveryHours: deliveryHours(delivery),
    offerEndsAt,
    specs,
    sections,
    createdAt: toDate(raw.createdAt),
    performance: Number(raw.performance) || 0,
    cities: Array.isArray(raw.cities) && raw.cities.length ? raw.cities : null,
    status: cleanStr(raw.status) || (raw.hidden ? "hidden" : "active"),
    searchText,
  };
}

/** Is the product for sale on this city's site? */
export function isListed(p, cityId) {
  if (!p || p.status !== "active" || !(p.price > 0)) return false;
  return !p.cities || p.cities.includes(cityId);
}

export const productPath = (p) => `/tienda/producto/${encodeURIComponent(p.id)}${p.slug ? `/${p.slug}` : ""}`;

export function offerIsLive(p, now = Date.now()) {
  return !!(p.offerEndsAt && p.offerEndsAt.getTime() > now);
}

/** Is the product "new"? (added in the last N days) */
export function isNew(p, days = 21) {
  return !!(p.createdAt && Date.now() - p.createdAt.getTime() < days * 86400000);
}

export function sortProducts(list, sort) {
  const arr = [...list];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => a.price - b.price);
    case "price-desc":
      return arr.sort((a, b) => b.price - a.price);
    case "discount":
      return arr.sort((a, b) => b.discountPct - a.discountPct || b.savings - a.savings);
    case "newest":
      return arr.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      // "featured": in-stock first, then sales performance, then curated flags, then newest
      return arr.sort(
        (a, b) =>
          Number(b.inStock) - Number(a.inStock) ||
          b.performance - a.performance ||
          sectionWeight(b) - sectionWeight(a) ||
          (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
      );
  }
}

const sectionWeight = (p) => Object.entries(p.sections || {}).filter(([k, v]) => v && k !== "allProducts").length;
