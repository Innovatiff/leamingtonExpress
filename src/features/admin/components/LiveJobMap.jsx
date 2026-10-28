// The employee on the way, as the customer sees it (rides and deliveries).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLivePosition } from "@/features/tracking/useLivePosition";
import MapBoundary from "@/features/tracking/MapBoundary";
import { distanceKm, etaMinutes } from "@/lib/dispatch";

const LiveMap = lazy(() => import("@/features/tracking/LiveMap"));

/** target = pick-up point or door (null hides it) · coming = still on the way there (shows the ETA) */
export default function LiveJobMap({ token, target, kind = "ride", coming = true }) {
  const pos = useLivePosition(token);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const labels = useMemo(
    () => ({
      driver: kind === "order" ? "Courier" : "Driver",
      target: kind === "order" ? "Delivery address" : "Pick-up point",
      center: "Re-centre",
      fallback: "The map can't be shown in this browser.",
      openMaps: "Open in Google Maps",
    }),
    [kind],
  );

  if (!pos) {
    return <p className="ad-hint">No live location yet. It appears while the employee app is open on the way.</p>;
  }
  const age = Math.max(0, now - pos.at);
  const ago = age < 60000 ? `${Math.max(1, Math.round(age / 1000))}s` : `${Math.round(age / 60000)} min`;
  const km = coming && target ? distanceKm(pos, target) : null;
  return (
    <div className="ad-livemap">
      <MapBoundary
        fallback={
          <p className="ad-hint">
            {labels.fallback}{" "}
            <a href={`https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`} target="_blank" rel="noreferrer" className="ad-link">
              {labels.openMaps}
            </a>
          </p>
        }
      >
        <Suspense fallback={<div className="ad-livemap__loading" />}>
          <LiveMap driver={pos} target={target} kind={kind} targetIcon={kind === "order" ? "home" : "person"} labels={labels} />
        </Suspense>
      </MapBoundary>
      <p className={`ad-hint ${age > 90000 ? "ad-hint--warn" : ""}`}>
        {age > 90000 ? `Last location ${ago} ago` : `Live · updated ${ago} ago`}
        {km != null ? ` · ≈ ${etaMinutes(km)} min away (${km < 10 ? km.toFixed(1) : Math.round(km)} km)` : ""}
      </p>
    </div>
  );
}
