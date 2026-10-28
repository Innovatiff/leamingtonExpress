import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CaretDown, CaretLeft, CaretRight, Fire, Heart, Lightning, List, Sparkle, SquaresFour, X } from "@phosphor-icons/react";
import { SmartImage } from "@/components/ui/Misc";
import { Drawer } from "@/components/ui/Overlay";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { categoryLabel, departmentLabel, productPath } from "@/lib/products";
import { catalogLink, useMediaQuery, useMerch } from "../merch";
import { CategoryIcon, DepartmentIcon } from "./CategoryIcon";

const pct = (n) => `−${n}%`;

/** Round product photo with a label underneath (Walmart-style). */
export function Bubble({ to, image, icon, label, meta, tag, tone = "", className = "" }) {
  return (
    <Link to={to} className={`bubble ${tone ? `bubble--${tone}` : ""} ${className}`}>
      <span className="bubble__img">
        {image ? <SmartImage src={image} alt="" w={240} /> : icon}
        {tag && <span className="bubble__tag">{tag}</span>}
      </span>
      <span className="bubble__label">{label}</span>
      {meta && <span className="bubble__meta">{meta}</span>}
    </Link>
  );
}

function DealCard({ product: p }) {
  const { t } = useI18n();
  return (
    <Link to={productPath(p)} className="mega-deal">
      <span className="mega-deal__kicker">
        <Lightning size={14} weight="fill" /> {t("store.featuredDeal")}
      </span>
      <span className="mega-deal__img">
        <SmartImage src={p.image} alt="" w={360} />
        <span className="mega-deal__pct">{pct(p.discountPct)}</span>
      </span>
      <span className="mega-deal__name">{p.name}</span>
      <span className="mega-deal__price">
        <strong>{money(p.price)}</strong>
        <s>{money(p.compareAt)}</s>
      </span>
    </Link>
  );
}

