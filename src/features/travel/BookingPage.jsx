import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bank, CalendarCheck, CaretRight, Clock, CreditCard, Lock, MapTrifold, Money, UsersThree } from "@phosphor-icons/react";
import * as backend from "@backend";
import Button from "@/components/ui/Button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/Field";
import { EmptyState, Notice, QtyStepper, Skeleton } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { formatDate, fromIsoDay, isoDay, money } from "@/lib/format";
import { shortCode } from "@/lib/ids";
import { useSeo } from "@/lib/seo";
import { readJSON, writeJSON } from "@/lib/storage";
import { isEmail, isPhone, maskPhone, phoneDigits10 } from "@/lib/validators";
import { TripMedia } from "./components/TripCard";
import { computeBooking, currentYear, formatClock, upcomingDepartures, useTrips } from "./lib/trips";

const CONTACT_KEY = "lx_travel_contact";
export const LAST_BOOKING_KEY = "lx_last_booking";
const PAY = [
  { id: "etransfer", icon: Bank, key: "payEtransfer" },
  { id: "cash", icon: Money, key: "payCash" },
  { id: "card", icon: CreditCard, key: "payCard" },
];

/** Earliest preferred date for trips without published departures (two days out). */
const preferredMin = () => isoDay(new Date(Date.now() + 2 * 86400000));

export default function BookingPage() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { status, trips } = useTrips();
  const trip = trips.find((x) => x.id === slug);

  useSeo({ title: t("travel.bookingTitle"), noindex: true });

  if (status === "loading") {
    return (
      <div className="container bk">
        <Skeleton w="40%" h={36} />
        <Skeleton w="100%" h={420} r={22} style={{ marginTop: 20 }} />
      </div>
    );
  }
  if (!trip) {
    return (
      <div className="container bk">
        <EmptyState icon={MapTrifold} title={t("travel.notFound")} text={t("travel.notFoundText")}>
          <Button to="/viajes">{t("travel.backToTrips")}</Button>
        </EmptyState>
      </div>
    );
  }
  return <BookingForm trip={trip} />;
}

