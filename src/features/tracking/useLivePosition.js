import { useEffect, useState } from "react";
import * as backend from "@backend";
import { toDate } from "@/lib/format";

/** The employee's position on this service while they're on the way (null until they share one). */
export function useLivePosition(token) {
  const [state, setState] = useState({ token: null, pos: null });

  useEffect(() => {
    if (!token || !backend.subscribeLivePosition) return undefined;
    return backend.subscribeLivePosition(
      token,
      (p) => {
        const lat = Number(p?.lat);
        const lng = Number(p?.lng);
        const ok = p && Number.isFinite(lat) && Number.isFinite(lng);
        setState({ token, pos: ok ? { lat, lng, heading: Number.isFinite(p.heading) ? p.heading : null, at: toDate(p.at)?.getTime() || Date.now() } : null });
      },
      (err) => {
        console.warn("Live position unavailable", err);
        setState({ token, pos: null });
      },
    );
  }, [token]);

  return state.token === token ? state.pos : null;
}
