import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CaretLeft, CaretRight, Coins, Copy, Lightning, Money, Receipt, Truck } from "@phosphor-icons/react";
import { Countdown, SmartImage } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { productPath } from "@/lib/products";
import { catalogLink } from "../merch";

export const FLASH_ID = "ofertas-relampago";

/** Coupons the owner advertises (Admin → Settings), cleaned up. */
export function usePublicCoupons() {
  const { store } = useSettings();
  return (store.promos?.coupons || [])
    .map((c) => ({ code: String(c?.code || "").trim().toUpperCase(), amount: Number(c?.amount) || 0, minSubtotal: Number(c?.minSubtotal) || 0 }))
    .filter((c) => c.code && c.amount > 0);
}

/** SHEIN-style strip under the hero: coupon tickets, free delivery, the flash-deal timer and the store perks. */
export function OfferStrip({ flashEndsAt }) {
  const { t } = useI18n();
  const { store } = useSettings();
  const toast = useToast();
  const coupons = usePublicCoupons();
  const freeOver = Number(store.freeDeliveryOver) || 0;

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
    toast.success(t("store.couponCopied", { code }), { action: { label: t("product.viewCart"), to: "/tienda/carrito" } });
  }

  const perks = [
    { icon: Lightning, title: t("store.perkDelivery"), text: t("store.perkDeliveryText", { city: CITY.name }) },
    { icon: Receipt, title: t("store.perkTax"), text: t("store.perkTaxText") },
    { icon: Money, title: t("store.perkPay"), text: store.payments?.card ? t("store.perkPayText") : t("store.perkPayTextNoCard") },
    { icon: Coins, title: t("store.perkPoints"), text: t("store.perkPointsText") },
  ];

  return (
    <ul className="offer-strip" aria-label={t("store.offersLabel")}>
      {coupons.map((c, i) => (
        <li key={`${c.code}-${i}`} className="ticket ticket--coupon">
          <span className="ticket__value">
            <small>{t("store.couponKicker")}</small>−{money(c.amount, { whole: true })}
          </span>
          <span className="ticket__body">
            <span className="ticket__title">{c.minSubtotal > 0 ? t("store.couponMin", { amount: money(c.minSubtotal, { whole: true }) }) : t("store.couponAny")}</span>
            <button type="button" className="ticket__code" onClick={() => copy(c.code)} aria-label={t("store.couponCopyLabel", { code: c.code })}>
              <span>{c.code}</span>
              <Copy size={14} weight="bold" aria-hidden="true" />
            </button>
          </span>
        </li>
      ))}
      {freeOver > 0 && (
        <li className="ticket ticket--free">
          <span className="ticket__value">
            <Truck size={26} weight="fill" aria-hidden="true" />
          </span>
          <span className="ticket__body">
            <span className="ticket__title">{t("store.freeDelivery")}</span>
            <span className="ticket__text">{t("store.freeDeliveryOver", { amount: money(freeOver, { whole: true }) })}</span>
          </span>
        </li>
      )}
      {flashEndsAt && (
        <li className="ticket ticket--flash">
          <Link to={`#${FLASH_ID}`} className="ticket__link">
            <span className="ticket__value">
              <Lightning size={26} weight="fill" aria-hidden="true" />
            </span>
            <span className="ticket__body">
              <span className="ticket__title">{t("store.flashTitle")}</span>
              <Countdown to={flashEndsAt} prefix={`${t("store.endsIn")} `} className="ticket__text" />
            </span>
          </Link>
        </li>
      )}
      {perks.map(({ icon: Icon, title, text }) => (
        <li key={title} className="ticket ticket--perk">
          <span className="ticket__icon">
            <Icon size={22} weight="fill" aria-hidden="true" />
          </span>
          <span className="ticket__body">
            <span className="ticket__title">{title}</span>
            <span className="ticket__text">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Compact deal card: photo, big red discount, price and the old price struck through. */
export function DealTile({ product: p, eager }) {
  const { t } = useI18n();
  const low = p.stock != null && p.stock > 0 && p.stock <= 5;
  return (
    <Link to={productPath(p)} className="deal-tile">
      <span className="deal-tile__img">
        <SmartImage src={p.image} alt="" w={320} eager={eager} />
        {p.discountPct >= 1 && <span className="deal-tile__pct">−{p.discountPct}%</span>}
      </span>
      <span className="deal-tile__body">
        <span className="deal-tile__name">{p.name}</span>
        <span className="deal-tile__price">
          <strong>{money(p.price)}</strong>
          {p.onSale && <s>{money(p.compareAt)}</s>}
        </span>
        {low ? <span className="deal-tile__low">{t("product.lowStock", { n: p.stock })}</span> : p.savings > 0 && <span className="deal-tile__save">{t("product.save", { amount: money(p.savings, { whole: true }) })}</span>}
      </span>
    </Link>
  );
}

function DealTileSkeleton() {
  return (
    <div className="deal-tile deal-tile--skeleton" aria-hidden="true">
      <span className="deal-tile__img skeleton" />
      <span className="deal-tile__body">
        <span className="skeleton" style={{ height: 12, width: "80%" }} />
        <span className="skeleton" style={{ height: 18, width: "55%" }} />
      </span>
    </div>
  );
}

/** "Flash deals" with a live countdown to the next offer that ends. */
export function FlashDeals({ products, endsAt, loading }) {
  const { t } = useI18n();
  const ref = useRef(null);
  if (!loading && !products.length) return null;
  const maxDiscount = Math.max(0, ...products.map((p) => p.discountPct));
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="flash" id={FLASH_ID} aria-labelledby={`${FLASH_ID}-title`}>
      <div className="flash__head">
        <h2 className="flash__title" id={`${FLASH_ID}-title`}>
          <span className="flash__bolt" aria-hidden="true">
            <Lightning size={18} weight="fill" />
          </span>
          {t("store.flashTitle")}
        </h2>
        {endsAt ? (
          <Countdown to={endsAt} prefix={<span className="flash__ends">{t("store.endsIn")}</span>} className="flash__timer" />
        ) : (
          maxDiscount >= 5 && <span className="flash__upto">{t("store.upToOff", { pct: maxDiscount })}</span>
        )}
        <div className="flash__actions">
          <Link to="/tienda/productos?ofertas=1&orden=discount" className="section-head__link">
            {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
          </Link>
          <button className="rail__arrow" onClick={() => scroll(-1)} aria-label="←">
            <CaretLeft size={18} weight="bold" />
          </button>
          <button className="rail__arrow" onClick={() => scroll(1)} aria-label="→">
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
      <div className="scroller flash__rail" ref={ref}>
        {loading ? Array.from({ length: 6 }, (_, i) => <DealTileSkeleton key={i} />) : products.map((p, i) => <DealTile key={p.id} product={p} eager={i < 3} />)}
      </div>
    </section>
  );
}

/**
 * Bold full-width promo banner made from catalog data: a big headline
 * ("Up to −34%"), what it's about, and up to three product photos.
 */
export function PromoBanner({ to, tone = "red", kicker, title, subtitle, note, images = [], sticker }) {
  const { t } = useI18n();
  const photos = [...new Set(images.filter(Boolean))].slice(0, 3);
  const longestWord = Math.max(4, ...String(title).split(/\s+/).map((w) => w.length));
  return (
    <Link to={to} className={`promo-banner promo-banner--${tone}`}>
      <span className="promo-banner__copy">
        {kicker && <span className="promo-banner__kicker">{kicker}</span>}
        <strong className="promo-banner__title" style={{ "--fit": longestWord }}>
          {title}
        </strong>
        {subtitle && <span className="promo-banner__subtitle">{subtitle}</span>}
        {note && <span className="promo-banner__note">{note}</span>}
        <span className="promo-banner__cta">
          {t("store.bannerShop")} <ArrowRight size={16} weight="bold" />
        </span>
      </span>
      <span className={`promo-banner__art promo-banner__art--${photos.length}`} aria-hidden="true">
        {photos.map((src, i) => (
          <span key={src} className={`promo-banner__ph promo-banner__ph--${i}`}>
            <SmartImage src={src} alt="" w={i === 0 ? 420 : 260} />
          </span>
        ))}
        {sticker && <span className="promo-banner__sticker">{sticker}</span>}
      </span>
    </Link>
  );
}

/** "Under $25 / $50 / $100 / $200" tiles with a product photo from each price band. */
export function PriceTiles({ tiles }) {
  const { t } = useI18n();
  if (tiles.length < 2) return null;
  return (
    <section>
      <div className="section-head">
        <div>
          <h2 className="section-head__title">{t("store.priceTitle")}</h2>
          <p className="section-head__text">{t("store.priceText")}</p>
        </div>
      </div>
      <div className="price-tiles">
        {tiles.map((tile, i) => (
          <Link key={tile.max} to={catalogLink.maxPrice(tile.max)} className={`price-tile price-tile--${i % 4}`}>
            <span className="price-tile__copy">
              <span className="price-tile__under">{t("store.under")}</span>
              <strong className="price-tile__amount">{money(tile.max, { whole: true })}</strong>
              <span className="price-tile__count">{t("catalog.results", { n: tile.count })}</span>
            </span>
            <span className="price-tile__img">{tile.image && <SmartImage src={tile.image} alt="" w={260} />}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
