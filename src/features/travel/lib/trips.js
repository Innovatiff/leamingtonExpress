import { useEffect, useState } from "react";
import * as backend from "@backend";
import { CITY } from "@/config/site";
import { round2 } from "@/lib/format";
import { DEFAULT_TRIPS } from "../data/trips";
import { upcomingDepartures } from "./schedule.js";

export { upcomingDepartures };

/** Fill defaults so trips edited in the admin never break the page. */
export function normalizeTrip(raw) {
  const t = { ...raw };
  t.id = String(t.id || "");
  t.type = ["day", "weekend", "multi"].includes(t.type) ? t.type : "day";
  t.categories = Array.isArray(t.categories) ? t.categories : [];
  t.durationDays = Math.max(1, Number(t.durationDays) || 1);
  t.nights = Math.max(0, Number(t.nights) || 0);
  t.priceAdult = Number(t.priceAdult) || 0;
  t.priceChild = t.priceChild == null || t.priceChild === "" ? null : Number(t.priceChild);
  t.singleSupplement = Number(t.singleSupplement) || 0;
  t.groupSize = Number(t.groupSize) || 14;
  t.schedule = t.schedule || { weekdays: [6], months: [] };
  t.departure = t.departure || { time: "", returnTime: "" };
  for (const key of ["highlights", "includes", "excludes", "itinerary", "hotels", "meals", "breakdown", "sights", "goodToKnow"]) {
    if (!Array.isArray(t[key])) t[key] = [];
  }
  t.distanceKm = Math.max(0, Math.round(Number(t.distanceKm ?? t.ops?.distanceKm) || 0)); // one way from Leamington
  t.driveTime = typeof t.driveTime === "string" ? t.driveTime.trim() : ""; // "3 h 45 min"
  t.activity = ["easy", "moderate", "active"].includes(t.activity) ? t.activity : "";
  t.offerPct = t.offer && Number(t.offer.pct) > 0 ? Math.min(90, Number(t.offer.pct)) : 0;
  t.fromPrice = Math.round(t.priceAdult * (1 - t.offerPct / 100));
  t.active = t.active !== false;
  t.order = Number(t.order) || 99;
  return t;
}

export const nextDeparture = (trip) => upcomingDepartures(trip, { count: 1 })[0] || null;

export const currentYear = () => new Date().getFullYear();

/** "06:00" → "6:00 a.m." in the visitor's language. */
export function formatClock(hhmm, lang = "es") {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-CA" : "es-MX", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m || 0));
}

/** Price after the trip's offer, rounded like the catalog price. */
export const offerPrice = (trip, amount) => Math.round(Number(amount || 0) * (1 - (trip.offerPct || 0) / 100));

/**
 * Booking price. Offer and group discounts don't stack — the best one applies.
 * A single adult on a hotel trip pays the single-room supplement.
 */
export function computeBooking(trip, { adults = 1, children = 0, singleRoom = false }, travelSettings = {}) {
  const childUnit = trip.priceChild ?? trip.priceAdult;
  const people = adults + children;
  const base = round2(adults * trip.priceAdult + children * childUnit);
  const needsSingle = trip.nights > 0 && trip.singleSupplement > 0 && (singleRoom || (adults === 1 && children === 0));
  const supplement = needsSingle ? trip.singleSupplement : 0;

  const group = travelSettings.groupDiscount || {};
  const groupPct = group.min > 0 && group.pct > 0 && people >= group.min ? Number(group.pct) : 0;
  const pct = Math.max(trip.offerPct || 0, groupPct);
  const discount = Math.round((base * pct) / 100);
  const total = round2(base - discount + supplement);
  const depositPct = Number(travelSettings.depositPct) || 0;
  const deposit = depositPct > 0 ? Math.ceil((total * depositPct) / 100) : total;

  return {
    adults,
    children,
    people,
    adultUnit: trip.priceAdult,
    childUnit,
    base,
    discountPct: pct,
    discountKind: pct === 0 ? null : pct === trip.offerPct ? "offer" : "group",
    discount,
    supplement,
    total,
    deposit,
    depositPct,
  };
}

/* ------------------------------ data hook ------------------------------- */
let cache = null;
let inflight = null;

function load() {
  if (!inflight) {
    inflight = backend
      .listTrips(CITY.id)
      .then((remote) => (Array.isArray(remote) && remote.length ? { list: remote, source: "firestore" } : { list: DEFAULT_TRIPS, source: "default" }))
      .catch(() => ({ list: DEFAULT_TRIPS, source: "default" }))
      .then(({ list, source }) => {
        cache = {
          status: "ready",
          source,
          trips: list
            .map(normalizeTrip)
            .filter((t) => t.active)
            .sort((a, b) => a.order - b.order || a.priceAdult - b.priceAdult),
        };
        return cache;
      });
  }
  return inflight;
}

export function useTrips() {
  const [state, setState] = useState(cache || { status: "loading", trips: [], source: null });
  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    load().then((c) => alive && setState(c));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Clear the cache after admin edits. */
export function invalidateTrips() {
  cache = null;
  inflight = null;
}
