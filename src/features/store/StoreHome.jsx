import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CaretLeft, CaretRight, Gift, ShieldCheck } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Notice, Photo, SmartImage } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useCatalog } from "@/context/CatalogContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";
import { categoryLabel, isNew, offerIsLive, SECTIONS, sortProducts } from "@/lib/products";
import { useSeo } from "@/lib/seo";
import { CategoryBubbles } from "./components/Departments";
import ProductCard from "./components/ProductCard";
import { FlashDeals, OfferStrip, PriceTiles, PromoBanner } from "./components/Promos";
import { ProductGridSection, ProductRail } from "./components/Rails";
import { bannerCategories, brandSpotlight, catalogLink, flashDeals, priceTiles, topDeals, useMerch } from "./merch";

const SLIDES = [
  { key: "delivery", img: "banner-delivery", to: "/tienda/productos?rapido=1" },
  { key: "sale", img: "banner-sale", to: "/tienda/productos?ofertas=1" },
  { key: "welcome", img: "banner-welcome", to: "/tienda/productos" },
];

function HeroSlider() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const go = useCallback((i) => setIndex((i + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="hero-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
      aria-roledescription="carousel"
    >
      <div className="hero-slider__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <Link key={s.key} to={s.to} className="hero-slider__slide" aria-hidden={i !== index} tabIndex={i === index ? 0 : -1}>
            <img
              src={`/img/${s.img}-1536.webp`}
              srcSet={`/img/${s.img}-768.webp 768w, /img/${s.img}-1536.webp 1536w`}
              sizes="(max-width: 900px) 100vw, 66vw"
              alt=""
              width="1536"
              height="1024"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </Link>
        ))}
      </div>
      <button className="hero-slider__nav hero-slider__nav--prev" onClick={() => go(index - 1)} aria-label="←">
        <CaretLeft size={20} weight="bold" />
      </button>
      <button className="hero-slider__nav hero-slider__nav--next" onClick={() => go(index + 1)} aria-label="→">
        <CaretRight size={20} weight="bold" />
      </button>
      <div className="hero-slider__dots">
        {SLIDES.map((s, i) => (
          <button key={s.key} className={i === index ? "is-active" : ""} onClick={() => go(i)} aria-label={`${i + 1} / ${SLIDES.length}`} aria-current={i === index} />
        ))}
      </div>
      <span className="sr-only">{t("store.title")}</span>
    </div>
  );
}

function SidePromos({ bestDeal }) {
  const { t } = useI18n();
  return (
    <div className="side-promos">
      {bestDeal && (
        <Link to="/tienda/productos?ofertas=1&orden=discount" className="side-promo side-promo--deal">
          <div className="side-promo__copy">
            <span className="side-promo__kicker">{t("store.deals")}</span>
            <strong className="side-promo__big">
              {t("store.upTo")} −{bestDeal.discountPct}%
            </strong>
            <span className="side-promo__cta">
              {t("store.bannerDeals")} <ArrowRight size={14} weight="bold" />
            </span>
          </div>
          <div className="side-promo__img">
            <SmartImage src={bestDeal.image} alt="" w={260} />
          </div>
        </Link>
      )}
      <Link to="/viajes" className="side-promo side-promo--travel">
        <Photo src={PHOTOS.niagaraBoat.src} className="side-promo__poster" sizes="(max-width: 900px) 50vw, 300px" w={600} />
        <div className="side-promo__copy side-promo__copy--over">
          <span className="side-promo__kicker">{t("home.travelTitle")}</span>
          <strong className="side-promo__title">{t("store.travelPromo", { city: CITY.name })}</strong>
          <span className="side-promo__cta">
            {t("home.travelCta")} <ArrowRight size={14} weight="bold" />
          </span>
        </div>
      </Link>
    </div>
  );
}

