import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { Fire, Heart, Sparkle } from "@phosphor-icons/react";
import { useCatalog } from "@/context/CatalogContext";
import { useWishlist } from "@/context/WishlistContext";
import { useI18n } from "@/i18n";
import { categoryLabel } from "@/lib/products";
import { CategoryIcon } from "./components/CategoryIcon";
import { DepartmentsMenu } from "./components/Departments";
import SearchBox from "./components/SearchBox";
import "./store.css";

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
          <div className="container container--full store-bar__inner">
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
            <div className="container container--full">
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
