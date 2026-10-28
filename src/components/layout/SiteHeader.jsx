import { Link, NavLink, useLocation } from "react-router-dom";
import { AirplaneTilt, Car, House, ShoppingCartSimple, Storefront, Translate, UserCircle } from "@phosphor-icons/react";
import Logo from "@/components/brand/Logo";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { initials } from "@/lib/text";

export const SERVICES = [
  { to: "/", key: "home", icon: House, end: true },
  { to: "/tienda", key: "store", icon: Storefront, setting: "store" },
  { to: "/ride", key: "ride", icon: Car, setting: "ride" },
  { to: "/viajes", key: "travel", icon: AirplaneTilt, setting: "travel" },
];

export function useServices() {
  const settings = useSettings();
  return SERVICES.filter((s) => !s.setting || settings[s.setting]?.enabled !== false);
}

export function LangToggle({ className = "" }) {
  const { t, toggle } = useI18n();
  return (
    <button className={`lang-toggle ${className}`} onClick={toggle} aria-label={`${t("nav.languageLabel")}: ${t("nav.otherLangLong")}`}>
      <Translate size={18} weight="bold" aria-hidden="true" />
      <span>{t("nav.otherLang")}</span>
    </button>
  );
}

export function CartButton({ className = "" }) {
  const { t } = useI18n();
  const { count, openDrawer } = useCart();
  return (
    <button className={`header-icon-btn ${className}`} onClick={openDrawer} aria-label={`${t("nav.cart")} (${count})`}>
      <ShoppingCartSimple size={24} weight="bold" />
      {count > 0 && (
        <span className="header-badge" key={count}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function AccountButton() {
  const { t } = useI18n();
  const { user, info } = useAuth();
  return (
    <Link to="/cuenta" className="header-account">
      {user ? (
        <span className="avatar" aria-hidden="true">
          {initials(info.fullName || user.email) || "?"}
        </span>
      ) : (
        <UserCircle size={26} weight="bold" aria-hidden="true" />
      )}
      <span className="header-account__label">{user ? info.firstName || t("nav.account") : t("nav.signIn")}</span>
    </Link>
  );
}

export default function SiteHeader() {
  const { t } = useI18n();
  const services = useServices();
  const { pathname } = useLocation();

  return (
    <header className="site-header theme-dark">
      <div className="site-header__inner container container--wide">
        <Link to="/" className="site-header__logo" aria-label="Inicio">
          <Logo tone="dark" />
        </Link>

        <nav className="service-nav" aria-label="Servicios">
          {services.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={key} to={to} end={end} className={({ isActive }) => `service-nav__link ${isActive ? "is-active" : ""}`}>
              <Icon size={19} weight={pathname === to || (!end && pathname.startsWith(to)) ? "fill" : "bold"} aria-hidden="true" />
              <span>{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <LangToggle />
          <AccountButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
