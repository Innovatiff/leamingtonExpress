import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AirplaneTilt,
  ArrowRight,
  Bank,
  Buildings,
  CalendarCheck,
  ChatsCircle,
  Globe,
  HandCoins,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Mountains,
  Plus,
  ShoppingBag,
  Snowflake,
  Sun,
  Translate,
  Users,
  UsersThree,
  Van,
  WhatsappLogo,
  Wine,
  X,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Marquee from "@/components/ui/Marquee";
import { AdLayout, LocalAds, SponsoredSlot } from "@/features/ads/Ads";
import { EmptyState, Photo } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money, phoneDigits } from "@/lib/format";
import { PHOTOS, photoSrcSet } from "@/lib/photos";
import { useSeo } from "@/lib/seo";
import TripCard, { TripCardSkeleton, TripMedia } from "./components/TripCard";
import { TRIP_CATEGORIES, TRIP_TYPES } from "./data/trips";
import { upcomingDepartures, useTrips } from "./lib/trips";

const CAT_ICONS = { Mountains, Buildings, Users, Wine, ShoppingBag, Sun, Bank, Snowflake, Globe };
const TYPES = ["day", "weekend", "multi"];
const BUDGETS = [150, 250, 500, 1000];
const SORTS = [
  ["", "sortRecommended"],
  ["price-asc", "sortPriceAsc"],
  ["price-desc", "sortPriceDesc"],
  ["soonest", "sortSoonest"],
];
const HERO_IDS = ["niagara-falls-dia", "tobermory-bruce", "quebec-montreal"];
// Photos behind the hero (other trips than the postcards)
const BACKDROP_IDS = ["muskoka-colores-otono", "niagara-fallsview-fin-de-semana", "toronto-fin-de-semana", "chicago"];
const BACKDROP_WIDTHS = [800, 1200, 1600, 2000, 2400];
const FILTER_KEYS = ["tipo", "mes", "max", "estilo", "ofertas"];

const yearMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The next 12 months as select options ("2026-11" → "Noviembre 2026"). */
function monthOptions(lang) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-CA" : "es-MX", { month: "long", year: "numeric" });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = fmt.format(d);
    return { value: yearMonth(d), label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

function heroTrips(trips) {
  const preferred = HERO_IDS.map((id) => trips.find((t) => t.id === id)).filter(Boolean);
  if (preferred.length === 3) return preferred;
  return [...trips.filter((t) => t.featured), ...trips].filter((t, i, all) => all.indexOf(t) === i).slice(0, 3);
}

function backdropTrips(trips, cards) {
  const withPhoto = trips.filter((t) => t.image);
  const preferred = BACKDROP_IDS.map((id) => withPhoto.find((t) => t.id === id)).filter(Boolean);
  if (preferred.length >= 2) return preferred;
  const shown = new Set(cards.map((t) => t.id));
  return [...withPhoto.filter((t) => !shown.has(t.id)), ...withPhoto].filter((t, i, all) => all.indexOf(t) === i).slice(0, 4);
}

/** Big photos behind the hero that fade into each other, with the trip each one is from. */
function HeroBackdrop({ trips }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  // photos are added one at a time, so only the next one downloads while one shows
  const [mounted, setMounted] = useState(2);
  const count = trips.length;

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % count;
        setMounted((m) => Math.max(m, next + 2));
        return next;
      });
    }, 7000);
    return () => clearInterval(id);
  }, [count]);

  if (!count) return null;
  const trip = trips[index] || trips[0];
  return (
    <>
      <div className="tv-hero__backdrop" aria-hidden="true">
        {trips.slice(0, mounted).map((tr, i) => (
          <Photo
            key={tr.id}
            src={tr.image}
            className={`tv-hero__photo ${i === index ? "is-active" : ""}`}
            sizes="100vw"
            w={1600}
            srcSet={photoSrcSet(tr.image, BACKDROP_WIDTHS)}
            eager={i === 0}
            fetchPriority={i === 0 ? "high" : undefined}
          />
        ))}
      </div>
      <Link to={`/viajes/${trip.id}`} className="tv-hero__now">
        <MapPin size={16} weight="fill" />
        <span>{trip.destination}</span>
        <strong>
          {t("travel.from")} {money(trip.fromPrice, { whole: true })}
        </strong>
        <ArrowRight size={14} weight="bold" />
      </Link>
    </>
  );
}

