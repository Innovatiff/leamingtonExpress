import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  Baby,
  Buildings,
  CalendarBlank,
  Car,
  CheckCircle,
  Clock,
  Copy,
  Crosshair,
  CurrencyDollar,
  IdentificationCard,
  Lightning,
  MapPin,
  MapPinLine,
  NavigationArrow,
  PawPrint,
  ShieldCheck,
  SignOut,
  Suitcase,
  User,
  Users,
  Van,
  WhatsappLogo,
  Wheelchair,
} from "@phosphor-icons/react";
import * as backend from "@backend";
import Logo from "@/components/brand/Logo";
import { LangToggle } from "@/components/layout/SiteHeader";
import Button from "@/components/ui/Button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, QtyStepper } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { formatDate, isoDay, money, phoneDigits } from "@/lib/format";
import { shortCode } from "@/lib/ids";
import { useSeo } from "@/lib/seo";
import { readJSON, writeJSON } from "@/lib/storage";
import { isEmail, isPhone, maskPhone, phoneDigits10 } from "@/lib/validators";
import RouteArt from "./RouteArt";
import "./ride.css";

const STEPS = ["pickup", "dest", "when", "pax", "extras", "contact", "review"];
const GROUP_ICON = { local: MapPinLine, city: Buildings, airport: AirplaneTilt };
const CONTACT_KEY = "lx_ride_contact";

export function estimateFare(km, vehicle, r) {
  if (!km || !r?.showEstimates || km > (Number(r.maxEstimateKm) || 120)) return null;
  let base = Number(r.baseFare || 0) + Number(r.perKm || 0) * km;
  if (vehicle === "xl") base *= Number(r.xlMultiplier) || 1.3;
  base = Math.max(base, Number(r.minFare) || 0);
  return { low: Math.max(Number(r.minFare) || 0, Math.round(base * 0.9)), high: Math.round(base * 1.1) };
}

function initialState(presetId) {
  const contact = readJSON(CONTACT_KEY, {});
  const dest = CITY.rideDestinations.find((d) => d.id === presetId);
  return {
    pickup: { address: "", lat: null, lng: null },
    dest: dest ? { address: "", presetId: dest.id, km: dest.km } : { address: "", presetId: "", km: 0 },
    when: { type: "now", date: isoDay(new Date()), time: "" },
    passengers: 1,
    luggage: 0,
    vehicle: "standard",
    options: { childSeat: false, wheelchair: false, pet: false, stops: false },
    stops: "",
    notes: "",
    contact: { name: contact.name || "", phone: contact.phone ? maskPhone(contact.phone) : "", email: contact.email || "" },
    payment: "cash",
    agree: false,
  };
}