/** Desktop: departments on the left, the hovered department's categories as photo bubbles on the right. */
function MegaMenu({ id, tree }) {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(tree[0]?.key);
  const touchPreview = useRef(null);
  const dept = tree.find((d) => d.key === active) || tree[0];
  const name = dept ? departmentLabel(dept.value, lang) : "";

  return (
    <div className="mega" id={id}>
      <nav className="mega__rail" aria-label={t("store.departments")}>
        <ul className="mega__depts">
          {tree.map((d) => (
            <li key={d.key}>
              <Link
                to={catalogLink.department(d.key)}
                className={`mega__dept ${d.key === dept?.key ? "is-active" : ""}`}
                onMouseEnter={() => setActive(d.key)}
                onFocus={() => setActive(d.key)}
                // Touch screens can't hover: the first tap shows the department, the second opens it
                onPointerDown={(e) => {
                  touchPreview.current = e.pointerType !== "mouse" && d.key !== dept?.key ? d.key : null;
                }}
                onClick={(e) => {
                  if (touchPreview.current !== d.key) return;
                  e.preventDefault();
                  touchPreview.current = null;
                  setActive(d.key);
                }}
              >
                <span className="mega__dept-img">{d.image ? <SmartImage src={d.image} alt="" w={120} /> : <DepartmentIcon department={d.value} size={22} />}</span>
                <span className="mega__dept-name">{departmentLabel(d.value, lang)}</span>
                <CaretRight size={14} weight="bold" className="mega__dept-caret" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mega__links">
          <Link to="/tienda/productos?ofertas=1&orden=discount" className="mega__link mega__link--hot">
            <Fire size={18} weight="fill" /> {t("store.deals")}
          </Link>
          <Link to="/tienda/productos?orden=newest" className="mega__link">
            <Sparkle size={18} weight="fill" /> {t("store.newArrivals")}
          </Link>
          <Link to="/tienda/productos" className="mega__link">
            <SquaresFour size={18} weight="fill" /> {t("store.allProducts")}
          </Link>
        </div>
      </nav>

      {dept && (
        <section className="mega__main" aria-label={name} key={dept.key}>
          <header className="mega__head">
            <div>
              <h2 className="mega__title">{name}</h2>
              <p className="mega__sub">
                {t("catalog.results", { n: dept.count })}
                {dept.maxDiscount >= 5 && (
                  <>
                    {" · "}
                    <Link to={catalogLink.department(dept.key, "&ofertas=1&orden=discount")} className="mega__save">
                      {t("store.upToOff", { pct: dept.maxDiscount })}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Link to={catalogLink.department(dept.key)} className="section-head__link">
              {t("store.seeAllIn", { name })} <ArrowRight size={16} weight="bold" />
            </Link>
          </header>
          <div className={`mega__body ${dept.bestDeal ? "mega__body--deal" : ""}`}>
            <div className="mega__bubbles">
              {dept.categories.map((c) => (
                <Bubble
                  key={c.key}
                  to={catalogLink.category(c.key)}
                  image={c.image}
                  icon={<CategoryIcon category={c.value} size={34} />}
                  label={categoryLabel(c.value, lang)}
                  meta={t("catalog.results", { n: c.count })}
                />
              ))}
            </div>
            {dept.bestDeal && <DealCard product={dept.bestDeal} />}
          </div>
        </section>
      )}
    </div>
  );
}

/** Phones and tablets: full-screen list of departments that drills into categories. */
function DepartmentsSheet({ open, onClose, tree, categories }) {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState(null);
  const backRef = useRef(null);
  const rowRefs = useRef({});
  const returnTo = useRef(null);
  const dept = tree.find((d) => d.key === current);
  const name = dept ? departmentLabel(dept.value, lang) : "";

  useEffect(() => {
    if (open) return;
    returnTo.current = null;
    setCurrent(null);
  }, [open]);

  // Move focus with the view, so keyboard and screen-reader users don't get lost
  useEffect(() => {
    if (current) backRef.current?.focus({ preventScroll: true });
    else if (returnTo.current) rowRefs.current[returnTo.current]?.focus({ preventScroll: true });
    document.querySelector(".depts-sheet .drawer__body")?.scrollTo({ top: 0 });
  }, [current]);

  const drill = (key) => {
    returnTo.current = key;
    setCurrent(key);
  };

  return (
    <Drawer open={open} onClose={onClose} side="left" className="theme-store depts-sheet" title={dept ? name : t("store.departments")} closeLabel={t("common.close")}>
      {dept ? (
        <div className="dsheet dsheet--level" key={dept.key}>
          <button ref={backRef} className="dsheet__back" onClick={() => setCurrent(null)}>
            <CaretLeft size={18} weight="bold" /> {t("store.allDepartments")}
          </button>
          <Link to={catalogLink.department(dept.key)} className="dsheet__hero">
            <span className="dsheet__hero-img">{dept.image ? <SmartImage src={dept.image} alt="" w={200} /> : <DepartmentIcon department={dept.value} size={30} />}</span>
            <span className="dsheet__hero-text">
              <strong>{t("store.seeAllIn", { name })}</strong>
              <small>{t("catalog.results", { n: dept.count })}</small>
            </span>
            <ArrowRight size={20} weight="bold" />
          </Link>
          {dept.dealCount > 0 && (
            <Link to={catalogLink.department(dept.key, "&ofertas=1&orden=discount")} className="dsheet__deals">
              <Fire size={20} weight="fill" />
              <span className="grow">{t("store.dealsIn", { name })}</span>
              <span className="dsheet__pct">{t("store.upToOff", { pct: dept.maxDiscount })}</span>
            </Link>
          )}
          <h3 className="dsheet__title">{t("store.categoriesTitle")}</h3>
          <div className="dsheet__bubbles">
            {dept.categories.map((c) => (
              <Bubble
                key={c.key}
                to={catalogLink.category(c.key)}
                image={c.image}
                icon={<CategoryIcon category={c.value} size={30} />}
                label={categoryLabel(c.value, lang)}
                meta={t("catalog.results", { n: c.count })}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="dsheet">
          <div className="dsheet__quick">
            <Link to="/tienda/productos?ofertas=1&orden=discount" className="dsheet__pill dsheet__pill--hot">
              <Fire size={18} weight="fill" /> {t("store.deals")}
            </Link>
            <Link to="/tienda/productos?orden=newest" className="dsheet__pill">
              <Sparkle size={18} weight="fill" /> {t("store.newArrivals")}
            </Link>
            <Link to="/tienda/favoritos" className="dsheet__pill">
              <Heart size={18} weight="fill" /> {t("store.favorites")}
            </Link>
          </div>

          <h3 className="dsheet__title">{t("store.shopByDepartment")}</h3>
          <ul className="dsheet__list">
            {tree.map((d) => (
              <li key={d.key}>
                <button
                  className="dsheet__row"
                  ref={(el) => {
                    rowRefs.current[d.key] = el;
                  }}
                  onClick={() => drill(d.key)}
                >
                  <span className="dsheet__row-img">{d.image ? <SmartImage src={d.image} alt="" w={140} /> : <DepartmentIcon department={d.value} size={26} />}</span>
                  <span className="dsheet__row-text">
                    <strong>{departmentLabel(d.value, lang)}</strong>
                    <small>
                      {t("catalog.results", { n: d.count })}
                      {d.maxDiscount >= 5 && <em> · {t("store.upToOff", { pct: d.maxDiscount })}</em>}
                    </small>
                  </span>
                  <CaretRight size={18} weight="bold" className="dsheet__row-caret" />
                </button>
              </li>
            ))}
          </ul>

          {categories.length > 0 && (
            <>
              <h3 className="dsheet__title">{t("store.popularCategories")}</h3>
              <div className="dsheet__bubbles">
                {categories.slice(0, 9).map((c) => (
                  <Bubble key={c.key} to={catalogLink.category(c.key)} image={c.image} icon={<CategoryIcon category={c.value} size={30} />} label={categoryLabel(c.value, lang)} />
                ))}
              </div>
            </>
          )}

          <Link to="/tienda/productos" className="btn btn--secondary btn--lg btn--block dsheet__all">
            {t("store.allProducts")} <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
      )}
    </Drawer>
  );
}

/** "Departments" button in the store bar: mega menu on desktop, full-screen sheet on phones. */
export function DepartmentsMenu() {
  const { t } = useI18n();
  const { departments: tree, categories } = useMerch();
  const desktop = useMediaQuery("(min-width: 900px)");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const { pathname, search } = useLocation();

  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open || !desktop) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, desktop]);

  return (
    <div className="depts" ref={ref}>
      <button ref={buttonRef} className="depts__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={desktop && open ? panelId : undefined} aria-label={t("store.departments")}>
        {open && desktop ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
        <span>{t("store.departments")}</span>
        <CaretDown size={14} weight="bold" className="depts__caret" />
      </button>
      {desktop ? open && tree.length > 0 && <MegaMenu id={panelId} tree={tree} /> : <DepartmentsSheet open={open} onClose={() => setOpen(false)} tree={tree} categories={categories} />}
    </div>
  );
}

/** Store home: "Shop by category" photo bubbles — one row with arrows on desktop, two swipeable rows on phones. */
export function CategoryBubbles() {
  const { t, lang } = useI18n();
  const { categories, bestDeal, deals } = useMerch();
  const ref = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const items = categories.slice(0, 18);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  if (!items.length) return null;
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="cat-bubbles-wrap">
      <div className="section-head">
        <h2 className="section-head__title">{t("store.categoriesTitle")}</h2>
        <div className="rail__actions">
          <Link to="/tienda/productos" className="section-head__link">
            {t("store.exploreAll")} <ArrowRight size={16} weight="bold" />
          </Link>
          {canScroll && (
            <>
              <button className="rail__arrow" onClick={() => scroll(-1)} aria-label="←">
                <CaretLeft size={18} weight="bold" />
              </button>
              <button className="rail__arrow" onClick={() => scroll(1)} aria-label="→">
                <CaretRight size={18} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className={`cat-bubbles ${items.length + 2 > 8 ? "cat-bubbles--rows" : ""}`} ref={ref}>
        {bestDeal && <Bubble tone="deal" to="/tienda/productos?ofertas=1&orden=discount" image={bestDeal.image} label={t("store.deals")} tag={pct(deals[0].discountPct)} />}
        {items.map((c) => (
          <Bubble key={c.key} to={catalogLink.category(c.key)} image={c.image} icon={<CategoryIcon category={c.value} size={34} />} label={categoryLabel(c.value, lang)} />
        ))}
        <Bubble tone="all" to="/tienda/productos" icon={<SquaresFour size={34} weight="duotone" />} label={t("store.seeEverything")} />
      </div>
    </section>
  );
}
