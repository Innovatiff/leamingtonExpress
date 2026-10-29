// Extra pieces for the store home: the announcement ticker, the quick-picks panel,
// featured departments, the brands marquee, the ride/travel promos and two popups
// (a welcome offer and a flash deal). Everything shown comes from the live catalog
// and the store settings, so it stays true as products and offers change.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AirplaneTilt, ArrowRight, Car, Coins, Copy, Gift, Lightning, Money, Receipt, Tag, Ticket, Truck, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Marquee from "@/components/ui/Marquee";
import { Countdown, Photo, SmartImage } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Overlay";
import { CITY, SITE_NAME } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";
import { categoryLabel, offerIsLive, productPath } from "@/lib/products";
import { readJSON, writeJSON } from "@/lib/storage";
import { catalogLink } from "../merch";
import { usePublicCoupons } from "./Promos";

/* ------------------------------ Ticker ------------------------------ */

function TickerItem({ icon: Icon, text, to }) {
  const body = (
    <>
      <span className="ticker-item__icon">
        <Icon size={15} weight="fill" aria-hidden="true" />
      </span>
      {text}
    </>
  );
  return to ? (
    <Link to={to} className="ticker-item">
      {body}
    </Link>
  ) : (
    <span className="ticker-item">{body}</span>
  );
}

/** A scrolling band of the store's real promises and offers. */
export function StoreTicker({ bestDeal }) {
  const { t } = useI18n();
  const { store } = useSettings();
  const coupons = usePublicCoupons();
  const freeOver = Number(store.freeDeliveryOver) || 0;
  const items = [
    { icon: Lightning, text: t("store.tickDelivery", { city: CITY.name }), to: "/tienda/productos?rapido=1" },
    bestDeal?.discountPct >= 5 && { icon: Tag, text: t("store.tickDeals", { pct: bestDeal.discountPct }), to: "/tienda/productos?ofertas=1&orden=discount" },
    ...coupons.slice(0, 2).map((c) => ({ icon: Ticket, text: t("store.tickCoupon", { code: c.code, amount: money(c.amount, { whole: true }) }) })),
    freeOver > 0 && { icon: Truck, text: t("store.tickFree", { amount: money(freeOver, { whole: true }) }) },
    store.payments?.cash && { icon: Money, text: t("store.tickCash") },
    { icon: Receipt, text: t("store.tickTax") },
    { icon: Coins, text: t("store.tickPoints") },
    { icon: AirplaneTilt, text: t("store.tickTravel", { city: CITY.name }), to: "/viajes" },
  ].filter(Boolean);
  return (
    <div className="store-ticker">
      <Marquee label={t("store.tickerLabel")} speed={55}>
        {items.map((item) => (
          <TickerItem key={item.text} {...item} />
        ))}
      </Marquee>
    </div>
  );
}

/* --------------------------- Quick picks ---------------------------- */

