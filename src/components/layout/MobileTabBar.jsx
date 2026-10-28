import { NavLink } from "react-router-dom";
import { UserCircle } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { useServices } from "./SiteHeader";

/** App-style bottom navigation on phones. */
export default function MobileTabBar() {
  const { t } = useI18n();
  const services = useServices();
  const tabs = [...services, { to: "/cuenta", key: "account", icon: UserCircle }];
  return (
    <nav className="tabbar theme-dark" aria-label={t("nav.menu")}>
      {tabs.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={key} to={to} end={end} className={({ isActive }) => `tabbar__item ${isActive ? "is-active" : ""}`}>
          {({ isActive }) => (
            <>
              <Icon size={24} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
              <span>{key === "account" ? t("nav.accountShort") : t(`nav.${key}`)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
