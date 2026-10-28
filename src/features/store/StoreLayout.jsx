import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { CaretDown, Fire, Heart, List, Sparkle, X } from "@phosphor-icons/react";
import { useCatalog } from "@/context/CatalogContext";
import { useWishlist } from "@/context/WishlistContext";
import { useI18n } from "@/i18n";
import { categoryLabel, departmentLabel } from "@/lib/products";
import { CategoryIcon, DepartmentIcon } from "./components/CategoryIcon";
import SearchBox from "./components/SearchBox";
import "./store.css";

function DepartmentsMenu() {
  const { t, lang } = useI18n();
  const { departments } = useCatalog();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname, search } = useLocation();

  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="depts" ref={ref}>
      <button className="depts__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
        <span>{t("store.departments")}</span>
        <CaretDown size={14} weight="bold" className="depts__caret" />
      </button>
      {open && (
        <div className="depts__panel" role="menu">
          <Link to="/tienda/productos" className="depts__all" role="menuitem">
            {t("store.allProducts")} →
          </Link>
          <div className="depts__grid">
            {departments.map((d) => (
              <div key={d.key} className="depts__col">
                <Link to={`/tienda/productos?dep=${encodeURIComponent(d.key)}`} className="depts__dept" role="menuitem">
                  <DepartmentIcon department={d.value} size={20} />
                  {departmentLabel(d.value, lang)}
                  <span className="depts__count">{d.count}</span>
                </Link>
                {d.categories.map((c) => (
                  <Link key={c.key} to={`/tienda/productos?cat=${encodeURIComponent(c.key)}`} className="depts__cat" role="menuitem">
                    <CategoryIcon category={c.value} size={18} />
                    {categoryLabel(c.value, lang)}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreLayout() {
  const { t, lang } = useI18n();
  const { categories } = useCatalog();
  const wishlist = useWishlist();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const q = pathname === "/tienda/productos" ? params.get("q") || "" : "";
  const focusMode = pathname.startsWith("/tienda/checkout");

  return (
    <div className="store">
      {!focusMode && (
        <div className="store-bar">
          <div className="container container--wide store-bar__inner">
            <DepartmentsMenu />
            <SearchBox initial={q} className="store-bar__search" />
            <nav className="store-bar__links" aria-label={t("store.title")}>
              <NavLink to="/tienda/productos?ofertas=1" className="store-bar__link">
                <Fire size={18} weight="fill" /> {t("store.deals")}
              </NavLink>
              <NavLink to="/tienda/productos?orden=newest" className="store-bar__link">
                <Sparkle size={18} weight="fill" /> {t("store.newArrivals")}
              </NavLink>
              <NavLink to="/tienda/favoritos" className="store-bar__link">
                <Heart size={18} weight="fill" /> {t("store.favorites")}
                {wishlist.count > 0 && <span className="store-bar__count">{wishlist.count}</span>}
              </NavLink>
            </nav>
          </div>
          <div className="store-cats">
            <div className="container container--wide">
              <div className="store-cats__row">
                <Link to="/tienda/productos?ofertas=1" className="store-cats__chip store-cats__chip--hot">
                  <Fire size={16} weight="fill" /> {t("store.deals")}
                </Link>
                {categories.slice(0, 12).map((c) => (
                  <Link key={c.key} to={`/tienda/productos?cat=${encodeURIComponent(c.key)}`} className="store-cats__chip">
                    <CategoryIcon category={c.value} size={16} weight="bold" /> {categoryLabel(c.value, lang)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
