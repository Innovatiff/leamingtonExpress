// Ads on the shop and travel pages (managed in Admin → Ads; see lib/ads.js).
// Big screens: a column on each side of the page for local businesses and
// restaurants. Phones and tablets: the same ads as a row of cards between
// sections. Everywhere: sponsored product banners between sections.
// Empty side spots invite local businesses to advertise.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ForkKnife, MapPin, Megaphone, Storefront } from "@phosphor-icons/react";
import { Photo, SmartImage } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useCatalog } from "@/context/CatalogContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { isExternal, liveAds, rotate, splitRails } from "@/lib/ads";
import { money } from "@/lib/format";
import { productPath } from "@/lib/products";
import "./ads.css";

const AdsContext = createContext(null);
const randomOffset = () => Math.floor(Math.random() * 1000);
export const ADVERTISE_LINK = "/contacto?anuncio=1";

/** The ads showing on this page, starting at a random one so every advertiser gets the first spot. */
function usePageAds(page) {
  const { ads } = useSettings();
  const [offset] = useState(randomOffset);
  return useMemo(() => {
    const live = liveAds(ads, page);
    return { side: rotate(live.side, offset), banner: rotate(live.banner, offset) };
  }, [ads, page, offset]);
}

/** The ad's link: other websites open in a new tab and are marked as paid links. */
function AdLink({ url, preview, className, children, label }) {
  if (preview || !url) {
    return (
      <div className={className} aria-label={label}>
        {children}
      </div>
    );
  }
  if (isExternal(url) || /^(tel|mailto):/i.test(url)) {
    return (
      <a href={url} className={className} target={isExternal(url) ? "_blank" : undefined} rel="sponsored noopener" aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link to={url} className={className} aria-label={label}>
      {children}
    </Link>
  );
}

/* ----------------------------- Side ads ------------------------------ */

/** A local business or restaurant: photo, name, offer and a button (or the business's own design). */
export function SideAd({ ad, preview }) {
  const { t } = useI18n();
  const label = [ad.name, ad.title].filter(Boolean).join(" — ") || t("ads.sponsored");
  return (
    <AdLink url={ad.url} preview={preview} label={label} className={`side-ad side-ad--${ad.theme} ${ad.creative ? "side-ad--creative" : ""}`}>
      <span className="ads-badge">{t("ads.sponsored")}</span>
      {ad.creative ? (
        <Photo src={ad.creative} alt="" className="side-ad__creative" sizes="(min-width: 1280px) 300px, 80vw" w={600} />
      ) : (
        <>
          {ad.image && (
            <span className="side-ad__media">
              <Photo src={ad.image} alt="" className="side-ad__photo" sizes="(min-width: 1280px) 300px, 80vw" w={600} />
            </span>
          )}
          <span className="side-ad__body">
            {ad.name && <span className="side-ad__name">{ad.name}</span>}
            {ad.title && <strong className="side-ad__title">{ad.title}</strong>}
            {ad.text && <span className="side-ad__text">{ad.text}</span>}
            {ad.note && (
              <span className="side-ad__note">
                <MapPin size={14} weight="fill" aria-hidden="true" />
                {ad.note}
              </span>
            )}
            {(ad.url || preview) && (
              <span className="side-ad__cta">
                {ad.cta || t("ads.learnMore")} <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
              </span>
            )}
          </span>
        </>
      )}
    </AdLink>
  );
}

/** An empty spot: invites local businesses (left) and restaurants (right) to advertise. */
export function HouseAd({ variant = "business", compact }) {
  const { t } = useI18n();
  const food = variant === "food";
  const Icon = food ? ForkKnife : Storefront;
  return (
    <Link to={ADVERTISE_LINK} className={`house-ad house-ad--${variant} ${compact ? "house-ad--compact" : ""}`}>
      <span className="house-ad__tag">
        <Megaphone size={14} weight="fill" aria-hidden="true" /> {t("ads.space")}
      </span>
      <span className="house-ad__icon">
        <Icon size={30} weight="duotone" aria-hidden="true" />
      </span>
      <span className="house-ad__copy">
        <strong className="house-ad__title">{food ? t("ads.houseFoodTitle") : t("ads.houseTitle")}</strong>
        <span className="house-ad__text">{food ? t("ads.houseFoodText") : t("ads.houseText", { city: CITY.name })}</span>
      </span>
      <span className="house-ad__cta">
        {t("ads.houseCta")} <ArrowRight size={14} weight="bold" aria-hidden="true" />
      </span>
    </Link>
  );
}

const prefersStill = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** One column of side ads: one at a time, changing every few seconds when there are several. */
function AdRail({ ads, side }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = ads.length;

  useEffect(() => {
    if (count < 2 || paused || prefersStill()) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 9000);
    return () => clearInterval(id);
  }, [count, paused]);

  const at = count ? index % count : 0;
  const current = ads[at];
  return (
    <aside className={`ads-rail ads-rail--${side}`} aria-label={t("ads.label")}>
      <div
        className="ads-rail__sticky"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <span className="ads-rail__label">{t("ads.label")}</span>
        {current ? <SideAd key={current.id} ad={current} /> : <HouseAd variant={side === "left" ? "business" : "food"} />}
        {count > 1 && (
          <div className="ads-rail__dots">
            {ads.map((ad, i) => (
              <button key={ad.id} type="button" className={i === at ? "is-active" : ""} onClick={() => setIndex(i)} aria-label={t("ads.show", { n: i + 1 })} aria-current={i === at} />
            ))}
          </div>
        )}
        {current && (
          <Link to={ADVERTISE_LINK} className="ads-rail__sell">
            {t("ads.wantToAdvertise")}
          </Link>
        )}
      </div>
    </aside>
  );
}