/** A third column for the hero on wide screens: four popular categories with a photo. */
export function QuickPicks({ categories }) {
  const { t, lang } = useI18n();
  const picks = categories.filter((c) => c.count > 0 && c.images?.length).slice(0, 4);
  if (picks.length < 4) return null;
  return (
    <div className="quick-picks">
      <div className="quick-picks__head">
        <strong>{t("store.quickTitle")}</strong>
        <span>
          <Lightning size={14} weight="fill" /> {t("store.quickText", { city: CITY.name })}
        </span>
      </div>
      <div className="quick-picks__grid">
        {picks.map((c) => (
          <Link key={c.key} to={catalogLink.category(c.key)} className="quick-pick">
            <span className="quick-pick__img">
              <SmartImage src={c.images[0]} alt="" w={240} />
            </span>
            <span className="quick-pick__name">{categoryLabel(c.value, lang)}</span>
            {c.minPrice > 0 && <span className="quick-pick__from">{t("store.pricesFrom", { amount: money(c.minPrice) })}</span>}
          </Link>
        ))}
      </div>
      <Link to="/tienda/productos" className="quick-picks__all">
        {t("store.exploreAll")} <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}

/* ------------------------ Featured departments ----------------------- */

/** Big colourful tiles for the six largest categories, with their best discount. */
export function CategoryMosaic({ categories }) {
  const { t, lang } = useI18n();
  const tiles = categories.filter((c) => c.count > 0 && c.images?.length).slice(0, 6);
  if (tiles.length < 3) return null;
  return (
    <section>
      <div className="section-head">
        <div>
          <h2 className="section-head__title">{t("store.mosaicTitle")}</h2>
          <p className="section-head__text">{t("store.mosaicText")}</p>
        </div>
      </div>
      <div className={`cat-mosaic cat-mosaic--${tiles.length}`}>
        {tiles.map((c, i) => (
          <Link key={c.key} to={catalogLink.category(c.key)} className={`cat-tile cat-tile--${i % 6}`}>
            <span className="cat-tile__copy">
              <strong className="cat-tile__name">{categoryLabel(c.value, lang)}</strong>
              <span className="cat-tile__count">{t("catalog.results", { n: c.count })}</span>
              {c.maxDiscount >= 5 ? (
                <span className="cat-tile__deal">{t("store.upToOff", { pct: c.maxDiscount })}</span>
              ) : (
                c.minPrice > 0 && <span className="cat-tile__deal cat-tile__deal--soft">{t("store.pricesFrom", { amount: money(c.minPrice) })}</span>
              )}
              <span className="cat-tile__cta">
                {t("store.bannerShop")} <ArrowRight size={14} weight="bold" />
              </span>
            </span>
            <span className="cat-tile__art" aria-hidden="true">
              {c.images.slice(0, 2).map((src, j) => (
                <span key={src} className={`cat-tile__ph cat-tile__ph--${j}`}>
                  <SmartImage src={src} alt="" w={j ? 220 : 360} />
                </span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- Brands -------------------------------- */

function BrandChip({ brand }) {
  return (
    <Link to={`/tienda/productos?marca=${encodeURIComponent(brand.name)}`} className="brand-chip">
      {brand.name}
      <small>{brand.count}</small>
    </Link>
  );
}

/** Brand names gliding by, in two rows that go opposite ways when there are many. */
export function BrandMarquee({ brands }) {
  const { t } = useI18n();
  const list = brands.slice(0, 28);
  if (list.length < 3) return null;
  const rows = list.length >= 10 ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : [list];
  return (
    <section className="brand-marquee">
      <div className="section-head">
        <h2 className="section-head__title">{t("store.brandsTitle")}</h2>
      </div>
      {rows.map((row, i) => (
        <Marquee key={i} label={t("store.brandsTitle")} speed={38} reverse={i === 1}>
          {row.map((b) => (
            <BrandChip key={b.name} brand={b} />
          ))}
        </Marquee>
      ))}
    </section>
  );
}

/* ------------------------- Ride and travel -------------------------- */

/** The other two services, side by side with big photos. */
export function CrossPromo() {
  const { t } = useI18n();
  return (
    <section>
      <div className="section-head">
        <h2 className="section-head__title">{t("store.crossTitle")}</h2>
      </div>
      <div className="cross-promo">
        <Link to="/ride" className="cross-card cross-card--ride">
          <Photo src={PHOTOS.driver.src} className="cross-card__photo" sizes="(max-width: 900px) 100vw, 50vw" w={1200} />
          <span className="cross-card__copy">
            <span className="cross-card__icon">
              <Car size={22} weight="fill" />
            </span>
            <strong>{t("store.crossRide")}</strong>
            <span>{t("store.crossRideText")}</span>
            <span className="cross-card__cta">
              {t("store.crossRideCta")} <ArrowRight size={16} weight="bold" />
            </span>
          </span>
        </Link>
        <Link to="/viajes" className="cross-card cross-card--travel">
          <Photo src={PHOTOS.niagara.src} className="cross-card__photo" sizes="(max-width: 900px) 100vw, 50vw" w={1200} />
          <span className="cross-card__copy">
            <span className="cross-card__icon">
              <AirplaneTilt size={22} weight="fill" />
            </span>
            <strong>{t("store.crossTravel")}</strong>
            <span>{t("store.crossTravelText", { city: CITY.name })}</span>
            <span className="cross-card__cta">
              {t("store.crossTravelCta")} <ArrowRight size={16} weight="bold" />
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}

/* ----------------------------- Popups ------------------------------- */

const WELCOME_KEY = "lx_welcome_seen";
const WELCOME_EVERY = 14 * 24 * 60 * 60 * 1000; // shown again after two weeks
const DEAL_KEY = "lx_deal_popup";

/** A welcome offer a few seconds after a first visit (again after two weeks). */
export function WelcomePopup() {
  const { t } = useI18n();
  const { store } = useSettings();
  const toast = useToast();
  const coupons = usePublicCoupons();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = Number(readJSON(WELCOME_KEY, 0)) || 0;
    if (Date.now() - seen < WELCOME_EVERY) return undefined;
    const id = setTimeout(() => setOpen(true), 7000);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    writeJSON(WELCOME_KEY, Date.now());
    setOpen(false);
  };

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard blocked — the code is on screen */
    }
    toast.success(t("store.couponCopied", { code }));
  }

  const coupon = coupons[0];
  const perks = [
    [Lightning, t("store.perkDelivery")],
    [Receipt, t("store.perkTax")],
    [Money, store.payments?.cash ? t("store.tickCash") : t("store.perkPay")],
    [Gift, t("store.perkPoints")],
  ];
  return (
    <Modal open={open} onClose={close} className="welcome-pop" closeLabel={t("common.close")}>
      <button type="button" className="welcome-pop__close" onClick={close} aria-label={t("common.close")}>
        <X size={20} weight="bold" />
      </button>
      <div className="welcome-pop__hero">
        <span className="welcome-pop__badge">
          <Gift size={30} weight="fill" />
        </span>
        <h2 className="welcome-pop__title">{t("store.welcomeTitle", { brand: SITE_NAME })}</h2>
        <p>{t("store.welcomeText", { city: CITY.name })}</p>
      </div>
      {coupon && (
        <div className="welcome-pop__coupon">
          <span>{t("store.welcomeCoupon", { amount: money(coupon.amount, { whole: true }) })}</span>
          <button type="button" className="welcome-pop__code" onClick={() => copy(coupon.code)}>
            {coupon.code} <Copy size={16} weight="bold" />
          </button>
        </div>
      )}
      <ul className="welcome-pop__perks">
        {perks.map(([Icon, text]) => (
          <li key={text}>
            <Icon size={20} weight="duotone" /> {text}
          </li>
        ))}
      </ul>
      <div className="welcome-pop__actions">
        <Button to="/tienda/productos?ofertas=1&orden=discount" size="lg" iconRight={ArrowRight} onClick={close}>
          {t("store.welcomeCta")}
        </Button>
        <button type="button" className="welcome-pop__later" onClick={close}>
          {t("store.welcomeLater")}
        </button>
      </div>
    </Modal>
  );
}

/** A flash deal that slides in once a visit, after some scrolling. */
export function DealPopup({ product: p }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!p) return undefined;
    let done = false;
    try {
      done = sessionStorage.getItem(DEAL_KEY) === "1";
    } catch {
      /* storage blocked: show it */
    }
    if (done) return undefined;
    const onScroll = () => {
      if (window.scrollY > 1400) {
        setShow(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [p]);

  if (!p || !show) return null;
  const close = () => {
    try {
      sessionStorage.setItem(DEAL_KEY, "1");
    } catch {
      /* fine */
    }
    setShow(false);
  };
  return (
    <aside className="deal-pop" aria-label={t("store.flashTitle")}>
      <button type="button" className="deal-pop__close" onClick={close} aria-label={t("common.close")}>
        <X size={16} weight="bold" />
      </button>
      <Link to={productPath(p)} className="deal-pop__img" onClick={close}>
        <SmartImage src={p.image} alt="" w={200} />
        {p.discountPct >= 1 && <span className="deal-pop__pct">−{p.discountPct}%</span>}
      </Link>
      <div className="deal-pop__body">
        <span className="deal-pop__kicker">
          <Lightning size={14} weight="fill" /> {t("store.flashTitle")}
        </span>
        <Link to={productPath(p)} className="deal-pop__name" onClick={close}>
          {p.name}
        </Link>
        <span className="deal-pop__price">
          <strong>{money(p.price)}</strong>
          {p.onSale && <s>{money(p.compareAt)}</s>}
        </span>
        {offerIsLive(p) && <Countdown to={p.offerEndsAt} prefix={`${t("store.dealEndsSoon")} `} className="deal-pop__ends" />}
        <Link to={productPath(p)} className="deal-pop__cta" onClick={close}>
          {t("store.dealPopupCta")} <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
    </aside>
  );
}
