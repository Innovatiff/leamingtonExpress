import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MagnifyingGlass, Pulse } from "@phosphor-icons/react";
import * as backend from "@backend";
import InstallApp from "@/components/InstallApp";
import Button from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/Misc";
import { SITE_NAME } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import { isLive } from "@/lib/dispatch";
import { useSeo } from "@/lib/seo";
import { forgetService, rememberService, useTrackedServices } from "./store";
import TrackingCard from "./TrackingCard";
import { useTracking } from "./useTracking";
import "./tracking.css";

export function InstallClientApp() {
  const { t } = useI18n();
  return (
    <InstallApp
      id="client"
      icon="/icon-192.png"
      strings={{
        title: t("track.install.title", { brand: SITE_NAME }),
        text: t("track.install.text"),
        button: t("track.install.button"),
        iosTitle: t("track.install.iosTitle"),
        iosSteps: t("track.install.iosSteps"),
        later: t("track.install.later"),
        how: t("track.install.how"),
      }}
    />
  );
}

/** One service, followed live. */
function TrackOne({ token }) {
  const { t } = useI18n();
  const { status, view } = useTracking(token);

  // Opening a live link on this device keeps it in "My services"
  useEffect(() => {
    if (view) rememberService({ kind: view.kind, token, ref: view.ref });
  }, [view, token]);

  if (status === "loading") {
    return (
      <div className="trk-loading">
        <Spinner />
      </div>
    );
  }
  if (!view) {
    return (
      <EmptyState icon={MagnifyingGlass} title={t("track.notFound")} text={t("track.notFoundText")}>
        <Button to="/seguimiento" variant="secondary">
          {t("track.all")}
        </Button>
      </EmptyState>
    );
  }
  return <TrackingCard view={view} token={token} />;
}

/** A compact live card in the list (each one keeps itself up to date). */
function TrackItem({ entry, onLive }) {
  const { t } = useI18n();
  const { status, view } = useTracking(entry.token, { waitMs: 8000 });
  const live = isLive(view);
  useEffect(() => {
    if (status !== "loading") onLive(entry.token, status === "ready" ? live : "missing");
  }, [entry.token, live, status, onLive]);
  if (!view) return null;
  return (
    <div className="trk-item">
      <Link to={`/seguimiento/${entry.token}`} aria-label={t("track.open")}>
        <TrackingCard view={view} token={entry.token} compact />
      </Link>
      {!live && (
        <button type="button" className="trk-item__remove" onClick={() => forgetService(entry.token)}>
          {t("track.remove")}
        </button>
      )}
    </div>
  );
}

/** Services saved on this device + the ones in the signed-in customer's account. */
function useAllServices() {
  const local = useTrackedServices();
  const { user } = useAuth();
  const [account, setAccount] = useState([]);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    Promise.all([
      backend.listMine("rides", uid).catch(() => []),
      backend.listMine("bookings", uid).catch(() => []),
      backend.listMine("orders", uid).catch(() => []),
    ]).then(([rides, bookings, orders]) => {
      if (!alive) return;
      setAccount([
        ...rides.filter((r) => r.trackToken).map((r) => ({ kind: "ride", token: r.trackToken, ref: r.ref })),
        ...bookings.filter((b) => b.trackToken).map((b) => ({ kind: "booking", token: b.trackToken, ref: b.ref })),
        ...orders.filter((o) => o.accessToken).map((o) => ({ kind: "order", token: o.accessToken, ref: o.orderNumber })),
      ]);
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  return useMemo(() => {
    const seen = new Set();
    return [...local, ...(uid ? account : [])].filter((e) => !seen.has(e.token) && seen.add(e.token)).slice(0, 20);
  }, [local, account, uid]);
}

function TrackList() {
  const { t } = useI18n();
  const services = useAllServices();
  const [liveMap, setLiveMap] = useState({});
  const onLive = useMemo(() => (token, live) => setLiveMap((m) => (m[token] === live ? m : { ...m, [token]: live })), []);
  // unknown yet → shown with the active ones until its status arrives
  const active = services.filter((s) => liveMap[s.token] !== false && liveMap[s.token] !== "missing");
  const recent = services.filter((s) => liveMap[s.token] === false);

  if (!services.length || services.every((s) => liveMap[s.token] === "missing")) {
    return (
      <>
        <EmptyState icon={Pulse} title={t("track.empty")} text={t("track.emptyText")}>
          <div className="row row--wrap" style={{ justifyContent: "center" }}>
            <Button to="/ride">{t("nav.ride")}</Button>
            <Button to="/tienda" variant="secondary">
              {t("nav.store")}
            </Button>
            <Button to="/viajes" variant="secondary">
              {t("nav.travel")}
            </Button>
          </div>
        </EmptyState>
        <InstallClientApp />
      </>
    );
  }

  // One list, so a service that finishes moves to "Recent" without reloading
  return (
    <>
      <div className="trk-list">
        {active.length > 0 && (
          <h2 key="h-active" className="trk-page__group">
            {t("track.active")}
          </h2>
        )}
        {active.map((s) => (
          <TrackItem key={s.token} entry={s} onLive={onLive} />
        ))}
        {recent.length > 0 && (
          <h2 key="h-recent" className="trk-page__group">
            {t("track.recent")}
          </h2>
        )}
        {recent.map((s) => (
          <TrackItem key={s.token} entry={s} onLive={onLive} />
        ))}
      </div>
      <InstallClientApp />
    </>
  );
}

export default function TrackingPage() {
  const { token } = useParams();
  const { t } = useI18n();
  useSeo({ title: token ? t("track.metaTitle") : t("track.title"), noindex: true });

  return (
    <div className="container trk-page">
      {token ? (
        <Link to="/seguimiento" className="breadcrumbs">
          <ArrowLeft size={14} weight="bold" /> {t("track.all")}
        </Link>
      ) : (
        <header className="trk-page__head">
          <h1>{t("track.title")}</h1>
          <p>{t("track.subtitle")}</p>
        </header>
      )}
      {token ? <TrackOne token={token} /> : <TrackList />}
    </div>
  );
}
