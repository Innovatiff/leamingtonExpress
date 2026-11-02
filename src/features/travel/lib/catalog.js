// Bringing the trips saved in Firestore up to date with the built-in catalog
// (Admin → Trips → "Update trips"). Plain functions so tests can use them.
import { ADDED_IN } from "../data/moreTrips.js";
import { CATALOG_NOTES, CATALOG_VERSION, DEFAULT_TRIPS } from "../data/trips.js";

// The trips of the first catalog. A trip the owner deleted isn't added back.
const FIRST_IDS = new Set([
  "niagara-falls-dia",
  "niagara-on-the-lake-vino",
  "toronto-en-un-dia",
  "canadas-wonderland",
  "pelee-island",
  "point-pelee-vinos-essex",
  "frankenmuth-outlets",
  "detroit-motown",
  "grand-bend-playa",
  "mercado-navideno-toronto",
  "niagara-fallsview-fin-de-semana",
  "toronto-fin-de-semana",
  "muskoka-colores-otono",
  "blue-mountain-esqui-spa",
  "tobermory-bruce",
  "ottawa-montreal",
  "quebec-montreal",
  "chicago",
]);

// Built-in trips taken out of the catalog: "Update trips" removes their saved
// copies from the website (no trips to the United States since Oct 2026).
const RETIRED_IDS = new Set(["frankenmuth-outlets", "detroit-motown", "chicago"]);

// Trips changed after catalog version 2 → the version of their last change. Only
// saved copies older than that are offered for replacing, so the owner's edits
// to the other trips stay as they are.
const TRIPS_CHANGED_IN = {
  "mercado-navideno-toronto": 3,
  // 4: winter schedules, Inniskillin at 11:00, CN Tower price, the Hyatt Regency
  "niagara-on-the-lake-vino": 4,
  "toronto-en-un-dia": 4,
  "point-pelee-vinos-essex": 4,
  "toronto-fin-de-semana": 4,
  "niagara-fallsview-fin-de-semana": 4,
};
const savedVersion = (t) => Number(t?.catalogVersion) || 1;
// the version that added a built-in trip (later ones are listed in ADDED_IN)
const addedIn = (id) => (FIRST_IDS.has(id) ? 1 : ADDED_IN[id] || CATALOG_VERSION);
const changedIn = (id) => TRIPS_CHANGED_IN[id] || (FIRST_IDS.has(id) ? 2 : addedIn(id));

const pad = (n) => String(n).padStart(2, "0");
const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** An event trip whose dates have all passed: never offered again. */
export function pastEvent(trip, today = todayIso()) {
  if (!trip?.event) return false;
  const dates = trip.schedule?.dates?.length ? trip.schedule.dates : [trip.event.date].filter(Boolean);
  return dates.length > 0 && dates.every((d) => d < today);
}

/** A built-in trip as it's saved: with the catalog version it comes from. */
export const builtInTrip = (trip, extra = {}) => ({ ...trip, catalogVersion: CATALOG_VERSION, ...extra });

/**
 * The built-in trips newer than the saved ones, ready to save: they replace
 * the saved copy but keep where it's sold and whether it's on the website.
 * Trips the owner created are never touched.
 */
export function catalogUpdates(saved, city, catalog = DEFAULT_TRIPS, today = todayIso()) {
  const byId = new Map((saved || []).map((t) => [t.id, t]));
  // the newest catalog this store has saved: trips added after it are offered once, so
  // a built-in trip the owner deleted doesn't come back
  const level = Math.max(1, ...(saved || []).filter((t) => FIRST_IDS.has(t.id) || ADDED_IN[t.id]).map(savedVersion));
  const out = [];
  for (const trip of catalog) {
    if (pastEvent(trip, today)) continue;
    const cur = byId.get(trip.id);
    if (!cur) {
      if (addedIn(trip.id) > level) out.push({ trip: builtInTrip(trip, { cities: [city], active: true }), isNew: true });
      continue;
    }
    if (savedVersion(cur) >= changedIn(trip.id)) continue;
    out.push({
      trip: builtInTrip(trip, { cities: Array.isArray(cur.cities) && cur.cities.length ? cur.cities : [city], active: cur.active !== false }),
      isNew: false,
      from: savedVersion(cur),
    });
  }
  return out;
}

/** What the pending updates change, oldest first (from CATALOG_NOTES). */
export function updateNotes(updates) {
  const list = updates || [];
  const notes = [];
  for (let v = 2; v <= CATALOG_VERSION; v++) {
    // a version's note only matters if one of these trips was added or changed in it
    const hit = list.some((u) => (u.isNew ? addedIn(u.trip.id) === v : (u.from || 1) < v && changedIn(u.trip.id) >= v));
    if (CATALOG_NOTES[v] && hit) notes.push(CATALOG_NOTES[v]);
  }
  return notes;
}

/** Saved trips that are built-in trips no longer in the catalog (to remove). */
export const retiredTrips = (saved) => (saved || []).filter((t) => RETIRED_IDS.has(t.id));
