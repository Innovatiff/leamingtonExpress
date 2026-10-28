import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AirplaneTilt, Car, Package } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { useTrackedServices } from "./store";
import { stageText } from "./TrackingCard";
import { useTracking } from "./useTracking";

const ICON = { ride: Car, order: Package, booking: AirplaneTilt };
// Most urgent first: a driver on the way beats an order being prepared
const PRIORITY = { in_progress: 9, arrived: 9, assigned: 8, onTheWay: 8, searching: 7, on_trip: 7, preparing: 6, received: 5, awaitingPayment: 4 };
const HIDE_ON = [/^\/seguimiento/, /^\/tienda\/checkout/, /^\/tienda\/pedido\//, /^\/viajes\/reserva\//];

function Watch({ token, onView }) {
  const { view } = useTracking(token, { waitMs: 5000 });
  useEffect(() => onView(token, view), [token, view, onView]);
  return null;
}

/** "Carlos M. is on the way · See" — floats above the tab bar while a service is live. */
export default function ActiveServiceBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const services = useTrackedServices().slice(0, 5);
  const [views, setViews] = useState({});
  const onView = useCallback((token, view) => setViews((v) => (v[token] === view ? v : { ...v, [token]: view })), []);

  const live = services
    .map((s) => ({ ...s, view: views[s.token] }))
    .filter((s) => s.view && PRIORITY[s.view.stage])
    .sort((a, b) => PRIORITY[b.view.stage] - PRIORITY[a.view.stage]);
  const top = live[0];
  const hidden = HIDE_ON.some((re) => re.test(pathname));
  const Icon = ICON[top?.view.kind] || Package;

  return (
    <>
      {services.map((s) => (
        <Watch key={s.token} token={s.token} onView={onView} />
      ))}
      {top && !hidden && (
        <Link to={`/seguimiento/${top.token}`} className="trk-bar" aria-live="polite">
          <span className={`trk-bar__icon trk-bar__icon--${top.view.kind}`} aria-hidden="true">
            <Icon size={22} weight="fill" />
          </span>
          <span className="trk-bar__body">
            <small>
              {t(`track.bar.${top.view.kind}`)}
              {live.length > 1 ? ` · ${t("track.bar.more", { n: live.length - 1 })}` : ""}
            </small>
            <strong>{stageText(t, top.view).title}</strong>
          </span>
          <span className="trk-bar__cta">{t("track.open")}</span>
        </Link>
      )}
    </>
  );
}
