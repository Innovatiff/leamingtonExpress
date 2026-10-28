// Merchandising data for the store (department menu, category bubbles, promo
// banners, price tiles). Everything is computed from the live catalog, so the
// photos, "up to −40%" numbers and prices stay right as products change.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { offerIsLive, sortProducts } from "@/lib/products";
import { normalize } from "@/lib/text";

/** Products that can headline a banner or bubble: in stock, with a photo, best first. */
function showcase(list) {
  return sortProducts(
    list.filter((p) => p.image && p.inStock),
    "featured",
  );
}

function summarize(list) {
  const featured = showcase(list);
  const deals = sortProducts(
    list.filter((p) => p.onSale && p.inStock),
    "discount",
  );
  const prices = list.filter((p) => p.inStock).map((p) => p.price);
  return {
    // Best-selling product photo (falls back to any photo, even if sold out)
    image: featured[0]?.image || list.find((p) => p.image)?.image || "",
    images: featured.slice(0, 3).map((p) => p.image),
    maxDiscount: deals[0]?.discountPct || 0,
    dealCount: deals.length,
    bestDeal: deals.find((p) => p.image) || null,
    minPrice: prices.length ? Math.min(...prices) : 0,
  };
}

/** Department → categories tree with photos and deal stats. */
export function buildDepartments(products, departments) {
  const groups = new Map();
  const add = (key, p) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  };
  for (const p of products) {
    const d = normalize(p.department) || "other";
    add(`d:${d}`, p);
    add(`c:${d}:${normalize(p.category)}`, p);
  }
  return departments.map((d) => ({
    ...d,
    ...summarize(groups.get(`d:${d.key}`) || []),
    categories: d.categories.map((c) => ({ ...c, ...summarize(groups.get(`c:${d.key}:${c.key}`) || []) })),
  }));
}

/** Categories across departments (merged when two departments share one), most products first. */
export function flattenCategories(tree, products) {
  const map = new Map();
  for (const d of tree) {
    for (const c of d.categories) {
      if (!map.has(c.key)) map.set(c.key, { key: c.key, value: c.value, departmentKey: d.key });
    }
  }
  const byCat = new Map();
  for (const p of products) {
    const k = normalize(p.category);
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push(p);
  }
  return [...map.values()]
    .map((c) => ({ ...c, count: byCat.get(c.key)?.length || 0, ...summarize(byCat.get(c.key) || []) }))
    .sort((a, b) => b.count - a.count);
}

/** Departments and categories with photos, from the live catalog. */
export function useMerch() {
  const { products, departments } = useCatalog();
  return useMemo(() => {
    const tree = buildDepartments(products, departments);
    const categories = flattenCategories(tree, products);
    const deals = sortProducts(
      products.filter((p) => p.onSale && p.inStock),
      "discount",
    );
    return { departments: tree, categories, deals, bestDeal: deals.find((p) => p.image) || null };
  }, [products, departments]);
}

const uniqueById = (list) => {
  const seen = new Set();
  return list.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

/**
 * Products for the flash-deals strip: offers with a countdown first (soonest to end),
 * then the admin's "Flash deals" picks; topped up with the biggest discounts when there are few.
 */
export function flashDeals(products, max = 12, min = 6) {
  const live = products.filter((p) => p.inStock && offerIsLive(p)).sort((a, b) => a.offerEndsAt - b.offerEndsAt);
  const picked = sortProducts(
    products.filter((p) => p.inStock && p.sections?.fastOffer),
    "discount",
  );
  let out = uniqueById([...live, ...picked]);
  if (out.length < min) {
    const deals = sortProducts(
      products.filter((p) => p.inStock && p.onSale),
      "discount",
    );
    out = uniqueById([...out, ...deals]).slice(0, Math.max(min, out.length));
  }
  return out.slice(0, max);
}

/** Biggest discounts (the admin's "Best offers" picks first), skipping products shown elsewhere. */
export function topDeals(products, skipIds = new Set(), max = 8) {
  const picked = sortProducts(
    products.filter((p) => p.inStock && p.sections?.bestOffers),
    "discount",
  );
  const deals = sortProducts(
    products.filter((p) => p.inStock && p.onSale && p.discountPct >= 5),
    "discount",
  );
  return uniqueById([...picked, ...deals.filter((p) => !skipIds.has(p.id))]).slice(0, max);
}

/** Categories worth a promo banner: the biggest discounts first (each needs a photo). */
export function bannerCategories(categories) {
  return categories
    .filter((c) => c.dealCount > 0 && c.maxDiscount >= 5 && c.images.length > 0)
    .sort((a, b) => b.maxDiscount - a.maxDiscount || b.dealCount - a.dealCount);
}

/** The brand with the most deals (at least 3 products in stock with photos) for a brand banner. */
export function brandSpotlight(products, skip = []) {
  const byBrand = new Map();
  for (const p of products) {
    if (!p.brand || !p.inStock || !p.image) continue;
    if (!byBrand.has(p.brand)) byBrand.set(p.brand, []);
    byBrand.get(p.brand).push(p);
  }
  let best = null;
  for (const [brand, list] of byBrand) {
    if (list.length < 3 || skip.includes(brand)) continue;
    const deals = list.filter((p) => p.onSale);
    const score = deals.length * 100 + list.length;
    if (!best || score > best.score) best = { brand, list, deals, score };
  }
  if (!best || !best.deals.length) return null;
  const top = sortProducts(best.deals, "discount");
  return {
    brand: best.brand,
    count: best.list.length,
    maxDiscount: top[0].discountPct,
    images: sortProducts(best.list, "featured")
      .slice(0, 3)
      .map((p) => p.image),
  };
}

/** "Under $25 / $50 / $100 / $200" tiles, each with a product photo from its own price band. */
export function priceTiles(products, steps = [25, 50, 100, 200, 500], max = 4) {
  const inStock = products.filter((p) => p.inStock);
  const tiles = [];
  let prevCount = 0;
  let prevStep = 0;
  for (const step of steps) {
    const under = inStock.filter((p) => p.price <= step);
    if (under.length > prevCount) {
      const band = showcase(inStock.filter((p) => p.price <= step && p.price > prevStep));
      const pick = band[0] || showcase(under)[0];
      tiles.push({ max: step, count: under.length, image: pick?.image || "" });
    }
    prevCount = under.length;
    prevStep = step;
    if (tiles.length >= max) break;
  }
  return tiles;
}

/** Catalog link helpers (same query params as CatalogPage). */
export const catalogLink = {
  department: (key, extra = "") => `/tienda/productos?dep=${encodeURIComponent(key)}${extra}`,
  category: (key, extra = "") => `/tienda/productos?cat=${encodeURIComponent(key)}${extra}`,
  maxPrice: (max) => `/tienda/productos?max=${max}`,
};

/** `true` while the media query matches (e.g. "(min-width: 900px)"). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
