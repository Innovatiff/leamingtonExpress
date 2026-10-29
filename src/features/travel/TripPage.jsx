import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarBlank,
  CalendarCheck,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  Coffee,
  ForkKnife,
  HandCoins,
  IceCream,
  IdentificationCard,
  Info,
  MapPin,
  MapTrifold,
  MoonStars,
  PersonSimpleWalk,
  RoadHorizon,
  ShareNetwork,
  UsersThree,
  WhatsappLogo,
  Wine,
  X,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Misc";
import { SITE_NAME, SITE_URL } from "@/config/site";
import { AdLayout, LocalAds } from "@/features/ads/Ads";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { formatDate, isoDay, money, phoneDigits } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { useSeo } from "@/lib/seo";
import TripCard, { TripMedia } from "./components/TripCard";
import { HotelCard, MealCard, TripSights, TripTips, photoCredit } from "./components/TripExtras";
import { MEAL_LABELS, TRIP_TYPES } from "./data/trips";
import { currentYear, formatClock, offerPrice, upcomingDepartures, useTrips } from "./lib/trips";

const MEAL_ICON = { breakfast: Coffee, lunch: ForkKnife, dinner: ForkKnife, snack: IceCream, tasting: Wine };

function similarTrips(trip, trips, limit = 3) {
  return trips
    .filter((x) => x.id !== trip.id)
    .map((x) => ({ x, score: x.categories.filter((c) => trip.categories.includes(c)).length + (x.type === trip.type ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.x.order - b.x.order)
    .slice(0, limit)
    .map((s) => s.x);
}

export default function TripPage() {
  const { slug } = useParams();
  const { t, tx, lang } = useI18n();
  const settings = useSettings();
  const toast = useToast();
  const { status, trips } = useTrips();
  const trip = trips.find((x) => x.id === slug);
  const travel = settings.travel || {};
  const group = travel.groupDiscount || {};
  const wa = settings.contact?.whatsapp;

  useSeo({
    title: trip ? tx(trip.title) : status === "ready" ? t("travel.notFound") : t("travel.brand"),
    description: trip ? `${tx(trip.tagline)} ${t("travel.from")} ${money(trip.fromPrice, { whole: true })} ${t("travel.perPerson")}.` : undefined,
    image: trip?.image ? photoUrl(trip.image, 1200, 630) : undefined,
    noindex: status === "ready" && !trip,
  });

  // Structured data so search engines can show the trip with its price
  useEffect(() => {
    if (!trip) return undefined;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: tx(trip.title),
      description: tx(trip.summary) || tx(trip.tagline),
      image: trip.image ? photoUrl(trip.image, 1200) : `${SITE_URL}/og-image.jpg`,
      itinerary: {
        "@type": "ItemList",
        itemListElement: trip.highlights.map((h, i) => ({ "@type": "ListItem", position: i + 1, name: tx(h) })),
      },
      offers: {
        "@type": "Offer",
        price: trip.fromPrice,
        priceCurrency: "CAD",
        url: `${SITE_URL}/viajes/${trip.id}`,
        availability: "https://schema.org/InStock",
      },
      provider: { "@type": "TravelAgency", name: SITE_NAME, url: SITE_URL },
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [trip, tx]);

  if (status === "loading") {
    return (
      <AdLayout page="travel">
        <div className="tv-trip">
          <Skeleton w="30%" h={14} />
          <Skeleton w="70%" h={44} style={{ marginTop: 14 }} />
          <Skeleton w="100%" h={360} r={26} style={{ marginTop: 22 }} />
        </div>
      </AdLayout>
    );
  }

  if (!trip) {
    return (
      <AdLayout page="travel">
        <div className="tv-trip">
          <EmptyState icon={MapTrifold} title={t("travel.notFound")} text={t("travel.notFoundText")}>
            <Button to="/viajes">{t("travel.backToTrips")}</Button>
          </EmptyState>
        </div>
      </AdLayout>
    );
  }

  const title = tx(trip.title);
  const departures = upcomingDepartures(trip, { count: 8 });
  const similar = similarTrips(trip, trips);
  const saving = trip.priceAdult - trip.fromPrice;
  const bookUrl = `/viajes/${trip.id}/reservar`;
  const waHref = wa ? `https://wa.me/${phoneDigits(wa)}?text=${encodeURIComponent(t("travel.askWhatsappMsg", { title }))}` : "";
  const showChild = trip.priceChild != null && !trip.adultsOnly;
  const showSingle = trip.nights > 0 && trip.singleSupplement > 0;
  const depositPct = Number(travel.depositPct) || 0;
  const mainCredit = photoCredit(t, trip);
  const richMeals = trip.meals.some((m) => m.image || tx(m.text));
  const sections = [
    ["resumen", "overview"],
    trip.sights.length > 0 && ["lugares", "sights"],
    ["itinerario", "itinerary"],
    trip.hotels.length > 0 && ["hotel", "hotels"],
    trip.meals.length > 0 && ["comidas", "meals"],
    trip.breakdown.length > 0 && ["precio", "price"],
    ["fechas", "dates"],
    ["info", "info"],
  ].filter(Boolean);

  async function share() {
    const url = `${SITE_URL}/viajes/${trip.id}`;
    try {
      if (navigator.share) await navigator.share({ title, text: t("travel.shareText", { title }), url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("common.copied"));
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <>
      <AdLayout page="travel">
        <div className="tv-trip">
          <div className="container">
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav.home")}</Link>
              <CaretRight size={12} weight="bold" />
              <Link to="/viajes">{t("nav.travel")}</Link>
              <CaretRight size={12} weight="bold" />
              <span aria-current="page">{title}</span>
            </nav>

            <header className="tv-trip__head">
              <div className="tv-trip__meta">
                <span className="tv-pill">{tx(TRIP_TYPES[trip.type])}</span>
                <span className="tv-trip__dest">
                  <MapPin size={16} weight="fill" /> {trip.destination}
                </span>
                <button type="button" className="tv-trip__share" onClick={share}>
                  <ShareNetwork size={18} weight="bold" /> {t("travel.share")}
                </button>
              </div>
              <h1 className="tv-trip__title">{title}</h1>
              <p className="tv-trip__tagline">{tx(trip.tagline)}</p>
            </header>

            <div className="tv-trip__media">
              <TripMedia trip={trip} alt={tx(trip.title)} sizes="(max-width: 1280px) 100vw, 1220px" eager />
              {mainCredit &&
                (trip.photoLink ? (
                  <a className="tv-trip__credit" href={trip.photoLink} target="_blank" rel="noreferrer">
                    {mainCredit}
                  </a>
                ) : (
                  <span className="tv-trip__credit">{mainCredit}</span>
                ))}
              {trip.offerPct > 0 && (
                <span className="tv-trip__offer">
                  −{trip.offerPct}% · {tx(trip.offer?.label) || t("travel.offer")}
                </span>
              )}
            </div>

            <ul className="tv-facts">
              <li>
                <Clock size={22} weight="duotone" />
                <span>{t("travel.duration")}</span>
                <strong>
                  {t("common.days", { n: trip.durationDays })}
                  {trip.nights > 0 && ` · ${t("common.nights", { n: trip.nights })}`}
                </strong>
              </li>
              {trip.distanceKm > 0 && (
                <li>
                  <RoadHorizon size={22} weight="duotone" />
                  <span>{t("travel.distance")}</span>
                  <strong>{t("travel.distanceValue", { km: trip.distanceKm.toLocaleString(lang === "en" ? "en-CA" : "es-MX"), time: trip.driveTime })}</strong>
                </li>
              )}
              {trip.departure.time && (
                <li>
                  <CalendarBlank size={22} weight="duotone" />
                  <span>{t("travel.departureLabel")}</span>
                  <strong>{formatClock(trip.departure.time, lang)}</strong>
                </li>
              )}
              {trip.departure.returnTime && (
                <li>
                  <MoonStars size={22} weight="duotone" />
                  <span>{t("travel.returnLabel")}</span>
                  <strong>{formatClock(trip.departure.returnTime, lang)}</strong>
                </li>
              )}
              <li>
                <UsersThree size={22} weight="duotone" />
                <span>{t("travel.groupLabel")}</span>
                <strong>{t("travel.groupMax", { n: trip.groupSize })}</strong>
              </li>
              <li>
                <IdentificationCard size={22} weight="duotone" />
                <span>{t("travel.documents")}</span>
                <strong>{trip.passport ? t("travel.passportValid") : t("travel.photoId")}</strong>
              </li>
              {trip.meals.length > 0 && (
                <li>
                  <ForkKnife size={22} weight="duotone" />
                  <span>{t("travel.meals")}</span>
                  <strong>{t("travel.includedMeals", { n: trip.meals.length })}</strong>
                </li>
              )}
              {trip.activity && (
                <li title={t(`travel.activityHints.${trip.activity}`)}>
                  <PersonSimpleWalk size={22} weight="duotone" />
                  <span>{t("travel.activity")}</span>
                  <strong>{t(`travel.activityLevels.${trip.activity}`)}</strong>
                </li>
              )}
            </ul>
          </div>

          <div className="container tv-trip__layout">
            <div className="tv-trip__content">
              <nav className="tv-trip__nav" aria-label={t("travel.overview")}>
                {sections.map(([id, key]) => (
                  <a key={id} href={`#${id}`}>
                    {t(`travel.tripNav.${key}`)}
                  </a>
                ))}
              </nav>

              <section id="resumen" className="tv-sec">
                <h2 className="tv-sec__title">{t("travel.overview")}</h2>
                <p className="tv-lead">{tx(trip.summary) || tx(trip.tagline)}</p>
                {trip.highlights.length > 0 && (
                  <>
                    <h3 className="tv-sec__sub">{t("travel.highlights")}</h3>
                    <ul className="tv-highlights">
                      {trip.highlights.map((h) => (
                        <li key={tx(h)}>
                          <CheckCircle size={22} weight="fill" /> {tx(h)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              {trip.sights.length > 0 && (
                <section id="lugares" className="tv-sec">
                  <h2 className="tv-sec__title">{t("travel.sightsTitle")}</h2>
                  <TripSights trip={trip} />
                </section>
              )}

              {trip.itinerary.length > 0 && (
                <section id="itinerario" className="tv-sec">
                  <h2 className="tv-sec__title">{t("travel.itinerary")}</h2>
                  {trip.itinerary.map((d) => (
                    <div key={d.day} className="tv-day">
                      <div className="tv-day__head">
                        <span className="tv-day__n">{t("travel.dayN", { n: d.day })}</span>
                        <strong>{tx(d.title)}</strong>
                      </div>
                      <ol className="tv-timeline">
                        {(d.items || []).map((it, i) => (
                          <li key={i}>
                            <time>{formatClock(it.time, lang)}</time>
                            <span>{tx(it.text)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </section>
              )}

              {trip.hotels.length > 0 && (
                <section id="hotel" className="tv-sec">
                  <h2 className="tv-sec__title">{trip.hotels.length > 1 ? t("travel.hotels") : t("travel.hotel")}</h2>
                  <div className="tv-hotels2">
                    {trip.hotels.map((h) => (
                      <HotelCard key={h.name} hotel={h} trip={trip} />
                    ))}
                  </div>
                </section>
              )}

              {trip.meals.length > 0 && (
                <section id="comidas" className="tv-sec">
                  <h2 className="tv-sec__title">{t("travel.meals")}</h2>
                  <p className="muted">{t("travel.mealsText")}</p>
                  {richMeals ? (
                    <div className="tv-meals2">
                      {trip.meals.map((m, i) => (
                        <MealCard key={i} meal={m} trip={trip} />
                      ))}
                    </div>
                  ) : (
                    <ul className="tv-meals">
                      {trip.meals.map((m, i) => {
                        const Icon = MEAL_ICON[m.meal] || ForkKnife;
                        return (
                          <li key={i} className="tv-meal">
                            <span className="tv-meal__icon">
                              <Icon size={22} weight="duotone" />
                            </span>
                            <div className="tv-meal__body">
                              <span className="tv-meal__kind">
                                {tx(MEAL_LABELS[m.meal]) || m.meal}
                                {trip.durationDays > 1 && ` · ${t("travel.dayN", { n: m.day })}`}
                              </span>
                              <strong>{m.place}</strong>
                              <span className="tv-meal__cuisine">{tx(m.cuisine)}</span>
                            </div>
                            {tx(m.note) && <span className="tv-meal__note">{tx(m.note)}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {(trip.includes.length > 0 || trip.excludes.length > 0) && (
                <section className="tv-sec tv-incl">
                  {trip.includes.length > 0 && (
                    <div>
                      <h2 className="tv-sec__title tv-sec__title--sm">{t("travel.includes")}</h2>
                      <ul className="tv-checks">
                        {trip.includes.map((x) => (
                          <li key={tx(x)}>
                            <Check size={18} weight="bold" /> {tx(x)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {trip.excludes.length > 0 && (
                    <div>
                      <h2 className="tv-sec__title tv-sec__title--sm">{t("travel.excludes")}</h2>
                      <ul className="tv-checks tv-checks--no">
                        {trip.excludes.map((x) => (
                          <li key={tx(x)}>
                            <X size={18} weight="bold" /> {tx(x)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {trip.breakdown.length > 0 && (
                <section id="precio" className="tv-sec">
                  <h2 className="tv-sec__title">{t("travel.breakdown")}</h2>
                  <p className="muted">{t("travel.breakdownText")}</p>
                  <div className="tv-breakdown">
                    {trip.breakdown.map((b) => (
                      <div key={tx(b.label)} className="tv-breakdown__row">
                        <span>{tx(b.label)}</span>
                        <span>{money(b.amount)}</span>
                      </div>
                    ))}
                    <div className="tv-breakdown__row tv-breakdown__row--total">
                      <span>{t("travel.totalPerPerson")}</span>
                      <strong>{money(trip.priceAdult)}</strong>
                    </div>
                    {saving > 0 && (
                      <>
                        <div className="tv-breakdown__row tv-breakdown__row--offer">
                          <span>{t("travel.discountOffer", { pct: trip.offerPct })}</span>
                          <span>−{money(saving)}</span>
                        </div>
                        <div className="tv-breakdown__row tv-breakdown__row--final">
                          <span>{t("travel.finalPrice")}</span>
                          <strong>{money(trip.fromPrice)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                  <ul className="tv-price-notes">
                    {showChild && (
                      <li>
                        {t("travel.childPrice", { ages: trip.childAges || "3–12" })}: <strong>{money(offerPrice(trip, trip.priceChild), { whole: true })}</strong>
                      </li>
                    )}
                    {showSingle && (
                      <li>
                        {t("travel.singleSupplement")}: <strong>+{money(trip.singleSupplement, { whole: true })}</strong>
                      </li>
                    )}
                    {group.pct > 0 && <li>{t("travel.groupText", { pct: group.pct, min: group.min })}</li>}
                  </ul>
                </section>
              )}

              <section id="fechas" className="tv-sec">
                <h2 className="tv-sec__title">{t("travel.departures")}</h2>
                {departures.length ? (
                  <>
                    <p className="muted">{t("travel.pickDate")}</p>
                    <div className="tv-dates">
                      {departures.map((d) => (
                        <Link key={isoDay(d)} to={`${bookUrl}?fecha=${isoDay(d)}`} className="tv-date" aria-label={`${t("travel.bookDate")}: ${formatDate(d, lang, { weekday: "long", day: "numeric", month: "long" })}`}>
                          <span>{formatDate(d, lang, { weekday: "short" })}</span>
                          <strong>{d.getDate()}</strong>
                          <span>{formatDate(d, lang, { month: "short" })}</span>
                          {d.getFullYear() !== currentYear() && <small>{d.getFullYear()}</small>}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="muted">{t("travel.noDates")}</p>
                )}
              </section>

              <section id="info" className="tv-sec">
                <h2 className="tv-sec__title">{t("travel.importantInfo")}</h2>
                <ul className="tv-info">
                  {tx(travel.pickupPoint) && (
                    <li>
                      <MapPin size={22} weight="duotone" />
                      <div>
                        <strong>{t("travel.pickupPoint")}</strong>
                        <span>{tx(travel.pickupPoint)}</span>
                      </div>
                    </li>
                  )}
                  {trip.departure.time && (
                    <li>
                      <Clock size={22} weight="duotone" />
                      <div>
                        <strong>{t("travel.departs", { time: formatClock(trip.departure.time, lang) })}</strong>
                        {trip.departure.returnTime && <span>{t("travel.returns", { time: formatClock(trip.departure.returnTime, lang) })}</span>}
                      </div>
                    </li>
                  )}
                  <li>
                    <IdentificationCard size={22} weight="duotone" />
                    <div>
                      <strong>{t("travel.documents")}</strong>
                      <span>{trip.passport ? t("travel.passportValid") : t("travel.photoId")}</span>
                    </div>
                  </li>
                  {trip.adultsOnly && (
                    <li>
                      <Info size={22} weight="duotone" />
                      <div>
                        <strong>{t("travel.adultsOnly")}</strong>
                        <span>{t("travel.ageNote")}</span>
                      </div>
                    </li>
                  )}
                  <li>
                    <UsersThree size={22} weight="duotone" />
                    <div>
                      <strong>{t("travel.groupSize", { n: trip.groupSize })}</strong>
                    </div>
                  </li>
                </ul>
                {tx(trip.notes) && (
                  <Notice tone={trip.passport ? "warning" : "info"} className="tv-notes">
                    {tx(trip.notes)}
                  </Notice>
                )}
                <TripTips trip={trip} />
              </section>
            </div>

            <aside className="tv-trip__aside">
              <div className="tv-book">
                {trip.offerPct > 0 && (
                  <span className="tv-book__offer">
                    {tx(trip.offer?.label) || t("travel.offer")} · −{trip.offerPct}%
                  </span>
                )}
                <span className="tv-book__label">{t("travel.priceFrom")}</span>
                <div className="tv-book__price">
                  <strong>{money(trip.fromPrice, { whole: true })}</strong>
                  {saving > 0 && <s>{money(trip.priceAdult, { whole: true })}</s>}
                </div>
                {saving > 0 && <span className="tv-book__save">{t("travel.youSave", { amount: money(saving, { whole: true }) })}</span>}
                {(showChild || showSingle || trip.adultsOnly) && (
                  <ul className="tv-book__lines">
                    {showChild && (
                      <li>
                        <span>{t("travel.childPrice", { ages: trip.childAges || "3–12" })}</span>
                        <strong>{money(offerPrice(trip, trip.priceChild), { whole: true })}</strong>
                      </li>
                    )}
                    {showSingle && (
                      <li>
                        <span>{t("travel.singleSupplement")}</span>
                        <strong>+{money(trip.singleSupplement, { whole: true })}</strong>
                      </li>
                    )}
                    {trip.adultsOnly && (
                      <li>
                        <span>{t("travel.adultsOnly")}</span>
                      </li>
                    )}
                  </ul>
                )}
                {departures[0] && (
                  <p className="tv-book__next">
                    <CalendarBlank size={18} weight="bold" /> {t("travel.nextDeparture")}:{" "}
                    <strong>{formatDate(departures[0], lang, { weekday: "short", day: "numeric", month: "short" })}</strong>
                  </p>
                )}
                <Button to={bookUrl} size="lg" block icon={CalendarCheck}>
                  {t("travel.bookThis")}
                </Button>
                {waHref && (
                  <Button href={waHref} target="_blank" rel="noreferrer" variant="secondary" block icon={WhatsappLogo}>
                    {t("travel.askWhatsapp")}
                  </Button>
                )}
                <ul className="tv-book__trust">
                  <li>
                    <Check size={16} weight="bold" /> {t("travel.trust1")}
                  </li>
                  {depositPct > 0 && (
                    <li>
                      <HandCoins size={16} weight="bold" /> {t("travel.trust2", { pct: depositPct })}
                    </li>
                  )}
                  <li>
                    <WhatsappLogo size={16} weight="bold" /> {t("travel.trust3")}
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          <LocalAds />

          {similar.length > 0 && (
            <section className="section">
              <div className="container">
                <h2 className="tv-h2">{t("travel.similar")}</h2>
                <div className="trip-grid trip-grid--rail tv-similar">
                  {similar.map((x) => (
                    <TripCard key={x.id} trip={x} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </AdLayout>

      <div className="tv-mobilebar">
        <div className="tv-mobilebar__price">
          <span>{t("travel.from")}</span>
          <strong>{money(trip.fromPrice, { whole: true })}</strong>
          <span>{t("travel.perPerson")}</span>
        </div>
        <Button to={bookUrl} icon={CalendarCheck}>
          {t("travel.bookNow")}
        </Button>
      </div>
    </>
  );
}
