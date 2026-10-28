// While an employee is on the way to a customer (ride or delivery), send their
// phone's position to that customer's live map. Stops on its own when the job
// moves on. Also keeps the screen awake, since phones pause web apps in the
// background.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as team from "@backend/team";
import { distanceKm, shouldShareLocation, trackTokenOf } from "@/lib/dispatch";

const MIN_GAP_MS = 6000; // no more than one update every 6 s…
const MOVED_KM = 0.015; // …and only after moving 15 m,
const MAX_GAP_MS = 25000; // but at least every 25 s, so the customer sees it's live
const RETRY_MS = 5000; // after a failed send

/** → { tokens, status: idle|waiting|on|denied|unavailable|unsupported|error, sentAt, retry } */
export function useShareLocation(jobs) {
  const now = jobs.now;
  const tokens = useMemo(() => {
    const list = [
      ...(jobs.active.rides || []).filter((r) => shouldShareLocation("rides", r, now)).map((r) => trackTokenOf("rides", r)),
      ...(jobs.active.deliveries || []).filter((o) => shouldShareLocation("deliveries", o, now)).map((o) => trackTokenOf("deliveries", o)),
    ];
    return [...new Set(list.filter(Boolean))].sort();
  }, [jobs.active, now]);
  const key = tokens.join(",");
  const [state, setState] = useState({ key: "", status: "waiting", sentAt: 0 });
  const [attempt, setAttempt] = useState(0);
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  // Follow the phone's GPS while there's someone to show it to
  useEffect(() => {
    if (!key || !supported) return undefined;
    const targets = key.split(",");
    let last = null; // last position sent
    let fix = null; // newest position from the GPS
    let tried = 0;
    let failures = 0;
    let sending = false;

    const send = async (p) => {
      if (sending) return;
      sending = true;
      tried = Date.now();
      try {
        await team.sharePosition(targets, p);
        last = { ...p, t: Date.now() };
        failures = 0;
        setState({ key, status: "on", sentAt: last.t });
      } catch (err) {
        // The first try can land a moment before the job shows as accepted
        // everywhere: only complain when it keeps failing
        failures += 1;
        if (failures >= 3) {
          console.warn("Could not share the location", err);
          setState((s) => ({ ...s, key, status: "error" }));
        }
      } finally {
        sending = false;
      }
    };
    const due = (t) => {
      if (!last || failures) return t - tried >= RETRY_MS;
      return (t - last.t >= MIN_GAP_MS && distanceKm(last, fix) >= MOVED_KM) || t - last.t >= MAX_GAP_MS;
    };

    const onPosition = (pos) => {
      const c = pos.coords;
      fix = { lat: c.latitude, lng: c.longitude, heading: c.heading, speed: c.speed, accuracy: c.accuracy };
      if (due(Date.now())) send(fix);
    };
    const onError = (err) => {
      const status = err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "waiting";
      setState((s) => ({ ...s, key, status }));
    };

    const watch = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    // Standing still sends no new GPS readings: repeat the last one so the customer
    // sees it's live, and try again after a failed send
    const beat = setInterval(() => {
      if (fix && due(Date.now())) send(fix);
    }, 5000);
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(beat);
    };
  }, [key, supported, attempt]);

  // A job that no longer needs it (finished, given back) disappears from the customer's map
  const shared = useRef([]);
  useEffect(() => {
    const current = key ? key.split(",") : [];
    const gone = shared.current.filter((t) => !current.includes(t));
    if (gone.length) team.clearPosition(gone).catch(() => {});
    shared.current = current;
  }, [key]);

  // Keep the screen on while sharing (when the phone allows it)
  useEffect(() => {
    if (!key || typeof navigator === "undefined" || !("wakeLock" in navigator)) return undefined;
    let lock = null;
    let alive = true;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else next.release().catch(() => {});
      } catch {
        // low battery mode or not allowed: the app still works
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const status = !key ? "idle" : !supported ? "unsupported" : state.key === key ? state.status : "waiting";
  return { tokens, status, sentAt: state.key === key ? state.sentAt : 0, retry };
}