/** Destinations gliding by as photo cards. */
function DestinationMarquee({ trips }) {
  const { t, tx } = useI18n();
  const list = trips.filter((trip) => trip.image).slice(0, 18);
  if (list.length < 4) return null;
  return (
    <section className="tv-dests">
      <div className="container container--full tv-dests__head">
        <span className="eyebrow">{t("travel.destKicker")}</span>
        <h2 className="tv-h2">{t("travel.destTitle", { city: CITY.name })}</h2>
      </div>
      <Marquee label={t("travel.destTitle", { city: CITY.name })} speed={34}>
        {list.map((trip) => (
          <Link key={trip.id} to={`/viajes/${trip.id}`} className="tv-dest">
            <TripMedia trip={trip} sizes="300px" />
            <span className="tv-dest__copy">
              <strong>{trip.destination.split(",")[0]}</strong>
              <span>{tx(TRIP_TYPES[trip.type])}</span>
            </span>
            <span className="tv-dest__price">
              {t("travel.from")} <b>{money(trip.fromPrice, { whole: true })}</b>
            </span>
          </Link>
        ))}
      </Marquee>
    </section>
  );
}

/** Catalog filters live in the URL so every filtered view can be shared. */
function useTripFilters() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const filters = {
    tipo: TYPES.includes(params.get("tipo")) ? params.get("tipo") : "",
    mes: params.get("mes") || "",
    max: Number(params.get("max")) || 0,
    estilo: params.get("estilo") || "",
    ofertas: params.get("ofertas") === "1",
    orden: params.get("orden") || "",
  };
  const update = (changes, { toList = false } = {}) => {
    const next = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === "" || value === 0 || value === false || value == null) next.delete(key);
      else next.set(key, value === true ? "1" : String(value));
    }
    const search = next.toString();
    navigate({ search: search ? `?${search}` : "", hash: toList ? "#lista" : location.hash }, { replace: !toList });
  };
  return [filters, update];
}