function scheduledDate(when) {
  if (when.type !== "later" || !when.date || !when.time) return null;
  const [y, m, d] = when.date.split("-").map(Number);
  const [hh, mm] = when.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export default function RidePage() {
  const { t, tx, lang } = useI18n();
  const settings = useSettings();
  const toast = useToast();
  const { user, info } = useAuth();
  const [params] = useSearchParams();
  const [data, setData] = useState(() => initialState(params.get("destino")));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState("fwd");
  const [touched, setTouched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [now, setNow] = useState(0); // refreshed on every step (keeps render pure)
  const headingRef = useRef(null);
  const mounted = useRef(false);

  useSeo({ title: t("ride.metaTitle"), description: t("ride.metaDescription", { city: CITY.name }) });

  useEffect(() => {
    document.body.className = "theme-dark theme-ride";
  }, []);

  // Prefill contact from the signed-in profile
  useEffect(() => {
    if (!user) return;
    setData((d) => ({
      ...d,
      contact: {
        name: d.contact.name || info.fullName,
        phone: d.contact.phone || (info.phone ? maskPhone(info.phone) : ""),
        email: d.contact.email || info.email,
      },
    }));
  }, [user, info.fullName, info.phone, info.email]);

  // Move focus to the new slide's heading so screen readers announce it (not on first load)
  useEffect(() => {
    setNow(Date.now());
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, done]);

  const destPreset = CITY.rideDestinations.find((d) => d.id === data.dest.presetId);
  const destLabel = destPreset ? tx(destPreset.label) : data.dest.address;
  const pickupLabel = data.pickup.address || (data.pickup.lat ? t("ride.gpsLabel") : "");
  const estimate = useMemo(() => estimateFare(destPreset?.km, data.vehicle, settings.ride), [destPreset, data.vehicle, settings.ride]);
  const when = scheduledDate(data.when);

  const errors = {
    pickup: data.pickup.address.trim().length < 3 && !data.pickup.lat ? t("errors.required") : "",
    dest: destLabel.trim().length < 3 ? t("errors.required") : "",
    when: data.when.type === "later" && (!when || when.getTime() < now + 25 * 60000) ? t("ride.tooSoon") : "",
    pax: "",
    extras: "",
    contact:
      data.contact.name.trim().length < 2
        ? "name"
        : !isPhone(data.contact.phone)
          ? "phone"
          : data.contact.email.trim() && !isEmail(data.contact.email)
            ? "email"
            : "",
    review: data.agree ? "" : "agree",
  };
  const key = STEPS[step];
  const valid = !errors[key];

  const patch = (changes) => setData((d) => ({ ...d, ...changes }));
  const patchIn = (group, changes) => setData((d) => ({ ...d, [group]: { ...d[group], ...changes } }));

  function go(delta) {
    if (delta > 0 && !valid) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setDir(delta > 0 ? "fwd" : "back");
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  }

  function jump(target) {
    setDir(target < step ? "back" : "fwd");
    setTouched(false);
    setStep(target);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      toast.error(t("ride.locationError"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        patchIn("pickup", { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        toast.success(t("ride.located"));
      },
      () => {
        setLocating(false);
        toast.error(t("ride.locationError"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function submit() {
    if (!valid) {
      setTouched(true);
      return;
    }
    setSending(true);
    setError("");
    const ref = shortCode("R");
    const payload = {
      ref,
      city: CITY.id,
      lang,
      pickup: { address: data.pickup.address.trim() || t("ride.gpsLabel"), lat: data.pickup.lat, lng: data.pickup.lng },
      dropoff: { address: destPreset ? tx(destPreset.label) : data.dest.address.trim(), presetId: destPreset?.id || "", km: destPreset?.km || 0 },
      schedule: when ? { type: "later", date: data.when.date, time: data.when.time, at: when.toISOString() } : { type: "now", date: "", time: "", at: "" },
      passengers: data.passengers,
      luggage: data.luggage,
      vehicle: data.vehicle,
      options: data.options,
      stops: data.options.stops ? data.stops.trim() : "",
      notes: data.notes.trim(),
      contact: { name: data.contact.name.trim(), phone: phoneDigits10(data.contact.phone), email: data.contact.email.trim().toLowerCase() },
      payment: data.payment,
      estimate: estimate ? { low: estimate.low, high: estimate.high, km: destPreset.km } : null,
    };
    try {
      await backend.createRide(payload);
      writeJSON(CONTACT_KEY, payload.contact);
      setDone({ ref, payload });
    } catch (err) {
      console.error("Ride request failed", err);
      setError(t("ride.error"));
    } finally {
      setSending(false);
    }
  }

  if (settings.ride.enabled === false) {
    return (
      <div className="rd">
        <RideTop />
        <div className="rd-disabled">
          <Notice tone="info">{t("ride.disabled")}</Notice>
          <Button to="/">{t("ride.home")}</Button>
        </div>
      </div>
    );
  }

  if (done) {
    const reset = () => {
      setData(initialState(""));
      setDone(null);
      setStep(0);
    };
    return <RideSuccess done={done} onAnother={reset} headingRef={headingRef} />;
  }

  const summary = [
    { icon: MapPin, label: t("ride.from"), value: pickupLabel },
    { icon: NavigationArrow, label: t("ride.to"), value: destLabel },
    {
      icon: Clock,
      label: t("ride.when"),
      value: step >= 2 ? (when ? `${formatDate(when, lang, { weekday: "short", day: "numeric", month: "short" })} · ${data.when.time}` : t("ride.now")) : "",
    },
    { icon: Users, label: t("ride.vehicle"), value: step >= 3 ? `${t(`ride.${data.vehicle}`)} · ${t("ride.travelers", { pax: data.passengers, bags: data.luggage })}` : "" },
  ];

  return (
    <div className="rd">
      <RideTop />
      <div className="rd-body">
        <aside className="rd-side">
          <div className="rd-side__art">
            <RouteArt />
          </div>
          <div className="rd-side__card">
            <h2 className="rd-side__title">{t("ride.summary")}</h2>
            <ul className="rd-summary">
              {summary.map(({ icon: Icon, label, value }) => (
                <li key={label} className={value ? "is-set" : ""}>
                  <Icon size={20} weight="fill" />
                  <div>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                </li>
              ))}
            </ul>
            {estimate && step >= 1 && (
              <div className="rd-estimate">
                <CurrencyDollar size={20} weight="bold" />
                <span>{t("ride.estimate")}</span>
                <strong>
                  {money(estimate.low, { whole: true })} – {money(estimate.high, { whole: true })}
                </strong>
              </div>
            )}
          </div>
          <ul className="rd-trust">
            <li>
              <ShieldCheck size={22} weight="fill" />
              <div>
                <strong>{t("ride.safe")}</strong>
                <span>{t("ride.safeText")}</span>
              </div>
            </li>
            <li>
              <CurrencyDollar size={22} weight="fill" />
              <div>
                <strong>{t("ride.priceUp")}</strong>
                <span>{t("ride.priceUpText")}</span>
              </div>
            </li>
          </ul>
        </aside>

        <main className="rd-main">
          <div className="rd-progress" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} className={i < step ? "is-done" : i === step ? "is-current" : ""} />
            ))}
          </div>
          <p className="rd-stepof">{t("ride.stepOf", { n: step + 1, total: STEPS.length })}</p>

          <div
            className={`rd-slide rd-slide--${dir}`}
            key={key}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
                e.preventDefault();
                if (key !== "review") go(1);
              }
            }}
          >
            {key === "pickup" && (
              <>
                <SlideHead headingRef={headingRef} icon={MapPin} title={t("ride.pickupTitle")} text={t("ride.pickupText")} />
                <TextField
                  label={t("ride.pickupLabel")}
                  placeholder={t("ride.pickupPlaceholder")}
                  value={data.pickup.address}
                  onChange={(e) => patchIn("pickup", { address: e.target.value })}
                  error={touched ? errors.pickup : ""}
                  autoComplete="street-address"
                  data-autofocus
                />
                <button className={`rd-gps ${data.pickup.lat ? "is-set" : ""}`} onClick={locateMe} disabled={locating} type="button">
                  <Crosshair size={20} weight="bold" />
                  {locating ? t("ride.locating") : data.pickup.lat ? `${t("ride.located")} ✓` : t("ride.useLocation")}
                </button>
                {CITY.serviceArea?.length > 0 && (
                  <p className="rd-area">
                    <MapPinLine size={20} weight="bold" />
                    <span>
                      <strong>{t("ride.serviceAreaTitle")}</strong> {new Intl.ListFormat(lang === "en" ? "en-CA" : "es", { type: "conjunction" }).format(CITY.serviceArea)}.{" "}
                      {t("ride.serviceAreaNote")}
                    </span>
                  </p>
                )}
              </>
            )}

            {key === "dest" && (
              <>
                <SlideHead headingRef={headingRef} icon={NavigationArrow} title={t("ride.destTitle")} text={t("ride.destText")} />
                <TextField
                  label={t("ride.destLabel")}
                  placeholder={t("ride.destPlaceholder")}
                  value={destPreset ? tx(destPreset.label) : data.dest.address}
                  onChange={(e) => patch({ dest: { address: e.target.value, presetId: "", km: 0 } })}
                  error={touched ? errors.dest : ""}
                />
                {CITY.rideDestinations.length > 0 && (
                  <>
                    <h3 className="rd-subtitle">{t("ride.popular")}</h3>
                    {["local", "airport", "city"].map((g) => {
                      const list = CITY.rideDestinations.filter((d) => d.group === g);
                      if (!list.length) return null;
                      const GIcon = GROUP_ICON[g];
                      return (
                        <div key={g} className="rd-dest-group">
                          <span className="rd-dest-group__label">
                            <GIcon size={16} weight="bold" /> {t(`ride.groups.${g}`)}
                          </span>
                          <div className="rd-dests">
                            {list.map((d) => {
                              const est = estimateFare(d.km, data.vehicle, settings.ride);
                              const active = data.dest.presetId === d.id;
                              return (
                                <button key={d.id} type="button" className={`rd-dest ${active ? "is-active" : ""}`} onClick={() => patch({ dest: { address: "", presetId: d.id, km: d.km } })} aria-pressed={active}>
                                  <strong>{tx(d.label)}</strong>
                                  <span>
                                    {t("ride.approxKm", { km: d.km })}
                                    {est && ` · ${money(est.low, { whole: true })}–${money(est.high, { whole: true })}`}
                                  </span>
                                  {d.crossBorder && (
                                    <em>
                                      <IdentificationCard size={14} weight="bold" /> {t("ride.crossBorder")}
                                    </em>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {key === "when" && (
              <>
                <SlideHead headingRef={headingRef} icon={Clock} title={t("ride.whenTitle")} text={t("ride.whenText")} />
                <div className="rd-choices" role="radiogroup">
                  <button type="button" role="radio" aria-checked={data.when.type === "now"} className="choice" onClick={() => patchIn("when", { type: "now" })}>
                    <span className="choice__radio" />
                    <Lightning size={26} weight="duotone" />
                    <span className="grow">
                      <span className="choice__title">{t("ride.asap")}</span>
                      <span className="choice__text">{t("ride.asapText")}</span>
                    </span>
                  </button>
                  <button type="button" role="radio" aria-checked={data.when.type === "later"} className="choice" onClick={() => patchIn("when", { type: "later" })}>
                    <span className="choice__radio" />
                    <CalendarBlank size={26} weight="duotone" />
                    <span className="grow">
                      <span className="choice__title">{t("ride.later")}</span>
                      <span className="choice__text">{t("ride.laterText")}</span>
                    </span>
                  </button>
                </div>
                {data.when.type === "later" && (
                  <div className="form-grid rd-when">
                    <TextField label={t("ride.date")} type="date" min={isoDay(new Date())} value={data.when.date} onChange={(e) => patchIn("when", { date: e.target.value })} />
                    <TextField label={t("ride.time")} type="time" step="900" value={data.when.time} onChange={(e) => patchIn("when", { time: e.target.value })} />
                  </div>
                )}
                {touched && errors.when && <span className="field__error">{errors.when}</span>}
              </>
            )}

            {key === "pax" && (
              <>
                <SlideHead headingRef={headingRef} icon={Users} title={t("ride.paxTitle")} text={t("ride.paxText")} />
                <div className="rd-counters">
                  <div className="rd-counter">
                    <User size={24} weight="duotone" />
                    <span className="grow">{t("ride.passengers")}</span>
                    <QtyStepper
                      value={data.passengers}
                      min={1}
                      max={6}
                      onChange={(n) => patch({ passengers: n, vehicle: n > 4 ? "xl" : data.vehicle })}
                    />
                  </div>
                  <div className="rd-counter">
                    <Suitcase size={24} weight="duotone" />
                    <span className="grow">{t("ride.luggage")}</span>
                    <QtyStepper value={data.luggage} min={0} max={8} onChange={(n) => patch({ luggage: n })} />
                  </div>
                </div>
                <h3 className="rd-subtitle">{t("ride.vehicle")}</h3>
                <div className="rd-choices" role="radiogroup">
                  {[
                    { id: "standard", icon: Car },
                    { id: "xl", icon: Van },
                  ].map(({ id, icon: Icon }) => {
                    const est = estimateFare(destPreset?.km, id, settings.ride);
                    const disabled = id === "standard" && data.passengers > 4;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={data.vehicle === id}
                        disabled={disabled}
                        className="choice"
                        onClick={() => patch({ vehicle: id })}
                      >
                        <span className="choice__radio" />
                        <Icon size={28} weight="duotone" />
                        <span className="grow">
                          <span className="choice__title">{t(`ride.${id}`)}</span>
                          <span className="choice__text">{t(`ride.${id}Text`)}</span>
                        </span>
                        {est && <strong className="rd-choice-price">{money(est.low, { whole: true })}+</strong>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {key === "extras" && (
              <>
                <SlideHead headingRef={headingRef} icon={Baby} title={t("ride.extrasTitle")} text={t("ride.extrasText")} />
                <div className="rd-toggles">
                  {[
                    { id: "childSeat", icon: Baby },
                    { id: "wheelchair", icon: Wheelchair },
                    { id: "pet", icon: PawPrint },
                    { id: "stops", icon: MapPinLine },
                  ].map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`rd-toggle ${data.options[id] ? "is-on" : ""}`}
                      aria-pressed={data.options[id]}
                      onClick={() => patchIn("options", { [id]: !data.options[id] })}
                    >
                      <Icon size={24} weight="duotone" />
                      {t(`ride.${id}`)}
                    </button>
                  ))}
                </div>
                {data.options.stops && <TextField label={t("ride.stops")} placeholder={t("ride.stopsPlaceholder")} value={data.stops} onChange={(e) => patch({ stops: e.target.value })} maxLength={200} />}
                <TextAreaField label={t("ride.notes")} optional={t("common.optional")} placeholder={t("ride.notesPlaceholder")} value={data.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} maxLength={400} />
              </>
            )}

            {key === "contact" && (
              <>
                <SlideHead headingRef={headingRef} icon={User} title={t("ride.contactTitle")} text={t("ride.contactText")} />
                <div className="form-grid">
                  <TextField
                    className="span-2"
                    label={t("ride.name")}
                    value={data.contact.name}
                    onChange={(e) => patchIn("contact", { name: e.target.value })}
                    error={touched && errors.contact === "name" ? t("errors.required") : ""}
                    autoComplete="name"
                  />
                  <TextField
                    label={t("ride.phone")}
                    value={data.contact.phone}
                    onChange={(e) => patchIn("contact", { phone: maskPhone(e.target.value) })}
                    error={touched && errors.contact === "phone" ? t("errors.phone") : ""}
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(226) 555-0123"
                  />
                  <TextField
                    label={t("ride.email")}
                    optional={t("common.optional")}
                    type="email"
                    value={data.contact.email}
                    onChange={(e) => patchIn("contact", { email: e.target.value })}
                    error={touched && errors.contact === "email" ? t("errors.email") : ""}
                    autoComplete="email"
                  />
                </div>
                <h3 className="rd-subtitle">{t("ride.payTitle")}</h3>
                <div className="rd-pay">
                  {["cash", "card", "etransfer"].map((p) => (
                    <button key={p} type="button" className={`chip ${data.payment === p ? "chip--active" : ""}`} aria-pressed={data.payment === p} onClick={() => patch({ payment: p })}>
                      {t(`ride.pay${p === "cash" ? "Cash" : p === "card" ? "Card" : "Etransfer"}`)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {key === "review" && (
              <>
                <SlideHead headingRef={headingRef} icon={CheckCircle} title={t("ride.reviewTitle")} text={t("ride.reviewText")} />
                <div className="rd-review">
                  <div className="rd-route">
                    <div className="rd-route__point">
                      <span className="rd-route__dot" />
                      <div>
                        <span>{t("ride.from")}</span>
                        <strong>{pickupLabel}</strong>
                      </div>
                      <button type="button" onClick={() => jump(0)}>
                        {t("ride.edit")}
                      </button>
                    </div>
                    <div className="rd-route__point">
                      <MapPin size={20} weight="fill" className="rd-route__pin" />
                      <div>
                        <span>{t("ride.to")}</span>
                        <strong>{destLabel}</strong>
                      </div>
                      <button type="button" onClick={() => jump(1)}>
                        {t("ride.edit")}
                      </button>
                    </div>
                  </div>
                  <dl className="rd-review__list">
                    <div>
                      <dt>{t("ride.when")}</dt>
                      <dd>{when ? `${formatDate(when, lang, { weekday: "long", day: "numeric", month: "long" })} · ${data.when.time}` : t("ride.now")}</dd>
                    </div>
                    <div>
                      <dt>{t("ride.vehicle")}</dt>
                      <dd>
                        {t(`ride.${data.vehicle}`)} · {t("ride.travelers", { pax: data.passengers, bags: data.luggage })}
                      </dd>
                    </div>
                    {(Object.values(data.options).some(Boolean) || data.notes) && (
                      <div>
                        <dt>{t("ride.extras")}</dt>
                        <dd>
                          {[
                            data.options.childSeat && t("ride.childSeat"),
                            data.options.wheelchair && t("ride.wheelchair"),
                            data.options.pet && t("ride.pet"),
                            data.options.stops && `${t("ride.stops")}: ${data.stops || "—"}`,
                            data.notes,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>{t("ride.contact")}</dt>
                      <dd>
                        {data.contact.name} · {data.contact.phone}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("ride.payment")}</dt>
                      <dd>{t(`ride.pay${data.payment === "cash" ? "Cash" : data.payment === "card" ? "Card" : "Etransfer"}`)}</dd>
                    </div>
                  </dl>
                  <div className="rd-price">
                    <span>{estimate ? t("ride.estimate") : t("ride.quote")}</span>
                    {estimate && (
                      <strong>
                        {money(estimate.low, { whole: true })} – {money(estimate.high, { whole: true })}
                      </strong>
                    )}
                    <p>{estimate ? t("ride.estimateNote") : t("ride.quoteNote")}</p>
                  </div>
                  <Checkbox label={t("ride.agree")} checked={data.agree} onChange={(e) => patch({ agree: e.target.checked })} />
                  {touched && errors.review && <span className="field__error">{t("errors.required")}</span>}
                  {error && <Notice tone="error">{error}</Notice>}
                </div>
              </>
            )}
          </div>

          <div className="rd-actions">
            {step > 0 ? (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => go(-1)} disabled={sending}>
                {t("ride.back")}
              </Button>
            ) : (
              <span />
            )}
            {key === "review" ? (
              <Button size="xl" icon={Car} onClick={submit} loading={sending} className="rd-request">
                {sending ? t("ride.requesting") : t("ride.request")}
              </Button>
            ) : (
              <Button size="lg" iconRight={ArrowRight} onClick={() => go(1)}>
                {t("ride.next")}
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SlideHead({ headingRef, icon: Icon, title, text }) {
  return (
    <div className="rd-head">
      <span className="rd-head__icon">
        <Icon size={26} weight="duotone" />
      </span>
      <h1 className="rd-head__title" ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className="rd-head__text">{text}</p>
    </div>
  );
}

function RideTop() {
  const { t } = useI18n();
  return (
    <header className="rd-top">
      <Link to="/" aria-label="Inicio">
        <Logo tone="dark" size="sm" />
      </Link>
      <span className="rd-top__tag">{t("ride.brand")}</span>
      <div className="rd-top__right">
        <LangToggle />
        <Link to="/" className="rd-top__exit">
          <SignOut size={18} weight="bold" /> {t("ride.exit")}
        </Link>
      </div>
    </header>
  );
}

function RideSuccess({ done, onAnother, headingRef }) {
  const { t } = useI18n();
  const settings = useSettings();
  const toast = useToast();
  const wa = settings.contact.whatsapp;
  const msg = `Hola ${CITY.brand}, pedí un ride. Referencia ${done.ref} (${done.payload.pickup.address} → ${done.payload.dropoff.address}).`;
  return (
    <div className="rd">
      <RideTop />
      <div className="rd-success">
        <div className="rd-success__icon">
          <CheckCircle size={64} weight="fill" />
        </div>
        <h1 className="rd-head__title" ref={headingRef} tabIndex={-1}>
          {t("ride.successTitle")}
        </h1>
        <p className="rd-success__text">{t("ride.successText")}</p>
        <button
          className="rd-success__ref"
          onClick={() => {
            navigator.clipboard?.writeText(done.ref).then(() => toast.success(t("common.copied")), () => {});
          }}
        >
          <span>{t("ride.reference")}</span>
          <strong>{done.ref}</strong>
          <Copy size={16} weight="bold" />
        </button>
        <div className="rd-success__route">
          <span>
            <MapPin size={16} weight="fill" /> {done.payload.pickup.address}
          </span>
          <ArrowRight size={16} weight="bold" />
          <span>
            <NavigationArrow size={16} weight="fill" /> {done.payload.dropoff.address}
          </span>
        </div>
        <div className="rd-success__actions">
          {wa && (
            <Button href={`https://wa.me/${phoneDigits(wa)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" icon={WhatsappLogo} className="rd-wa">
              {t("ride.sendWhatsapp")}
            </Button>
          )}
          <Button variant="outline-light" onClick={onAnother}>
            {t("ride.another")}
          </Button>
          <Button variant="ghost" to="/">
            {t("ride.home")}
          </Button>
        </div>
        <ol className="rd-next" aria-label={t("ride.nextTitle")}>
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <strong>{t(`ride.next${n}Title`)}</strong>
              {t(`ride.next${n}Text`)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
