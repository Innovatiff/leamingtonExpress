import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CaretRight, Funnel, MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { EmptyState, Notice } from "@/components/ui/Misc";
import { Drawer } from "@/components/ui/Overlay";
import { AdLayout, LocalAds } from "@/features/ads/Ads";
import { useCatalog } from "@/context/CatalogContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { categoryLabel, departmentLabel, SECTIONS, sortProducts } from "@/lib/products";
import { didYouMean, searchProducts } from "@/lib/search";
import { useSeo } from "@/lib/seo";
import { normalize } from "@/lib/text";
import { CategoryIcon, DepartmentIcon } from "./components/CategoryIcon";
import ProductCard, { ProductCardSkeleton } from "./components/ProductCard";

const PAGE = 24;
// phones and tablets: the local business ads after this many products (full rows of 2, 3 or 4)
const LOCAL_ADS_AFTER = 12;
const SORTS = ["featured", "newest", "price-asc", "price-desc", "discount"];
const PRICE_RANGES = [
  [0, 50],
  [50, 100],
  [100, 300],
  [300, 600],
  [600, 0],
];

function readFilters(params) {
  const num = (k) => {
    const v = Number(params.get(k));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  return {
    q: params.get("q") || "",
    dep: params.get("dep") || "",
    cat: params.get("cat") || "",
    brands: (params.get("marca") || "").split(",").filter(Boolean),
    min: num("min"),
    max: num("max"),
    sort: SORTS.includes(params.get("orden")) ? params.get("orden") : "featured",
    deals: params.get("ofertas") === "1",
    stock: params.get("stock") === "1",
    fast: params.get("rapido") === "1",
    section: params.get("seccion") || "",
  };
}

function applyFilters(list, f, skip = "") {
  return list.filter((p) => {
    if (skip !== "cat" && f.dep && (normalize(p.department) || "other") !== f.dep) return false;
    if (skip !== "cat" && f.cat && normalize(p.category) !== f.cat) return false;
    if (skip !== "brand" && f.brands.length && !f.brands.includes(p.brand)) return false;
    if (skip !== "price" && f.min && p.price < f.min) return false;
    if (skip !== "price" && f.max && p.price > f.max) return false;
    if (f.deals && !p.onSale) return false;
    if (f.stock && !p.inStock) return false;
    if (f.fast && !(p.delivery.count > 0 && p.deliveryHours <= 24)) return false;
    if (f.section && !p.sections?.[f.section]) return false;
    return true;
  });
}

function FiltersPanel({ base, filters, update, onDone }) {
  const { t, lang } = useI18n();
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [minDraft, setMinDraft] = useState(filters.min || "");
  const [maxDraft, setMaxDraft] = useState(filters.max || "");
  useEffect(() => {
    setMinDraft(filters.min || "");
    setMaxDraft(filters.max || "");
  }, [filters.min, filters.max]);

  // facet counts (each facet ignores its own selection)
  const forCats = applyFilters(base, filters, "cat");
  const deptTree = useMemo(() => {
    const map = new Map();
    for (const p of forCats) {
      const dKey = normalize(p.department) || "other";
      if (!map.has(dKey)) map.set(dKey, { key: dKey, value: p.department || "Other", count: 0, cats: new Map() });
      const d = map.get(dKey);
      d.count += 1;
      const cKey = normalize(p.category);
      d.cats.set(cKey, { key: cKey, value: p.category, count: (d.cats.get(cKey)?.count || 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [forCats]);

  const forBrands = applyFilters(base, filters, "brand");
  const brandList = useMemo(() => {
    const m = new Map();
    for (const p of forBrands) if (p.brand) m.set(p.brand, (m.get(p.brand) || 0) + 1);
    for (const b of filters.brands) if (!m.has(b)) m.set(b, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [forBrands, filters.brands]);

  const toggleBrand = (b) => {
    const next = filters.brands.includes(b) ? filters.brands.filter((x) => x !== b) : [...filters.brands, b];
    update({ marca: next.join(",") || null });
  };

  const applyPrice = () => update({ min: Number(minDraft) > 0 ? String(Number(minDraft)) : null, max: Number(maxDraft) > 0 ? String(Number(maxDraft)) : null });

  return (
    <div className="filters">
      <div className="filters__group">
        <h3 className="filters__title">{t("catalog.category")}</h3>
        <button className={`filters__link ${!filters.dep && !filters.cat ? "is-active" : ""}`} onClick={() => update({ dep: null, cat: null })}>
          {t("catalog.all")}
        </button>
        {deptTree.map((d) => (
          <div key={d.key} className="filters__dept">
            <button className={`filters__link filters__link--dept ${filters.dep === d.key && !filters.cat ? "is-active" : ""}`} onClick={() => update({ dep: d.key, cat: null })}>
              <DepartmentIcon department={d.value} size={18} />
              <span className="grow">{departmentLabel(d.value, lang)}</span>
              <span className="filters__count">{d.count}</span>
            </button>
            {[...d.cats.values()]
              .sort((a, b) => b.count - a.count)
              .map((c) => (
                <button key={c.key} className={`filters__link filters__link--cat ${filters.cat === c.key ? "is-active" : ""}`} onClick={() => update({ cat: c.key, dep: null })}>
                  <CategoryIcon category={c.value} size={17} />
                  <span className="grow">{categoryLabel(c.value, lang)}</span>
                  <span className="filters__count">{c.count}</span>
                </button>
              ))}
          </div>
        ))}
      </div>

      {brandList.length > 0 && (
        <div className="filters__group">
          <h3 className="filters__title">{t("catalog.brand")}</h3>
          {(showAllBrands ? brandList : brandList.slice(0, 8)).map(([b, n]) => (
            <label key={b} className="filters__check">
              <input type="checkbox" checked={filters.brands.includes(b)} onChange={() => toggleBrand(b)} />
              <span className="grow">{b}</span>
              <span className="filters__count">{n}</span>
            </label>
          ))}
          {brandList.length > 8 && (
            <button className="filters__more" onClick={() => setShowAllBrands((s) => !s)}>
              {showAllBrands ? "−" : `+ ${brandList.length - 8}`}
            </button>
          )}
        </div>
      )}

      <div className="filters__group">
        <h3 className="filters__title">{t("catalog.price")}</h3>
        <div className="filters__ranges">
          {PRICE_RANGES.map(([a, b]) => {
            const active = filters.min === a && filters.max === b;
            return (
              <button
                key={`${a}-${b}`}
                className={`chip chip--sm ${active ? "chip--active" : ""}`}
                onClick={() => update(active ? { min: null, max: null } : { min: a ? String(a) : null, max: b ? String(b) : null })}
              >
                {b ? `${a ? money(a, { whole: true }) : "$0"} – ${money(b, { whole: true })}` : `${money(a, { whole: true })}+`}
              </button>
            );
          })}
        </div>
        <form
          className="filters__price"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrice();
          }}
        >
          <input className="input" inputMode="numeric" placeholder={t("catalog.min")} value={minDraft} onChange={(e) => setMinDraft(e.target.value.replace(/\D/g, ""))} onBlur={applyPrice} aria-label={t("catalog.min")} />
          <span>–</span>
          <input className="input" inputMode="numeric" placeholder={t("catalog.max")} value={maxDraft} onChange={(e) => setMaxDraft(e.target.value.replace(/\D/g, ""))} onBlur={applyPrice} aria-label={t("catalog.max")} />
          <button className="btn btn--dark btn--sm btn--icon" aria-label="OK">
            <CaretRight size={16} weight="bold" />
          </button>
        </form>
      </div>

      <div className="filters__group">
        <h3 className="filters__title">{t("catalog.availability")}</h3>
        <Checkbox label={t("catalog.onSaleOnly")} checked={filters.deals} onChange={() => update({ ofertas: filters.deals ? null : "1" })} />
        <Checkbox label={t("catalog.inStockOnly")} checked={filters.stock} onChange={() => update({ stock: filters.stock ? null : "1" })} />
        <Checkbox label={t("catalog.fastDelivery")} checked={filters.fast} onChange={() => update({ rapido: filters.fast ? null : "1" })} />
      </div>

      {onDone && (
        <Button block size="lg" onClick={onDone}>
          {t("common.close")}
        </Button>
      )}
    </div>
  );
}

export default function CatalogPage() {
  const { t, tx, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const { products, status, vocab, retry } = useCatalog();
  const filters = useMemo(() => readFilters(params), [params]);
  const [shown, setShown] = useState(PAGE);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setShown(PAGE), [params]);

  const base = useMemo(() => (filters.q ? searchProducts(products, filters.q) : products), [products, filters.q]);
  const filtered = useMemo(() => applyFilters(base, filters), [base, filters]);
  const results = useMemo(() => (filters.sort === "featured" && filters.q ? filtered : sortProducts(filtered, filters.sort)), [filtered, filters.sort, filters.q]);
  const suggestion = useMemo(() => (filters.q && base.length === 0 ? didYouMean(vocab[lang], filters.q) : ""), [filters.q, base.length, vocab, lang]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: false });
  };

  const sectionMeta = SECTIONS.find((s) => s.key === filters.section);
  const title = filters.q
    ? t("catalog.resultsFor", { q: filters.q })
    : sectionMeta
      ? `${tx(sectionMeta)} ${sectionMeta.emoji}`
      : filters.cat
        ? categoryLabel(results[0]?.category || filters.cat, lang)
        : filters.dep
          ? departmentLabel(results[0]?.department || filters.dep, lang)
          : filters.deals
            ? t("store.deals")
            : filters.max && !filters.min
              ? t("store.underAmount", { amount: money(filters.max, { whole: true }) })
              : filters.sort === "newest"
                ? t("store.newArrivals")
                : t("store.allProducts");

  useSeo({ title, noindex: Boolean(filters.q) });

  const chips = [
    filters.q && { key: "q", label: `“${filters.q}”` },
    sectionMeta && { key: "seccion", label: tx(sectionMeta) },
    filters.dep && { key: "dep", label: departmentLabel(results[0]?.department || filters.dep, lang) },
    filters.cat && { key: "cat", label: categoryLabel(results[0]?.category || filters.cat, lang) },
    ...filters.brands.map((b) => ({ key: `marca:${b}`, label: b })),
    (filters.min || filters.max) && { key: "price", label: `${money(filters.min, { whole: true })} – ${filters.max ? money(filters.max, { whole: true }) : "∞"}` },
    filters.deals && { key: "ofertas", label: t("catalog.onSaleOnly") },
    filters.stock && { key: "stock", label: t("catalog.inStockOnly") },
    filters.fast && { key: "rapido", label: t("catalog.fastDelivery") },
  ].filter(Boolean);

  const removeChip = (key) => {
    if (key.startsWith("marca:")) {
      const b = key.slice(6);
      return update({ marca: filters.brands.filter((x) => x !== b).join(",") || null });
    }
    if (key === "price") return update({ min: null, max: null });
    return update({ [key]: null });
  };

  const activeCount = chips.filter((c) => c.key !== "q").length;
  const clearAll = () => setParams(filters.q ? { q: filters.q } : {});

  return (
    <AdLayout page="shop">
      <div className="catalog">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/tienda">{t("store.title")}</Link>
          <CaretRight size={12} />
          <span>{title}</span>
        </nav>

        <div className="catalog__head">
          <div>
            <h1 className="catalog__title">{title}</h1>
            <p className="muted">{status === "loading" ? t("common.loading") : t("catalog.results", { n: results.length })}</p>
          </div>
          <div className="catalog__tools">
            <button className="btn btn--secondary catalog__filter-btn" onClick={() => setDrawer(true)}>
              <SlidersHorizontal size={18} weight="bold" /> {t("catalog.filters")}
              {activeCount > 0 && <span className="catalog__badge">{activeCount}</span>}
            </button>
            <label className="catalog__sort">
              <span className="sr-only">{t("catalog.sortBy")}</span>
              <select className="input" value={filters.sort} onChange={(e) => update({ orden: e.target.value === "featured" ? null : e.target.value })}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t("catalog.sortBy")}: {t(`catalog.sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="catalog__chips">
            {chips.map((c) => (
              <button key={c.key} className="filter-chip" onClick={() => removeChip(c.key)}>
                {c.label} <X size={14} weight="bold" />
              </button>
            ))}
            {chips.length > 1 && (
              <button className="catalog__clear" onClick={clearAll}>
                {t("catalog.clearAll")}
              </button>
            )}
          </div>
        )}

        <div className="catalog__body">
          <aside className="catalog__aside" aria-label={t("catalog.filters")}>
            <FiltersPanel base={base} filters={filters} update={update} />
          </aside>

          <div className="catalog__results">
            {status === "error" ? (
              <Notice tone="error">
                {t("store.loadError")}{" "}
                <button className="section-head__link" onClick={retry}>
                  {t("common.retry")}
                </button>
              </Notice>
            ) : status === "loading" ? (
              <div className="product-grid">
                {Array.from({ length: 8 }, (_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <EmptyState icon={filters.q ? MagnifyingGlass : Funnel} title={t("catalog.noResults")} text={t("catalog.noResultsText")}>
                {suggestion && (
                  <p>
                    {t("catalog.didYouMean")}{" "}
                    <Link className="section-head__link" to={`/tienda/productos?q=${encodeURIComponent(suggestion)}`}>
                      {suggestion}
                    </Link>
                    ?
                  </p>
                )}
                <div className="row row--wrap" style={{ justifyContent: "center" }}>
                  {activeCount > 0 && (
                    <Button variant="secondary" onClick={clearAll}>
                      {t("catalog.clearAll")}
                    </Button>
                  )}
                  <Button to="/tienda/productos">{t("store.allProducts")}</Button>
                </div>
              </EmptyState>
            ) : (
              <>
                <div className="product-grid">
                  {results.slice(0, shown).map((p, i) => (
                    <Fragment key={p.id}>
                      {i === LOCAL_ADS_AFTER && <LocalAds />}
                      <ProductCard product={p} eager={i < 6} />
                    </Fragment>
                  ))}
                </div>
                {results.length <= LOCAL_ADS_AFTER && <LocalAds />}
                <div className="catalog__more">
                  <p className="muted small">{t("catalog.showing", { shown: Math.min(shown, results.length), total: results.length })}</p>
                  {shown < results.length && (
                    <Button variant="secondary" size="lg" onClick={() => setShown((n) => n + PAGE)}>
                      {t("catalog.loadMore")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <Drawer open={drawer} onClose={() => setDrawer(false)} title={t("catalog.filters")} side="left" className="theme-store" closeLabel={t("common.close")}>
          <FiltersPanel base={base} filters={filters} update={update} onDone={() => setDrawer(false)} />
        </Drawer>
      </div>
    </AdLayout>
  );
}