function BookingForm({ trip }) {
  const { t, tx, lang } = useI18n();
  const settings = useSettings();
  const travel = settings.travel || {};
  const group = travel.groupDiscount || {};
  const { user, info } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const departures = useMemo(() => upcomingDepartures(trip, { count: 12 }), [trip]);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    const saved = readJSON(CONTACT_KEY, {});
    const wanted = params.get("fecha");
    return {
      date: departures.some((d) => isoDay(d) === wanted) ? wanted : "",
      adults: Math.min(2, trip.groupSize),
      children: 0,
      singleRoom: false,
      name: saved.name || "",
      phone: saved.phone ? maskPhone(saved.phone) : "",
      email: saved.email || "",
      others: [],
      requests: "",
      payPref: "etransfer",
      passportOk: false,
      adultsOk: false,
    };
  });
  const set = (changes) => setForm((f) => ({ ...f, ...changes }));

  // Prefill the lead traveller from the signed-in profile
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || info.fullName,
      phone: f.phone || (info.phone ? maskPhone(info.phone) : ""),
      email: f.email || info.email,
    }));
  }, [user, info.fullName, info.phone, info.email]);

  const title = tx(trip.title);
  const showChild = trip.priceChild != null && !trip.adultsOnly;
  const solo = form.adults === 1 && form.children === 0;
  const hasSingle = trip.nights > 0 && trip.singleSupplement > 0;
  const people = form.adults + form.children;
  const price = computeBooking(trip, { adults: form.adults, children: form.children, singleRoom: hasSingle && form.singleRoom }, travel);
  const toGroup = group.pct > 0 && group.min > people ? group.min - people : 0;
  const date = fromIsoDay(form.date);

  const errors = {
    date: !form.date ? t("travel.dateRequired") : "",
    name: form.name.trim().length < 2 ? t("errors.required") : "",
    phone: !isPhone(form.phone) ? t("errors.phone") : "",
    email: form.email.trim() && !isEmail(form.email) ? t("errors.email") : "",
    passport: trip.passport && !form.passportOk ? t("travel.confirmRequired") : "",
    adults: trip.adultsOnly && !form.adultsOk ? t("travel.confirmRequired") : "",
  };
  const show = (key) => (touched ? errors[key] : "");

  async function submit(e) {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      requestAnimationFrame(() => document.querySelector(".bk .field__error")?.closest(".bk-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    setSending(true);
    setError("");
    const payload = {
      ref: shortCode("V"),
      city: CITY.id,
      lang,
      channel: "web-v2",
      tripId: trip.id,
      tripTitle: title,
      tripType: trip.type,
      destination: trip.destination,
      date: form.date,
      departureTime: trip.departure.time || "",
      nights: trip.nights,
      adults: form.adults,
      children: form.children,
      singleRoom: price.supplement > 0,
      pricing: {
        currency: "CAD",
        adultUnit: price.adultUnit,
        childUnit: price.childUnit,
        base: price.base,
        discountPct: price.discountPct,
        discountKind: price.discountKind,
        discount: price.discount,
        supplement: price.supplement,
        total: price.total,
        depositPct: price.depositPct,
        deposit: price.deposit,
      },
      lead: { name: form.name.trim(), phone: phoneDigits10(form.phone), email: form.email.trim().toLowerCase() },
      travelers: form.others
        .slice(0, people - 1)
        .map((n) => (n || "").trim())
        .filter(Boolean),
      requests: form.requests.trim(),
      payPref: form.payPref,
      confirms: { passport: Boolean(trip.passport && form.passportOk), adults: Boolean(trip.adultsOnly && form.adultsOk) },
    };
    try {
      const { id } = await backend.createBooking(payload);
      writeJSON(CONTACT_KEY, payload.lead);
      writeJSON(LAST_BOOKING_KEY, { id, ...payload }, "session");
      navigate(`/viajes/reserva/${id}`);
    } catch (err) {
      console.error("Booking failed", err);
      setError(t("travel.bookingError"));
      setSending(false);
    }
  }

  return (
    <div className="container bk">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/viajes">{t("nav.travel")}</Link>
        <CaretRight size={12} weight="bold" />
        <Link to={`/viajes/${trip.id}`}>{title}</Link>
        <CaretRight size={12} weight="bold" />
        <span aria-current="page">{t("travel.bookNow")}</span>
      </nav>
      <div className="bk-head">
        <h1 className="tv-h1">{t("travel.bookingTitle")}</h1>
        <p className="muted">{t("travel.bookingSub")}</p>
      </div>

      <form className="bk-grid" onSubmit={submit} noValidate>
        <div className="bk-main">
          {/* 1 · Date */}
          <section className="bk-card">
            <h2 className="bk-card__title">
              <span>1</span> {t("travel.secDate")}
            </h2>
            {departures.length ? (
              <div className="bk-dates" role="radiogroup" aria-label={t("travel.date")}>
                {departures.map((d) => {
                  const value = isoDay(d);
                  const on = form.date === value;
                  return (
                    <button key={value} type="button" role="radio" aria-checked={on} className={`bk-date ${on ? "is-active" : ""}`} onClick={() => set({ date: value })}>
                      <span>{formatDate(d, lang, { weekday: "short" })}</span>
                      <strong>{d.getDate()}</strong>
                      <span>{formatDate(d, lang, { month: "short" })}</span>
                      {d.getFullYear() !== currentYear() && <small>{d.getFullYear()}</small>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <Notice tone="info">{t("travel.noDepartures")}</Notice>
                <TextField
                  type="date"
                  label={t("travel.preferredDate")}
                  min={preferredMin()}
                  value={form.date}
                  onChange={(e) => set({ date: e.target.value })}
                  className="bk-preferred"
                />
              </>
            )}
            {show("date") && <span className="field__error">{errors.date}</span>}
            {date && (
              <p className="bk-when">
                <Clock size={18} weight="bold" />
                <span>
                  {formatDate(date, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {trip.departure.time && ` · ${t("travel.departs", { time: formatClock(trip.departure.time, lang) })}`}
                </span>
              </p>
            )}
          </section>

          {/* 2 · Travellers */}
          <section className="bk-card">
            <h2 className="bk-card__title">
              <span>2</span> {t("travel.secTravelers")}
            </h2>
            <div className="bk-counter">
              <div className="grow">
                <strong>{t("travel.adults")}</strong>
                <span>{trip.adultsOnly ? t("travel.adultsOnly") : t("travel.adultsHint")}</span>
              </div>
              <span className="bk-unit">
                {money(price.adultUnit, { whole: true })} <small>{t("travel.perPersonShort")}</small>
              </span>
              <QtyStepper value={form.adults} min={1} max={trip.groupSize - form.children} onChange={(n) => set({ adults: n })} />
            </div>
            {showChild && (
              <div className="bk-counter">
                <div className="grow">
                  <strong>{t("travel.children")}</strong>
                  <span>{t("travel.childrenHint", { ages: trip.childAges || "3–12" })}</span>
                </div>
                <span className="bk-unit">
                  {money(price.childUnit, { whole: true })} <small>{t("travel.perPersonShort")}</small>
                </span>
                <QtyStepper value={form.children} min={0} max={trip.groupSize - form.adults} onChange={(n) => set({ children: n })} />
              </div>
            )}
            {hasSingle &&
              (solo ? (
                <Notice tone="info" className="bk-tip">
                  {t("travel.soloSupplement", { amount: money(trip.singleSupplement, { whole: true }) })}
                </Notice>
              ) : (
                <div className="bk-single">
                  <Checkbox label={t("travel.singleRoom")} checked={form.singleRoom} onChange={(e) => set({ singleRoom: e.target.checked })} />
                  <span className="field__hint">{t("travel.singleRoomHint", { amount: money(trip.singleSupplement, { whole: true }) })}</span>
                </div>
              ))}
            {toGroup > 0 && toGroup <= 3 && (
              <p className="bk-group-tip">
                <UsersThree size={18} weight="bold" /> {t("travel.groupHint", { n: toGroup, pct: group.pct })}
              </p>
            )}
            {people > 1 && (
              <div className="bk-names">
                <p className="field__label">
                  {t("travel.otherTravelers")} <small>({t("travel.sendLater")})</small>
                </p>
                <p className="field__hint">{t("travel.otherTravelersHint")}</p>
                <div className="bk-names__grid">
                  {Array.from({ length: people - 1 }, (_, i) => (
                    <TextField
                      key={i}
                      aria-label={t("travel.travelerN", { n: i + 2 })}
                      placeholder={t("travel.travelerN", { n: i + 2 })}
                      value={form.others[i] || ""}
                      maxLength={80}
                      onChange={(e) => {
                        const others = [...form.others];
                        others[i] = e.target.value;
                        set({ others });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 3 · Contact */}
          <section className="bk-card">
            <h2 className="bk-card__title">
              <span>3</span> {t("travel.secContact")}
            </h2>
            <p className="field__hint bk-card__hint">{t("travel.leadTraveler")}</p>
            <div className="form-grid">
              <TextField className="span-2" label={t("travel.fullName")} value={form.name} onChange={(e) => set({ name: e.target.value })} error={show("name")} autoComplete="name" maxLength={80} />
              <TextField
                label={t("travel.phone")}
                value={form.phone}
                onChange={(e) => set({ phone: maskPhone(e.target.value) })}
                error={show("phone")}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(226) 555-0123"
              />
              <TextField label={t("travel.email")} optional={t("common.optional")} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} error={show("email")} autoComplete="email" />
              <TextAreaField
                className="span-2"
                label={t("travel.requests")}
                optional={t("common.optional")}
                placeholder={t("travel.requestsPlaceholder")}
                value={form.requests}
                onChange={(e) => set({ requests: e.target.value })}
                rows={3}
                maxLength={600}
              />
            </div>
          </section>

          {/* 4 · Payment + confirmations */}
          <section className="bk-card">
            <h2 className="bk-card__title">
              <span>4</span> {t("travel.secPayment")}
            </h2>
            <p className="field__label">{t("travel.payPref")}</p>
            <div className="bk-pay" role="radiogroup" aria-label={t("travel.payPref")}>
              {PAY.map(({ id, icon: Icon, key }) => (
                <button key={id} type="button" role="radio" aria-checked={form.payPref === id} className="choice" onClick={() => set({ payPref: id })}>
                  <span className="choice__radio" />
                  <Icon size={24} weight="duotone" />
                  <span className="choice__title">{t(`travel.${key}`)}</span>
                </button>
              ))}
            </div>
            {trip.passport && (
              <div className="bk-confirm">
                <Checkbox label={t("travel.passportConfirm")} checked={form.passportOk} onChange={(e) => set({ passportOk: e.target.checked })} />
                {show("passport") && <span className="field__error">{errors.passport}</span>}
              </div>
            )}
            {trip.adultsOnly && (
              <div className="bk-confirm">
                <Checkbox label={t("travel.adultsConfirm")} checked={form.adultsOk} onChange={(e) => set({ adultsOk: e.target.checked })} />
                {show("adults") && <span className="field__error">{errors.adults}</span>}
              </div>
            )}
          </section>
        </div>

        <aside className="bk-aside">
          <div className="bk-summary">
            <h2 className="bk-summary__title">{t("travel.summary")}</h2>
            <div className="bk-trip">
              <div className="bk-trip__media">
                <TripMedia trip={trip} />
              </div>
              <div>
                <strong>{title}</strong>
                <span>
                  {t("common.days", { n: trip.durationDays })}
                  {trip.nights > 0 && ` · ${t("common.nights", { n: trip.nights })}`}
                </span>
                <Link to="/viajes">{t("travel.changeTrip")}</Link>
              </div>
            </div>
            <dl className="bk-lines">
              <div>
                <dt>{t("travel.date")}</dt>
                <dd>{date ? formatDate(date, lang, { weekday: "short", day: "numeric", month: "short" }) : "—"}</dd>
              </div>
              <div>
                <dt>{t("travel.adultsLine", { n: form.adults, price: money(price.adultUnit, { whole: true }) })}</dt>
                <dd>{money(form.adults * price.adultUnit)}</dd>
              </div>
              {form.children > 0 && (
                <div>
                  <dt>{t("travel.childrenLine", { n: form.children, price: money(price.childUnit, { whole: true }) })}</dt>
                  <dd>{money(form.children * price.childUnit)}</dd>
                </div>
              )}
              {price.discount > 0 && (
                <div className="bk-lines__discount">
                  <dt>{price.discountKind === "group" ? t("travel.discountGroup", { pct: price.discountPct }) : t("travel.discountOffer", { pct: price.discountPct })}</dt>
                  <dd>−{money(price.discount)}</dd>
                </div>
              )}
              {price.supplement > 0 && (
                <div>
                  <dt>{t("travel.supplementLine")}</dt>
                  <dd>+{money(price.supplement)}</dd>
                </div>
              )}
              <div className="bk-lines__total">
                <dt>{t("travel.total")}</dt>
                <dd>{money(price.total)}</dd>
              </div>
            </dl>
            {price.depositPct > 0 && (
              <div className="bk-deposit">
                <div>
                  <span>{t("travel.deposit", { pct: price.depositPct })}</span>
                  <strong>{money(price.deposit)}</strong>
                </div>
                <div>
                  <span>{t("travel.balance")}</span>
                  <span>{money(Math.max(0, price.total - price.deposit))}</span>
                </div>
              </div>
            )}
            <p className="bk-note">
              <Lock size={16} weight="bold" /> {t("travel.noPaymentNow")}
            </p>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="xl" block loading={sending} icon={CalendarCheck}>
              {sending ? t("travel.submitting") : t("travel.submit")}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