/**
 * The page between two ad columns (big screens). Everything inside can use
 * <LocalAds /> and <SponsoredSlot /> to show the page's ads.
 */
export function AdLayout({ page, children, className = "" }) {
  const ads = usePageAds(page);
  const { left, right } = splitRails(ads.side);
  return (
    <AdsContext.Provider value={ads}>
      <div className={`ads-layout ads-layout--${page} container container--full ${className}`}>
        <AdRail ads={left} side="left" />
        <div className="ads-layout__main">{children}</div>
        <AdRail ads={right} side="right" />
      </div>
    </AdsContext.Provider>
  );
}

/** Phones and tablets: the local ads as a row of cards (an invitation to advertise when there are none). */
export function LocalAds() {
  const { t } = useI18n();
  const ads = useContext(AdsContext);
  if (!ads) return null;
  if (!ads.side.length) {
    return (
      <div className="local-ads local-ads--empty">
        <HouseAd compact />
      </div>
    );
  }
  return (
    <section className="local-ads" aria-label={t("ads.localTitle", { city: CITY.name })}>
      <div className="section-head">
        <div>
          <span className="ads-rail__label">{t("ads.label")}</span>
          <h2 className="section-head__title">{t("ads.localTitle", { city: CITY.name })}</h2>
        </div>
      </div>
      <div className="scroller local-ads__row">
        {ads.side.map((ad) => (
          <SideAd key={ad.id} ad={ad} />
        ))}
        <HouseAd compact />
      </div>
    </section>
  );
}

/* --------------------------- Sponsored banners --------------------------- */

/** A sponsored product or brand across the page: name, offer, photo and a button (or the sponsor's own design). */
export function SponsoredBanner({ ad, preview }) {
  const { t } = useI18n();
  const { byId } = useCatalog();
  const product = ad.productId ? byId.get(ad.productId) || null : null;
  const url = ad.url || (product ? productPath(product) : "");
  const image = ad.image || product?.image || "";
  // a photo fills the circle; a product photo (white background) shows whole
  const fill = ad.fit ? ad.fit === "cover" : Boolean(ad.image);
  const title = ad.title || product?.name || ad.name;
  if (!ad.creative && !title && !image) return null;
  const label = [ad.name, title].filter(Boolean).join(" — ") || t("ads.sponsored");
  return (
    <div className="sp-banner-wrap">
      <span className="sp-banner__label">{t("ads.sponsored")}</span>
      <AdLink url={url} preview={preview} label={label} className={`sp-banner sp-banner--${ad.theme} ${ad.creative ? "sp-banner--creative" : ""}`}>
        {ad.creative ? (
          <Photo src={ad.creative} alt="" className="sp-banner__creative" sizes="(min-width: 1280px) 70vw, 100vw" w={1600} />
        ) : (
          <>
            <span className="sp-banner__lead">
              {ad.name && <span className="sp-banner__brand">{ad.name}</span>}
              {title && <strong className="sp-banner__title">{title}</strong>}
            </span>
            <span className="sp-banner__body">
              {ad.text && <span className="sp-banner__text">{ad.text}</span>}
              {product?.price > 0 && (
                <span className="sp-banner__price">
                  <strong>{money(product.price)}</strong>
                  {product.onSale && <s>{money(product.compareAt)}</s>}
                </span>
              )}
              {ad.note && <small className="sp-banner__note">{ad.note}</small>}
            </span>
            {image && (
              <span className={`sp-banner__art ${fill ? "sp-banner__art--fill" : ""}`}>
                <SmartImage src={image} alt="" w={360} fit={fill ? "cover" : "contain"} />
              </span>
            )}
            {(url || preview) && <span className="sp-banner__cta">{ad.cta || (product ? t("ads.shopNow") : t("ads.learnMore"))}</span>}
          </>
        )}
      </AdLink>
    </div>
  );
}

/** The page's n-th sponsored banner, when there's one. */
export function SponsoredSlot({ index }) {
  const ads = useContext(AdsContext);
  const ad = ads?.banner[index];
  return ad ? <SponsoredBanner ad={ad} /> : null;
}
