// Bringing the trips saved in Firestore up to date with the built-in catalog
// (Admin → Trips → "Update trips"). Plain functions so tests can use them.
import { CATALOG_VERSION, DEFAULT_TRIPS } from "../data/trips.js";

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

/** A built-in trip as it's saved: with the catalog version it comes from. */
export const builtInTrip = (trip, extra = {}) => ({ ...trip, catalogVersion: CATALOG_VERSION, ...extra });

/**
 * The built-in trips newer than the saved ones, ready to save: they replace
 * the saved copy but keep where it's sold and whether it's on the website.
 * Trips the owner created are never touched.
 */
export function catalogUpdates(saved, city, catalog = DEFAULT_TRIPS) {
  const byId = new Map((saved || []).map((t) => [t.id, t]));
  const out = [];
  for (const trip of catalog) {
    const cur = byId.get(trip.id);
    if (!cur) {
      if (!FIRST_IDS.has(trip.id)) out.push({ trip: builtInTrip(trip, { cities: [city], active: true }), isNew: true });
      continue;
    }
    if ((Number(cur.catalogVersion) || 1) >= CATALOG_VERSION) continue;
    out.push({
      trip: builtInTrip(trip, { cities: Array.isArray(cur.cities) && cur.cities.length ? cur.cities : [city], active: cur.active !== false }),
      isNew: false,
    });
  }
  return out;
}

/** Saved trips that are built-in trips no longer in the catalog (to remove). */
export const retiredTrips = (saved) => (saved || []).filter((t) => RETIRED_IDS.has(t.id));
