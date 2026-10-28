import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import CartDrawer from "@/features/store/cart/CartDrawer";
import ActiveServiceBar from "@/features/tracking/ActiveServiceBar";
import { useI18n } from "@/i18n";
import { AnnouncementBar, DemoBanner, WhatsAppFab } from "./Extras";
import MobileTabBar from "./MobileTabBar";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

function themeFor(pathname) {
  if (pathname === "/") return "theme-light theme-home";
  if (pathname.startsWith("/viajes")) return "theme-travel";
  if (pathname.startsWith("/tienda")) return "theme-store";
  return "theme-light";
}

export default function SiteLayout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const theme = themeFor(pathname);
  // Checkout and trip booking hide the bottom tabs on phones so nothing gets in the way of finishing
  const focus = pathname === "/tienda/checkout" || /^\/viajes\/[^/]+\/reservar$/.test(pathname);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return (
    <div className={`app ${theme} ${focus ? "app--focus" : ""}`}>
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <DemoBanner />
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" className="app__main">
        <Outlet />
      </main>
      <SiteFooter />
      <ActiveServiceBar />
      {!focus && <MobileTabBar />}
      <CartDrawer />
      <WhatsAppFab />
    </div>
  );
}
