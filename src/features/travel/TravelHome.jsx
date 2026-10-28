import { useEffect, useMemo } from "react";
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
import { EmptyState, Photo } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money, phoneDigits } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";
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
      <section className="tv-hero">
        <div className="container tv-hero__grid">
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

        <div className="container">
          <ul className="tv-stats">
            <li>
              <MapTrifold size={22} weight="duotone" /> {t("travel.statDestinations", { n: destinations || 18 })}
            </li>
            <li>
              <Van size={22} weight="duotone" /> {t("travel.statAllInclusive")}
            </li>
            <li>
              <Translate size={22} weight="duotone" /> {t("travel.statGuide")}
            </li>
            {Number(travel.depositPct) > 0 && (
              <li>
                <HandCoins size={22} weight="duotone" /> {t("travel.statDeposit")}
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* ----------------------------- Offers ----------------------------- */}
      {(offers.length > 0 || group.pct > 0) && (
        <section className="section tv-offers">
          <div className="container">
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
                  <Button to="/contacto?tema=viajes" iconRight={ArrowRight}>
                    {t("travel.groupPromoCta")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- By style ----------------------------- */}
      <section className="section section--tight">
        <div className="container">
          <h2 className="tv-h2">{t("travel.categoriesTitle")}</h2>
          <div className="tv-styles">
            {TRIP_CATEGORIES.map((c) => {
              const count = trips.filter((trip) => trip.categories.includes(c.key)).length;
              if (status === "ready" && !count) return null;
              const Icon = CAT_ICONS[c.icon] || Globe;
              const on = f.estilo === c.key;
              return (
                <button key={c.key} type="button" className={`tv-style ${on ? "is-active" : ""}`} aria-pressed={on} onClick={() => setFilters({ estilo: on ? "" : c.key }, { toList: !on })}>
                  <Icon size={26} weight="duotone" />
                  <span>{tx(c.label)}</span>
                  {status === "ready" && <small>{count}</small>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------- All trips --------------------------- */}
      <section className="section tv-list" id="lista">
        <div className="container">
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

      {/* -------------------------- How it works -------------------------- */}
      <section className="section tv-how">
        <div className="container">
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
      <section className="tv-why">
        <div className="container tv-why__grid">
          <div className="tv-why__art" aria-hidden="true">
            <Photo src={PHOTOS.quebecDusk.src} sizes="(max-width: 860px) 92vw, 520px" />
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

      {/* ------------------------------- CTA ------------------------------ */}
      <section className="section section--tight">
        <div className="container">
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
