import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AirplaneTilt,
  Car,
  CaretRight,
  CheckCircle,
  ClipboardText,
  Coins,
  GoogleLogo,
  MapPin,
  Package,
  Pulse,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import * as backend from "@backend";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/Misc";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { formatDate, formatDateTime, fromIsoDay, money, toDate } from "@/lib/format";
import { orderItems, orderStage, orderTotal } from "@/lib/orders";
import { useSeo } from "@/lib/seo";
import { InstallClientApp } from "@/features/tracking/TrackingPage";
import { formatPostal, isEmail, isPhone, isPostal, maskPhone, phoneDigits10 } from "@/lib/validators";
import "./account.css";

const TABS = [
  { key: "pedidos", label: "orders", icon: ClipboardText, kind: "orders" },
  { key: "rides", label: "rides", icon: Car, kind: "rides" },
  { key: "viajes", label: "trips", icon: AirplaneTilt, kind: "bookings" },
  { key: "datos", label: "profile", icon: UserCircle },
];

/** Only same-site paths are allowed after signing in (no open redirects). */
const safeNext = (v) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "");

export default function AccountPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  useSeo({ title: t("account.metaTitle"), noindex: true });

  useEffect(() => {
    if (user && next) navigate(next, { replace: true });
  }, [user, next, navigate]);

  if (loading || (user && next)) {
    return (
      <div className="center-block">
        <Spinner />
      </div>
    );
  }
  return user ? <AccountHome /> : <AuthScreen />;
}

/* ------------------------------------------------------------------------ */
/* Sign in / sign up                                                         */
/* ------------------------------------------------------------------------ */
function authMessage(err, t) {
  const code = String(err?.code || "");
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return t("account.errors.wrong");
  if (/email-already-in-use/.test(code)) return t("account.errors.exists");
  if (/weak-password/.test(code)) return t("account.errors.weak");
  if (/popup-closed|cancelled-popup/.test(code)) return t("account.errors.popup");
  if (/too-many-requests/.test(code)) return t("account.errors.tooMany");
  return t("account.errors.generic");
}

