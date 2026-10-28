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

/** Products for the flash-deals strip: live countdown offers first (soonest to end), then the "fastOffer" picks, then the biggest discounts. */
export function flashDeals(products, max = 12) {
  const live = products.filter((p) => p.inStock && offerIsLive(p)).sort((a, b) => a.offerEndsAt - b.offerEndsAt);
  const picked = sortProducts(
    products.filter((p) => p.inStock && p.sections?.fastOffer),
    "discount",
  );
  const deals = sortProducts(
    products.filter((p) => p.inStock && p.onSale),
    "discount",
  );
  const seen = new Set();
  const out = [];
  for (const p of [...live, ...picked, ...deals]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
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
