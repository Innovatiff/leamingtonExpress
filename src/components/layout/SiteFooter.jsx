import { Link } from "react-router-dom";
import { EnvelopeSimple, FacebookLogo, InstagramLogo, MapPin, Phone, TiktokLogo, WhatsappLogo } from "@phosphor-icons/react";
import Logo from "@/components/brand/Logo";
import { CITY, OTHER_CITIES } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { formatPhone, phoneDigits } from "@/lib/format";

export default function SiteFooter() {
  const { t, lang } = useI18n();
  const { contact, store } = useSettings();
  const year = new Date().getFullYear();
  const socials = [
    contact.instagram && { href: contact.instagram, icon: InstagramLogo, label: "Instagram" },
    contact.facebook && { href: contact.facebook, icon: FacebookLogo, label: "Facebook" },
    contact.tiktok && { href: contact.tiktok, icon: TiktokLogo, label: "TikTok" },
  ].filter(Boolean);
  const pays = ["cash", "etransfer", "card"].filter((k) => store.payments?.[k]);

  return (
    <footer className="site-footer theme-dark">
      <div className="container container--wide">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Logo tone="dark" size="lg" />
            <p className="site-footer__slogan">{t("brand.footerSlogan")}</p>
            {socials.length > 0 && (
              <div className="site-footer__socials">
                {socials.map(({ href, icon: Icon, label }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                    <Icon size={22} weight="fill" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav className="site-footer__col" aria-label={t("footer.shop")}>
            <h3>{t("footer.shop")}</h3>
            <Link to="/tienda/productos">{t("footer.allProducts")}</Link>
            <Link to="/tienda/productos?ofertas=1">{t("footer.deals")}</Link>
            <Link to="/tienda/productos?orden=newest">{t("footer.newArrivals")}</Link>
            <Link to="/tienda/favoritos">{t("nav.favorites")}</Link>
          </nav>

          <nav className="site-footer__col" aria-label={t("footer.services")}>
            <h3>{t("footer.services")}</h3>
            <Link to="/ride">{t("footer.requestRide")}</Link>
            <Link to="/viajes">{t("footer.trips")}</Link>
            <Link to="/seguimiento">{t("track.title")}</Link>
            <Link to="/cuenta">{t("nav.account")}</Link>
          </nav>

          <nav className="site-footer__col" aria-label={t("footer.help")}>
            <h3>{t("footer.help")}</h3>
            <Link to="/ayuda">{t("footer.faq")}</Link>
            <Link to="/contacto">{t("nav.contact")}</Link>
            <Link to="/privacidad">{t("footer.privacy")}</Link>
            <Link to="/terminos">{t("footer.terms")}</Link>
          </nav>

          <div className="site-footer__col">
            <h3>{t("footer.contact")}</h3>
            {contact.whatsapp && (
              <a href={`https://wa.me/${phoneDigits(contact.whatsapp)}`} target="_blank" rel="noreferrer">
                <WhatsappLogo size={18} weight="fill" /> {formatPhone(contact.whatsapp)}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:+${phoneDigits(contact.phone)}`}>
                <Phone size={18} weight="fill" /> {formatPhone(contact.phone)}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <EnvelopeSimple size={18} weight="fill" /> {contact.email}
              </a>
            )}
            {contact.address && (
              <span>
                <MapPin size={18} weight="fill" /> {contact.address}
              </span>
            )}
            {!contact.whatsapp && !contact.phone && !contact.email && <Link to="/contacto">{t("nav.contact")} →</Link>}
            {pays.length > 0 && (
              <div className="site-footer__pays">
                <span className="tiny muted">{t("footer.payments")}</span>
                <div className="row row--wrap" style={{ "--row-gap": "6px" }}>
                  {pays.map((k) => (
                    <span key={k} className="pay-pill">
                      {t(`payments.${k}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="site-footer__cities">
          <span>{t("footer.cities")}:</span>
          {OTHER_CITIES.map((c) => (
            <span key={c.id} className="city-pill">
              {c.brand}
              {!c.active && <em>{t("common.comingSoon")}</em>}
            </span>
          ))}
        </div>

        <div className="site-footer__bottom">
          <span>
            © {year} {CITY.brand}. {t("footer.rights")}
          </span>
          <span lang={lang === "es" ? "en" : "es"} className="muted">
            {CITY.name}, Ontario · Canada
          </span>
        </div>
      </div>
    </footer>
  );
}