function AuthScreen() {
  const { t } = useI18n();
  const { signIn, signUp, signInWithGoogle, sendReset } = useAuth();
  const [mode, setMode] = useState("in");
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const errors = {
    firstName: mode === "up" && f.firstName.trim().length < 2 ? t("errors.required") : "",
    lastName: mode === "up" && f.lastName.trim().length < 1 ? t("errors.required") : "",
    phone: mode === "up" && f.phone && !isPhone(f.phone) ? t("errors.phone") : "",
    email: !isEmail(f.email) ? t("errors.email") : "",
    password: f.password.length < 6 ? t("account.passwordHint") : "",
  };
  const show = (k) => (touched ? errors[k] : "");

  async function run(key, fn) {
    setBusy(key);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      setError(authMessage(err, t));
    } finally {
      setBusy("");
    }
  }

  function submit(e) {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      return;
    }
    if (mode === "in") run("form", () => signIn(f.email.trim(), f.password));
    else
      run("form", () =>
        signUp({ email: f.email.trim(), password: f.password, firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone: phoneDigits10(f.phone) }),
      );
  }

  const benefits = t("account.benefits");

  return (
    <div className="container acc">
      <div className="acc-auth">
        <section className="acc-auth__intro">
          <span className="acc-auth__badge">
            <Coins size={28} weight="duotone" />
          </span>
          <h1 className="acc-auth__title">{mode === "in" ? t("account.signInTitle") : t("account.signUpTitle")}</h1>
          <p>{mode === "in" ? t("account.signInText") : t("account.signUpText")}</p>
          <ul className="acc-auth__benefits">
            {Array.isArray(benefits) &&
              benefits.map((b) => (
                <li key={b}>
                  <CheckCircle size={20} weight="fill" /> {b}
                </li>
              ))}
          </ul>
        </section>

        <section className="acc-card">
          <div className="acc-switch" role="tablist" aria-label={t("account.metaTitle")}>
            {[
              ["in", "account.tabSignIn"],
              ["up", "account.tabSignUp"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                className={mode === key ? "is-active" : ""}
                onClick={() => {
                  setMode(key);
                  setTouched(false);
                  setError("");
                  setInfo("");
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>

          <form className="acc-form" onSubmit={submit} noValidate>
            {mode === "up" && (
              <div className="form-grid">
                <TextField label={t("account.firstName")} value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} error={show("firstName")} autoComplete="given-name" />
                <TextField label={t("account.lastName")} value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} error={show("lastName")} autoComplete="family-name" />
                <TextField
                  className="span-2"
                  label={t("account.phone")}
                  optional={t("common.optional")}
                  inputMode="tel"
                  value={f.phone}
                  onChange={(e) => set({ phone: maskPhone(e.target.value) })}
                  error={show("phone")}
                  autoComplete="tel-national"
                />
              </div>
            )}
            <TextField label={t("account.email")} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} error={show("email")} autoComplete="email" />
            <TextField
              label={t("account.password")}
              type="password"
              value={f.password}
              onChange={(e) => set({ password: e.target.value })}
              error={show("password")}
              hint={mode === "up" ? t("account.passwordHint") : undefined}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
            {error && <Notice tone="error">{error}</Notice>}
            {info && <Notice tone="success">{info}</Notice>}
            <Button type="submit" size="lg" block loading={busy === "form"}>
              {mode === "in" ? t("account.signIn") : t("account.signUp")}
            </Button>
            {mode === "in" && (
              <button
                type="button"
                className="acc-link"
                onClick={() => {
                  if (!isEmail(f.email)) {
                    setError(t("account.resetNeedsEmail"));
                    return;
                  }
                  run("reset", async () => {
                    await sendReset(f.email.trim());
                    setInfo(t("account.resetSent"));
                  });
                }}
              >
                {t("account.forgot")}
              </button>
            )}
          </form>

          <div className="acc-or">
            <span>{t("account.or")}</span>
          </div>
          <Button variant="secondary" size="lg" block icon={GoogleLogo} loading={busy === "google"} onClick={() => run("google", signInWithGoogle)}>
            {t("account.google")}
          </Button>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Signed in                                                                 */
/* ------------------------------------------------------------------------ */
function AccountHome() {
  const { t } = useI18n();
  const { user, info, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((x) => x.key === params.get("seccion")) || TABS[0];

  return (
    <div className="container acc">
      <header className="acc-head">
        <div className="acc-head__who">
          <span className="acc-avatar" aria-hidden="true">
            {(info.firstName || user.email || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <span className="eyebrow">{t("account.memberSince")}</span>
            <h1 className="acc-head__title">{t("account.hello", { name: info.firstName })}</h1>
            <p className="muted">{user.email}</p>
          </div>
        </div>
        <div className="acc-points">
          <Coins size={30} weight="duotone" />
          <div>
            <strong>{info.points.toLocaleString()}</strong>
            <span>{t("account.points")}</span>
          </div>
          <small>{t("account.pointsText")}</small>
        </div>
      </header>

      <div className="acc-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab.key === x.key} className={tab.key === x.key ? "is-active" : ""} onClick={() => setParams({ seccion: x.key }, { replace: true })}>
            <x.icon size={18} weight="bold" /> {t(`account.tabs.${x.label}`)}
          </button>
        ))}
      </div>

      <Link to="/seguimiento" className="acc-live">
        <Pulse size={22} weight="bold" />
        <span>
          <strong>{t("track.title")}</strong>
          <small>{t("track.subtitle")}</small>
        </span>
        <CaretRight size={18} weight="bold" />
      </Link>

      <div className="acc-panel" role="tabpanel">
        {tab.kind ? <History key={tab.kind} kind={tab.kind} uid={user.uid} /> : <ProfileForm />}
      </div>

      <InstallClientApp />

      <div className="acc-foot">
        <Button variant="ghost" icon={SignOut} onClick={signOut}>
          {t("account.signOut")}
        </Button>
      </div>
    </div>
  );
}

const byNewest = (a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);

function History({ kind, uid }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: "loading", list: [] });

  useEffect(() => {
    let alive = true;
    backend
      .listMine(kind, uid)
      .then((list) => alive && setState({ status: "ready", list: [...list].sort(byNewest) }))
      .catch((err) => {
        console.warn("History failed", err);
        if (alive) setState({ status: "error", list: [] });
      });
    return () => {
      alive = false;
    };
  }, [kind, uid]);

  if (state.status === "loading") {
    return (
      <div className="acc-list">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h={76} r={16} />
        ))}
      </div>
    );
  }
  if (state.status === "error") return <Notice tone="error">{t("account.loadError")}</Notice>;
  if (!state.list.length) {
    const empty = {
      orders: [Package, "account.noOrders", "/tienda", "account.shopNow"],
      rides: [Car, "account.noRides", "/ride", "account.rideNow"],
      bookings: [AirplaneTilt, "account.noTrips", "/viajes", "account.tripsNow"],
    }[kind];
    return (
      <EmptyState icon={empty[0]} title={t(empty[1])}>
        <Button to={empty[2]}>{t(empty[3])}</Button>
      </EmptyState>
    );
  }
  return (
    <ul className="acc-list">
      {state.list.map((r) => (
        <li key={r.id}>{kind === "orders" ? <OrderRow o={r} /> : kind === "rides" ? <RideRow r={r} /> : <BookingRow b={r} />}</li>
      ))}
    </ul>
  );
}