export default function TravelHome() {
  const { t, tx, lang } = useI18n();
  const settings = useSettings();
  const location = useLocation();
  const { status, trips } = useTrips();
  const [f, setFilters] = useTripFilters();
  const travel = settings.travel || {};
  const group = travel.groupDiscount || {};
  const wa = settings.contact?.whatsapp;

  useSeo({ title: t("travel.metaTitle", { city: CITY.name }), description: t("travel.metaDescription", { city: CITY.name }) });

  // Links like /viajes?tipo=day#lista land on the results, also once the trips have loaded
  useEffect(() => {
    if (location.hash === "#lista" && status === "ready") {
      document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.key, location.hash, status]);

  const departures = useMemo(() => Object.fromEntries(trips.map((trip) => [trip.id, upcomingDepartures(trip, { count: 60 })])), [trips]);
  const months = useMemo(() => monthOptions(lang), [lang]);

  // Everything except the type filter (the type tabs show their own counts)
  const base = trips.filter(
    (trip) =>
      (!f.estilo || trip.categories.includes(f.estilo)) &&
      (!f.max || trip.fromPrice <= f.max) &&
      (!f.ofertas || trip.offerPct > 0) &&
      (!f.mes || (departures[trip.id] || []).some((d) => yearMonth(d) === f.mes)),
  );
  const firstDeparture = (trip) => departures[trip.id]?.[0]?.getTime() ?? Infinity;
  const results = base
    .filter((trip) => !f.tipo || trip.type === f.tipo)
    .sort((a, b) => {
      if (f.orden === "price-asc") return a.fromPrice - b.fromPrice;
      if (f.orden === "price-desc") return b.fromPrice - a.fromPrice;
      if (f.orden === "soonest") return firstDeparture(a) - firstDeparture(b);
      return 0;
    });

  const offers = trips.filter((trip) => trip.offerPct > 0).slice(0, 3);
  const destinations = new Set(trips.map((trip) => trip.destination)).size;
  const cards = heroTrips(trips);
  const backdrop = backdropTrips(trips, cards);
  // a different photo for each style when there are enough trips
  const covers = useMemo(() => {
    const used = new Set();
    const out = {};
    for (const c of TRIP_CATEGORIES) {
      const inStyle = trips.filter((trip) => trip.categories.includes(c.key) && trip.image);
      const pick = inStyle.find((trip) => !used.has(trip.id)) || inStyle[0];
      if (pick) {
        used.add(pick.id);
        out[c.key] = pick;
      }
    }
    return out;
  }, [trips]);
  const faq = t("travel.faq");

  const active = [
    f.mes && { key: "mes", label: months.find((m) => m.value === f.mes)?.label || f.mes },
    f.max && { key: "max", label: t("travel.under", { amount: money(f.max, { whole: true }) }) },
    f.estilo && { key: "estilo", label: tx(TRIP_CATEGORIES.find((c) => c.key === f.estilo)?.label) || f.estilo },
    f.ofertas && { key: "ofertas", label: t("travel.onlyOffers") },
  ].filter(Boolean);
  const clearAll = () => setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={`tv-hero ${backdrop.length ? "tv-hero--photo" : ""}`}>
        <HeroBackdrop trips={backdrop} />
        <div className="container container--full tv-hero__grid">
          <div className="tv-hero__copy">
            <span className="tv-kicker">
              <AirplaneTilt size={16} weight="fill" /> {t("travel.kicker")}
            </span>
            <h1 className="tv-hero__title">
              {t("travel.heroTitle")} <em>{t("travel.heroTitleAccent")}</em>
            </h1>
            <p className="tv-hero__text">{t("travel.heroText", { city: CITY.name })}</p>

            <form
              className="tv-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setFilters({}, { toList: true });
              }}
            >
              <label className="tv-search__field">
                <span>{t("travel.searchType")}</span>
                <select value={f.tipo} onChange={(e) => setFilters({ tipo: e.target.value })}>
                  <option value="">{t("travel.anyType")}</option>
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {tx(TRIP_TYPES[type])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tv-search__field">
                <span>{t("travel.searchMonth")}</span>
                <select value={f.mes} onChange={(e) => setFilters({ mes: e.target.value })}>
                  <option value="">{t("travel.anyMonth")}</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tv-search__field">
                <span>{t("travel.searchBudget")}</span>
                <select value={f.max || ""} onChange={(e) => setFilters({ max: Number(e.target.value) || 0 })}>
                  <option value="">{t("travel.anyBudget")}</option>
                  {BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {t("travel.under", { amount: money(b, { whole: true }) })}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="lg" icon={MagnifyingGlass} className="tv-search__btn">
                {t("travel.searchBtn")}
              </Button>
            </form>
          </div>

          <div className="tv-hero__art" aria-hidden="true">
            {cards.map((trip, i) => (
              <Link key={trip.id} to={`/viajes/${trip.id}`} className={`tv-postcard tv-postcard--${i + 1}`} tabIndex={-1}>
                <TripMedia trip={trip} sizes="(max-width: 720px) 46vw, 280px" eager={i === 0} />
                <span className="tv-postcard__caption">
                  <strong>{trip.destination.split(",")[0]}</strong>
                  <span>
                    {t("travel.from")} {money(trip.fromPrice, { whole: true })}
                  </span>
                </span>
              </Link>
            ))}
            <span className="tv-stamp">
              {t("travel.stampTop")}
              <strong>{CITY.name}</strong>
              <AirplaneTilt size={18} weight="fill" />
              {t("travel.stampBottom")}
            </span>
          </div>
        </div>
      </section>

      <div className="container container--full tv-hero__foot">
        <ul className="tv-stats">
          <li>
            <span className="tv-stats__icon">
              <MapTrifold size={22} weight="duotone" />
            </span>
            {t("travel.statDestinations", { n: destinations || 18 })}
          </li>
          <li>
            <span className="tv-stats__icon">
              <Van size={22} weight="duotone" />
            </span>
            {t("travel.statAllInclusive")}
          </li>
          <li>
            <span className="tv-stats__icon">
              <Translate size={22} weight="duotone" />
            </span>
            {t("travel.statGuide")}
          </li>
          {Number(travel.depositPct) > 0 && (
            <li>
              <span className="tv-stats__icon">
                <HandCoins size={22} weight="duotone" />
              </span>
              {t("travel.statDeposit")}
            </li>
          )}
        </ul>
      </div>

      <DestinationMarquee trips={trips} />

      {/* from here down: ad columns on each side on big screens */}
      <AdLayout page="travel">
        {/* ----------------------------- Offers ----------------------------- */}
        {(offers.length > 0 || group.pct > 0) && (
          <section className="section tv-offers">
            <div className="container container--full">
              <div className="section-head">
                <div>
                  <span className="eyebrow">{t("travel.offer")}</span>
                  <h2 className="tv-h2">{t("travel.offersTitle")}</h2>
                  <p className="section-head__text">{t("travel.offersText")}</p>
                </div>
                {offers.length > 0 && (
                  <Link to="/viajes?ofertas=1#lista" className="section-head__link">
                    {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
                  </Link>
                )}
              </div>
              <div className="tv-offers__grid">
                {status === "loading"
                  ? Array.from({ length: 3 }, (_, i) => <TripCardSkeleton key={i} />)
                  : offers.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                {group.pct > 0 && (
                  <div className="tv-promo">
                    <span className="tv-promo__icon">
                      <UsersThree size={30} weight="duotone" />
                    </span>
                    <h3 className="tv-promo__title">{t("travel.groupPromoTitle", { pct: group.pct })}</h3>
                    <p>{t("travel.groupText", { pct: group.pct, min: group.min })}</p>
                    {Number(travel.depositPct) > 0 && (
                      <p className="tv-promo__note">
                        <HandCoins size={18} weight="bold" /> {t("travel.depositText", { pct: travel.depositPct })}
                      </p>
                    )}
                    <Photo src={PHOTOS.van.src} className="tv-promo__photo" sizes="(max-width: 700px) 80vw, 420px" w={800} />
                    <Button to="/contacto?tema=viajes" iconRight={ArrowRight}>
                      {t("travel.groupPromoCta")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <SponsoredSlot index={0} />

        {/* --------------------------- By style ----------------------------- */}
        <section className="section section--tight tv-styles-section">
          <div className="container container--full">
            <h2 className="tv-h2">{t("travel.categoriesTitle")}</h2>
            <div className="tv-styles">
              {TRIP_CATEGORIES.map((c) => {
                const inStyle = trips.filter((trip) => trip.categories.includes(c.key));
                if (status === "ready" && !inStyle.length) return null;
                const Icon = CAT_ICONS[c.icon] || Globe;
                const on = f.estilo === c.key;
                const cover = covers[c.key];
                return (
                  <button key={c.key} type="button" className={`tv-style ${on ? "is-active" : ""}`} aria-pressed={on} onClick={() => setFilters({ estilo: on ? "" : c.key }, { toList: !on })}>
                    {cover && <TripMedia trip={cover} className="tv-style__photo" sizes="(max-width: 700px) 46vw, 240px" />}
                    <span className="tv-style__icon">
                      <Icon size={22} weight="duotone" />
                    </span>
                    <span className="tv-style__name">{tx(c.label)}</span>
                    {status === "ready" && <small>{t("travel.found", { n: inStyle.length })}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <LocalAds />

        {/* ---------------------------- All trips --------------------------- */}
        <section className="section tv-list ads-bleed" id="lista">
          <div className="container container--full">
            <div className="tv-list__head">
              <div>
                <h2 className="tv-h2">{t("travel.allTrips")}</h2>
                <p className="muted">{t("travel.allTripsText")}</p>
              </div>
              <label className="tv-sort">
                <span>{t("travel.sort")}</span>
                <select className="input" value={f.orden} onChange={(e) => setFilters({ orden: e.target.value })}>
                  {SORTS.map(([value, key]) => (
                    <option key={key} value={value}>
                      {t(`travel.${key}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tv-tabs" role="group" aria-label={t("travel.searchType")}>
              {["", ...TYPES].map((type) => {
                const count = type ? base.filter((trip) => trip.type === type).length : base.length;
                const on = f.tipo === type;
                return (
                  <button key={type || "all"} type="button" className={`tv-tab ${on ? "is-active" : ""}`} aria-pressed={on} onClick={() => setFilters({ tipo: type })}>
                    {type ? t(`travel.typePlural.${type}`) : t("travel.typeAll")}
                    {status === "ready" && <span>{count}</span>}
                  </button>
                );
              })}
              <button type="button" className={`tv-tab tv-tab--hot ${f.ofertas ? "is-active" : ""}`} aria-pressed={f.ofertas} onClick={() => setFilters({ ofertas: !f.ofertas })}>
                {t("travel.navOffers")}
              </button>
            </div>

            {active.length > 0 && (
              <div className="tv-active">
                {active.map((chip) => (
                  <button key={chip.key} type="button" className="chip chip--active" onClick={() => setFilters({ [chip.key]: "" })}>
                    {chip.label} <X size={14} weight="bold" />
                  </button>
                ))}
                <button type="button" className="tv-active__clear" onClick={clearAll}>
                  {t("travel.clear")}
                </button>
              </div>
            )}

            {status === "loading" ? (
              <div className="trip-grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <TripCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length ? (
              <>
                <p className="tv-count" aria-live="polite">
                  {t("travel.tripsCount", { n: results.length })}
                </p>
                <div className="trip-grid trip-grid--list">
                  {results.map((trip) => (
                    <TripCard key={trip.id} trip={trip} compact />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={MagnifyingGlass} title={t("travel.noTrips")} text={t("travel.noTripsText")}>
                <Button variant="primary" onClick={clearAll}>
                  {t("travel.clearFilters")}
                </Button>
              </EmptyState>
            )}
          </div>
        </section>

        <SponsoredSlot index={1} />

        {/* -------------------------- How it works -------------------------- */}
        <section className="section tv-how">
          <div className="container container--full">
            <h2 className="tv-h2 tv-center">{t("travel.howTitle")}</h2>
            <ol className="tv-steps">
              {[
                [MapTrifold, "how1"],
                [CalendarCheck, "how2"],
                [ChatsCircle, "how3"],
                [Sun, "how4"],
              ].map(([Icon, key], i) => (
                <li key={key} className="tv-step">
                  <span className="tv-step__num">{i + 1}</span>
                  <Icon size={30} weight="duotone" />
                  <strong>{t(`travel.${key}`)}</strong>
                  <p>{t(`travel.${key}Text`, { city: CITY.name })}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------- Why ------------------------------ */}
        <section className="tv-why ads-bleed">
          <div className="container container--full tv-why__grid">
            <div className="tv-why__art" aria-hidden="true">
              <Photo src={PHOTOS.quebecDusk.src} sizes="(max-width: 860px) 92vw, 45vw" w={1600} />
              <Photo src={PHOTOS.niagaraBoat.src} className="tv-why__inset" sizes="(max-width: 860px) 40vw, 18vw" w={800} />
            </div>
            <div>
              <span className="eyebrow">{t("travel.brand")}</span>
              <h2 className="tv-h2">{t("travel.whyTitle")}</h2>
              <ul className="tv-why__list">
                {[
                  [Van, "why1"],
                  [MapTrifold, "why2"],
                  [Translate, "why3"],
                  [UsersThree, "why4"],
                ].map(([Icon, key]) => (
                  <li key={key}>
                    <span className="tv-why__icon">
                      <Icon size={24} weight="duotone" />
                    </span>
                    <div>
                      <strong>{t(`travel.${key}`)}</strong>
                      <p>{t(`travel.${key}Text`)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------- FAQ ------------------------------ */}
        <section className="section tv-faq">
          <div className="container container--narrow">
            <h2 className="tv-h2 tv-center">{t("travel.faqTitle")}</h2>
            <div className="tv-faq__list">
              {Array.isArray(faq) &&
                faq.map(([q, a]) => (
                  <details key={q} className="tv-faq__item">
                    <summary>
                      {q}
                      <Plus size={18} weight="bold" />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
            </div>
          </div>
        </section>

      </AdLayout>

      {/* ------------------------------- CTA ------------------------------ */}
      <section className="tv-cta-band">
        <Photo src={PHOTOS.niagara.src} className="tv-cta-band__photo" sizes="100vw" w={1600} srcSet={photoSrcSet(PHOTOS.niagara.src, BACKDROP_WIDTHS)} />
        <div className="container container--full">
          <div className="tv-cta">
            <div>
              <h2 className="tv-cta__title">{t("travel.ctaTitle")}</h2>
              <p>{t("travel.ctaText")}</p>
            </div>
            <div className="tv-cta__actions">
              <Button to="/contacto?tema=viajes" variant="light" size="lg">
                {t("travel.ctaButton")}
              </Button>
              {wa && (
                <Button
                  href={`https://wa.me/${phoneDigits(wa)}?text=${encodeURIComponent(t("travel.askWhatsappMsg", { title: t("travel.brand") }))}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="outline-light"
                  size="lg"
                  icon={WhatsappLogo}
                >
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
