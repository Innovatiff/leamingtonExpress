import { Link } from "react-router-dom";
import { AirplaneTilt, ArrowRight, Car, ChatsCircle, Lightning, MapPin, Money, Receipt, Storefront } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Pin } from "@/components/brand/Logo";
import Button from "@/components/ui/Button";
import { CITY, OTHER_CITIES } from "@/config/site";
import { useCatalog } from "@/context/CatalogContext";
import { useSettings } from "@/context/SettingsContext";
import ProductCard, { ProductCardSkeleton } from "@/features/store/components/ProductCard";
import FeaturedTrips from "@/features/travel/components/FeaturedTrips";
import PosterArt from "@/features/travel/components/PosterArt";
import RouteArt from "@/features/ride/RouteArt";
import { useI18n } from "@/i18n";
import { sortProducts } from "@/lib/products";
import { useSeo } from "@/lib/seo";
import "./home.css";

function ServiceCard({ kind, icon: Icon, title, text, cta, to, media }) {
  return (
    <Link to={to} className={`svc svc--${kind}`}>
      <div className="svc__media">{media}</div>
      <div className="svc__body">
        <span className="svc__tag">
          <Icon size={18} weight="fill" />
        </span>
        <h2 className="svc__title">{title}</h2>
        <p className="svc__text">{text}</p>
        <span className="svc__cta">
          {cta} <ArrowRight size={18} weight="bold" />
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { t, tx } = useI18n();
  const settings = useSettings();
  const { products, status } = useCatalog();

  useSeo({ title: null, description: t("home.subtitle") });

  const deals = useMemo(() => {
    const flagged = products.filter((p) => p.inStock && (p.sections.dayOffer || p.sections.bestOffers || p.sections.fastOffer));
    const pool = flagged.length >= 6 ? flagged : products.filter((p) => p.inStock);
    return sortProducts(pool, "discount").slice(0, 12);
  }, [products]);

  const destinations = CITY.rideDestinations.filter((d) => d.group !== "local").slice(0, 6);
  const enabled = (k) => settings[k]?.enabled !== false;

  return (
    <div className="hm">
      <section className="hm-hero">
        <div className="hm-hero__bg" aria-hidden="true" />
        <div className="container container--wide">
          <div className="hm-hero__copy fade-up">
            <span className="hm-kicker">
              <Pin size={18} />
              {t("home.kicker", { brand: CITY.brand })}
            </span>
            <h1 className="hm-title">
              {t("home.title", { city: CITY.name })}
              <span className="hm-title__accent">{t("home.titleAccent")}</span>
            </h1>
            <p className="hm-sub">{t("home.subtitle")}</p>
          </div>

          <div className="hm-services">
            {enabled("store") && (
              <ServiceCard
                kind="store"
                icon={Storefront}
                to="/tienda"
                title={t("home.storeTitle")}
                text={t("home.storeText")}
                cta={t("home.storeCta")}
                media={<img src="/img/dept-electronics.webp" alt="" loading="eager" />}
              />
            )}
            {enabled("ride") && (
              <ServiceCard
                kind="ride"
                icon={Car}
                to="/ride"
                title={t("home.rideTitle")}
                text={t("home.rideText")}
                cta={t("home.rideCta")}
                media={<RouteArt />}
              />
            )}
            {enabled("travel") && (
              <ServiceCard
                kind="travel"
                icon={AirplaneTilt}
                to="/viajes"
                title={t("home.travelTitle")}
                text={t("home.travelText")}
                cta={t("home.travelCta")}
                media={<PosterArt scene="falls" palette="sunset" />}
              />
            )}
          </div>

          <ul className="hm-perks">
            <li>
              <Lightning size={22} weight="fill" /> {t("home.perkDelivery")}
            </li>
            <li>
              <Receipt size={22} weight="fill" /> {t("home.perkTax")}
            </li>
            <li>
              <Money size={22} weight="fill" /> {settings.store.payments?.card ? t("home.perkPayCard") : t("home.perkPay")}
            </li>
            <li>
              <ChatsCircle size={22} weight="fill" /> {t("home.perkSpanish")}
            </li>
          </ul>
        </div>
      </section>

      {enabled("store") && (
        <section className="section hm-deals">
          <div className="container container--wide">
            <div className="section-head">
              <div>
                <h2 className="section-head__title">🔥 {t("home.dealsTitle")}</h2>
                <p className="section-head__text">{t("home.dealsText")}</p>
              </div>
              <Link to="/tienda/productos?ofertas=1" className="section-head__link">
                {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
              </Link>
            </div>
            <div className="scroller product-rail">
              {status === "loading"
                ? Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)
                : deals.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 4} />)}
            </div>
          </div>
        </section>
      )}

      {enabled("travel") && (
        <section className="section hm-trips">
          <div className="container container--wide">
            <div className="section-head">
              <div>
                <h2 className="section-head__title">{t("home.tripsTitle")}</h2>
                <p className="section-head__text">{t("home.tripsText", { city: CITY.name })}</p>
              </div>
              <Link to="/viajes" className="section-head__link">
                {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
              </Link>
            </div>
            <FeaturedTrips limit={4} />
          </div>
        </section>
      )}

      {enabled("ride") && (
        <section className="section section--tight">
          <div className="container container--wide">
            <div className="hm-rideband">
              <div className="hm-rideband__art" aria-hidden="true">
                <RouteArt />
              </div>
              <div className="hm-rideband__copy">
                <span className="eyebrow">
                  <Car size={16} weight="fill" /> Express Ride
                </span>
                <h2 className="hm-rideband__title">{t("home.rideBandTitle")}</h2>
                <p className="muted">{t("home.rideBandText")}</p>
                <div className="hm-rideband__chips">
                  {destinations.map((d) => (
                    <Link key={d.id} to={`/ride?destino=${d.id}`} className="chip chip--sm hm-chip">
                      <MapPin size={15} weight="fill" /> {tx(d.label)}
                    </Link>
                  ))}
                </div>
                <Button to="/ride" size="lg" iconRight={ArrowRight}>
                  {t("home.rideCta")}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section hm-heroes">
        <div className="container container--wide">
          <div className="hm-heroes__grid">
            <img
              className="hm-heroes__img"
              src="/img/banner-heroes-1536.webp"
              srcSet="/img/banner-heroes-768.webp 768w, /img/banner-heroes-1536.webp 1536w"
              sizes="(max-width: 900px) 100vw, 60vw"
              alt={t("home.heroesTitle")}
              loading="lazy"
              width="1536"
              height="1024"
            />
            <div className="hm-heroes__copy">
              <h2 className="hm-heroes__title">{t("home.heroesTitle")}</h2>
              <p className="muted">{t("home.heroesText")}</p>
              <div className="row row--wrap">
                <Button to="/tienda" variant="light" icon={Storefront}>
                  {t("nav.store")}
                </Button>
                <Button to="/viajes" variant="outline-light" icon={AirplaneTilt}>
                  {t("nav.travel")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section hm-cities">
        <div className="container">
          <h2 className="hm-cities__title">{t("home.citiesTitle", { brand: CITY.brand })}</h2>
          <p className="muted">{t("home.citiesText")}</p>
          <div className="hm-cities__list">
            <span className="hm-city hm-city--active">
              <Pin size={20} /> {CITY.brand}
            </span>
            {OTHER_CITIES.map((c) => (
              <span key={c.id} className="hm-city">
                <Pin size={20} /> {c.brand} {!c.active && <em>{t("common.comingSoon")}</em>}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
