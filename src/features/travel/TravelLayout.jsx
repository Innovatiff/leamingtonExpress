import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { AirplaneTilt, Fire, UsersThree } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/Misc";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import "./travel.css";

const TYPES = ["day", "weekend", "multi"];

export default function TravelLayout() {
  const { t } = useI18n();
  const settings = useSettings();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onCatalog = pathname === "/viajes" || pathname === "/viajes/";
  const focusMode = /\/reservar$/.test(pathname);
  const tipo = onCatalog ? params.get("tipo") || "" : null;
  const offers = onCatalog && params.get("ofertas") === "1";

  if (settings.travel?.enabled === false) {
    return (
      <div className="tv">
        <div className="container container--narrow tv-disabled">
          <Notice tone="info">{t("travel.disabled")}</Notice>
          <Button to="/">{t("common.home")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tv">
      {!focusMode && (
        <div className="tv-bar">
          <div className="container tv-bar__inner">
            <Link to="/viajes" className="tv-bar__brand">
              <AirplaneTilt size={20} weight="fill" />
              {t("travel.brand")}
            </Link>
            <nav className="tv-bar__nav" aria-label={t("travel.brand")}>
              <Link to="/viajes#lista" className={`tv-bar__link ${tipo === "" && !offers ? "is-active" : ""}`}>
                {t("travel.navAll")}
              </Link>
              {TYPES.map((type) => (
                <Link key={type} to={`/viajes?tipo=${type}#lista`} className={`tv-bar__link ${tipo === type ? "is-active" : ""}`}>
                  {t(`travel.typePlural.${type}`)}
                </Link>
              ))}
              <Link to="/viajes?ofertas=1#lista" className={`tv-bar__link tv-bar__link--hot ${offers ? "is-active" : ""}`}>
                <Fire size={16} weight="fill" /> {t("travel.navOffers")}
              </Link>
              <Link to="/contacto?tema=viajes" className="tv-bar__link">
                <UsersThree size={16} weight="bold" /> {t("travel.navGroups")}
              </Link>
            </nav>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
