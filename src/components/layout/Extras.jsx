import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Megaphone, WhatsappLogo, X } from "@phosphor-icons/react";
import { CITY, IS_DEMO } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { phoneDigits } from "@/lib/format";
import { readJSON, writeJSON } from "@/lib/storage";

/** Scroll to top on page change (keeps #hash links working). */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

export function AnnouncementBar() {
  const { tx } = useI18n();
  const { announcement } = useSettings();
  const text = tx(announcement);
  const [hidden, setHidden] = useState(() => readJSON("lx_announce_closed", "", "session"));
  if (!text || hidden === text) return null;
  return (
    <div className="announce" role="note">
      <Megaphone size={18} weight="fill" aria-hidden="true" />
      <span>{text}</span>
      <button
        className="announce__close"
        aria-label="Close"
        onClick={() => {
          setHidden(text);
          writeJSON("lx_announce_closed", text, "session");
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function WhatsAppFab() {
  const { t, lang } = useI18n();
  const { contact } = useSettings();
  const { pathname } = useLocation();
  if (!contact.whatsapp || pathname.startsWith("/tienda/checkout")) return null;
  const msg = lang === "es" ? `¡Hola ${CITY.brand}! Tengo una pregunta.` : `Hi ${CITY.brand}! I have a question.`;
  return (
    <a
      className={`wa-fab ${pathname.startsWith("/tienda/producto/") || /^\/viajes\/(?!reserva\/)[^/]+$/.test(pathname) ? "wa-fab--raised" : ""}`}
      href={`https://wa.me/${phoneDigits(contact.whatsapp)}?text=${encodeURIComponent(msg)}`}
      target="_blank"
      rel="noreferrer"
      aria-label={t("common.writeWhatsapp")}
    >
      <WhatsappLogo size={30} weight="fill" />
    </a>
  );
}

export function DemoBanner() {
  if (!IS_DEMO) return null;
  return (
    <div className="demo-banner" role="note">
      DEMO · datos de ejemplo — nada se guarda en Firebase · sample data, nothing is saved
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="center-block" aria-busy="true">
      <div className="spinner" />
    </div>
  );
}