export default function StoreHome() {
  const { t, tx, lang } = useI18n();
  const settings = useSettings();
  const { products, status, brands, retry } = useCatalog();
  const { categories } = useMerch();
  const loading = status === "loading";

  useSeo({ title: t("store.metaTitle"), description: t("store.metaDescription", { city: CITY.name }) });

  const bySection = useMemo(() => {
    const map = {};
    for (const s of SECTIONS) {
      map[s.key] = sortProducts(
        products.filter((p) => p.sections?.[s.key]),
        "featured",
      ).slice(0, s.max);
    }
    return map;
  }, [products]);

  const newest = useMemo(() => {
    const recent = products.filter((p) => isNew(p, 45));
    return sortProducts(recent.length >= 4 ? recent : products, "newest").slice(0, 12);
  }, [products]);

  // Promotions, all computed from the live catalog so they stay true as products change
  const promo = useMemo(() => {
    const flash = flashDeals(products);
    const shownIds = new Set(flash.map((p) => p.id));
    const cats = bannerCategories(categories);
    return {
      flash,
      flashEndsAt: flash.find((p) => offerIsLive(p))?.offerEndsAt || null,
      top: topDeals(products, shownIds),
      catBanners: cats.slice(0, 2),
      brand: brandSpotlight(products),
      prices: priceTiles(products),
      bestDeal: sortProducts(
        products.filter((p) => p.inStock && p.image && p.onSale),
        "discount",
      )[0],
    };
  }, [products, categories]);

  const sectionTitle = (key) => {
    const s = SECTIONS.find((x) => x.key === key);
    return `${tx(s)} ${s.emoji}`;
  };

  const categoryBanner = (c, tone) => {
    if (!c) return null;
    const name = categoryLabel(c.value, lang);
    return (
      <PromoBanner
        to={catalogLink.category(c.key, "&ofertas=1&orden=discount")}
        tone={tone}
        kicker={t("store.superDeals")}
        title={t("store.upToOff", { pct: c.maxDiscount })}
        subtitle={t("store.inCategory", { name })}
        note={`${t("store.pricesFrom", { amount: money(c.minPrice) })} · ${t("store.dealCount", { n: c.dealCount })}`}
        images={[c.bestDeal?.image, ...c.images]}
      />
    );
  };

  if (status === "error") {
    return (
      <div className="container section">
        <Notice tone="error">
          {t("store.loadError")}{" "}
          <button className="section-head__link" onClick={retry}>
            {t("common.retry")}
          </button>
        </Notice>
      </div>
    );
  }

  return (
    <div className="store-home">
      <div className="container container--wide">
        <div className="store-hero">
          <HeroSlider />
          <SidePromos bestDeal={promo.bestDeal} />
        </div>
        <OfferStrip flashEndsAt={promo.flashEndsAt} />
      </div>

      <div className="container container--wide store-home__sections">
        <CategoryBubbles />
        <FlashDeals products={promo.flash} endsAt={promo.flashEndsAt} loading={loading} />
        <ProductRail title={sectionTitle("dayOffer")} to="/tienda/productos?seccion=dayOffer" products={bySection.dayOffer} loading={loading} eagerCount={2} />
        {categoryBanner(promo.catBanners[0], "red")}
        <PriceTiles tiles={promo.prices} />
        <ProductRail title={sectionTitle("mostSearched")} to="/tienda/productos?seccion=mostSearched" products={bySection.mostSearched} loading={loading} />

        <div className="promo-duo">
          <Link to="/tienda/productos" className="promo-duo__banner">
            <img src="/img/banner-tax-1536.webp" srcSet="/img/banner-tax-768.webp 768w, /img/banner-tax-1536.webp 1536w" sizes="(max-width: 900px) 100vw, 50vw" alt={t("store.perkTax")} loading="lazy" width="1536" height="622" />
          </Link>
          <div className="promo-duo__card">
            <ShieldCheck size={30} weight="duotone" />
            <div>
              <strong>{t("product.securePurchase")}</strong>
              <p>{t("product.securePurchaseText")}</p>
            </div>
            <Gift size={30} weight="duotone" />
            <div>
              <strong>{t("store.perkPoints")}</strong>
              <p>{t("store.perkPointsText")}</p>
            </div>
          </div>
        </div>

        <ProductGridSection title={`${t("store.topDeals")} 🏷️`} text={t("store.topDealsText")} to="/tienda/productos?ofertas=1&orden=discount" products={promo.top} loading={loading} className="top-deals" />
        <ProductRail title={sectionTitle("recommended")} to="/tienda/productos?seccion=recommended" products={bySection.recommended} loading={loading} />
        {categoryBanner(promo.catBanners[1], "blue")}
        <ProductRail title={`${t("store.newTitle")} ✨`} text={t("store.newText")} to="/tienda/productos?orden=newest" products={newest} loading={loading} />
      </div>

      {(loading || bySection.events.length > 0) && (
        <section className="band band--purple">
          <div className="container container--wide band__split">
            <div className="band__intro">
              <span className="band__kicker">
                <Gift size={18} weight="fill" /> {t("store.specialEvent")}
              </span>
              <h2 className="band__title">{tx(settings.store.eventTitle)}</h2>
              <p>{tx(settings.store.eventSubtitle)}</p>
              <Button to="/tienda/productos?seccion=events" variant="light" iconRight={ArrowRight}>
                {t("store.eventsCta")}
              </Button>
            </div>
            <div className="scroller product-rail band__rail">
              {bySection.events.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container container--wide store-home__sections">
        <ProductRail title={sectionTitle("EveryoneLikes")} to="/tienda/productos?seccion=EveryoneLikes" products={bySection.EveryoneLikes} loading={loading} />
        {promo.brand && (
          <PromoBanner
            to={`/tienda/productos?marca=${encodeURIComponent(promo.brand.brand)}`}
            tone="dark"
            kicker={t("store.featuredBrand")}
            title={promo.brand.brand}
            subtitle={t("store.upToOff", { pct: promo.brand.maxDiscount })}
            note={t("catalog.results", { n: promo.brand.count })}
            images={promo.brand.images}
            sticker={`−${promo.brand.maxDiscount}%`}
          />
        )}
        <ProductRail title={sectionTitle("mostBought")} to="/tienda/productos?seccion=mostBought" products={bySection.mostBought} loading={loading} />

        {brands.length > 0 && (
          <section>
            <div className="section-head">
              <h2 className="section-head__title">{t("store.brandsTitle")}</h2>
            </div>
            <div className="brand-strip">
              {brands.slice(0, 18).map((b) => (
                <Link key={b.name} to={`/tienda/productos?marca=${encodeURIComponent(b.name)}`} className="brand-pill">
                  {b.name}
                  <small>{b.count}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="store-cta">
          <div>
            <h2>{t("store.allProducts")}</h2>
            <p className="muted">{t("catalog.results", { n: products.length })}</p>
          </div>
          <Button to="/tienda/productos" size="lg" iconRight={ArrowRight}>
            {t("store.exploreAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