function OrderRow({ o }) {
  const { t, lang } = useI18n();
  const stage = orderStage(o);
  const count = orderItems(o).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const thumb = orderItems(o).find((l) => l.image)?.image;
  return (
    <Link to={`/tienda/pedido/${encodeURIComponent(o.id)}`} className="acc-row">
      <span className="acc-row__icon">{thumb ? <img src={thumb} alt="" /> : <Package size={22} weight="duotone" />}</span>
      <span className="acc-row__main">
        <strong>{o.orderNumber || o.id}</strong>
        <span>
          {formatDate(toDate(o.createdAt), lang)} · {t("account.items", { n: count })}
        </span>
      </span>
      <span className={`acc-pill acc-pill--${stage}`}>{t(`order.status.${stage}`)}</span>
      <strong className="acc-row__amount">{money(orderTotal(o))}</strong>
    </Link>
  );
}

function RideRow({ r }) {
  const { t, lang } = useI18n();
  const when = r.schedule?.type === "later" ? formatDateTime(toDate(r.schedule.at) || fromIsoDay(r.schedule.date), lang) : t("account.asap");
  return (
    <div className="acc-row">
      <span className="acc-row__icon">
        <Car size={22} weight="duotone" />
      </span>
      <span className="acc-row__main">
        <strong>
          {r.pickup?.address} → {r.dropoff?.address}
        </strong>
        <span>
          {r.ref} · {when}
        </span>
      </span>
      <span className={`acc-pill acc-pill--ride-${r.status}`}>{t(`account.rideStatus.${r.status}`)}</span>
      {r.fare != null && <strong className="acc-row__amount">{money(r.fare)}</strong>}
    </div>
  );
}

function BookingRow({ b }) {
  const { t, lang } = useI18n();
  const people = (Number(b.adults) || 0) + (Number(b.children) || 0);
  return (
    <Link to={`/viajes/${encodeURIComponent(b.tripId)}`} className="acc-row">
      <span className="acc-row__icon">
        <AirplaneTilt size={22} weight="duotone" />
      </span>
      <span className="acc-row__main">
        <strong>{b.tripTitle}</strong>
        <span>
          {b.ref} · {formatDate(fromIsoDay(b.date), lang, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {t("account.travelers", { n: people })}
        </span>
      </span>
      <span className={`acc-pill acc-pill--trip-${b.status}`}>{t(`account.bookingStatus.${b.status}`)}</span>
      <strong className="acc-row__amount">{money(b.pricing?.total || 0)}</strong>
    </Link>
  );
}

function ProfileForm() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, info, saveProfile } = useAuth();
  const [f, setF] = useState(() => ({
    firstName: info.firstName,
    lastName: info.lastName,
    phone: info.phone ? maskPhone(info.phone) : "",
    street: info.address.street,
    unit: info.address.unit,
    town: info.address.town,
    postalCode: info.address.postalCode,
  }));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const errors = {
    firstName: f.firstName.trim().length < 2 ? t("errors.required") : "",
    phone: f.phone && !isPhone(f.phone) ? t("errors.phone") : "",
    postalCode: f.postalCode && !isPostal(f.postalCode) ? t("errors.postal") : "",
  };
  const show = (k) => (touched ? errors[k] : "");

  async function save(e) {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      return;
    }
    setSaving(true);
    try {
      const firstName = f.firstName.trim();
      const lastName = f.lastName.trim();
      // Same shape the previous site used for users/{uid}
      await saveProfile({
        name: `${firstName} ${lastName}`.trim(),
        userInformation: { firstName, lastName, phoneNumber: phoneDigits10(f.phone), email: user.email },
        address: { homeAddress: f.street.trim(), unit: f.unit.trim(), city: f.town.trim(), postalCode: f.postalCode.trim().toUpperCase() },
      });
      toast.success(t("account.saved"));
    } catch (err) {
      console.error(err);
      toast.error(t("account.errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="acc-profile" onSubmit={save} noValidate>
      <div>
        <h2 className="acc-profile__title">{t("account.profileTitle")}</h2>
        <p className="muted">{t("account.profileText")}</p>
      </div>
      <div className="form-grid">
        <TextField label={t("account.firstName")} value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} error={show("firstName")} autoComplete="given-name" />
        <TextField label={t("account.lastName")} value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="family-name" />
        <TextField label={t("account.phone")} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: maskPhone(e.target.value) })} error={show("phone")} autoComplete="tel-national" />
        <TextField label={t("account.email")} value={user.email} disabled />
      </div>
      <h3 className="acc-profile__sub">
        <MapPin size={18} weight="bold" /> {t("account.address")}
      </h3>
      <div className="form-grid">
        <TextField className="span-2" label={t("account.street")} value={f.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" />
        <TextField label={t("account.unit")} optional={t("common.optional")} value={f.unit} onChange={(e) => set({ unit: e.target.value })} autoComplete="address-line2" />
        <TextField label={t("account.town")} value={f.town} onChange={(e) => set({ town: e.target.value })} autoComplete="address-level2" />
        <TextField label={t("account.postalCode")} value={f.postalCode} onChange={(e) => set({ postalCode: formatPostal(e.target.value) })} error={show("postalCode")} autoComplete="postal-code" />
      </div>
      <div>
        <Button type="submit" loading={saving}>
          {t("account.save")}
        </Button>
      </div>
    </form>
  );
}
