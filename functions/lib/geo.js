"use strict";

// Address → map coordinates with OpenStreetMap's geocoder (Nominatim), so the
// customer's live map can show the pick-up point or their door. Best effort:
// a failure only means the map has no pin for that place.

const CITY_NAMES = { leamington: "Leamington", windsor: "Windsor", london: "London" };
const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

/** The text to look up for a ride's pick-up or an order's delivery address ("" = nothing to look up). */
function geoQuery(kind, r) {
  let parts = [];
  if (kind === "ride") {
    parts = [clean(r.pickup && r.pickup.address), CITY_NAMES[r.city] || ""];
  } else if (kind === "order") {
    const ci = r.customerInfo || {};
    parts = [clean(ci.address), clean(ci.city) || CITY_NAMES[r.city] || "", clean(ci.postalCode)];
  }
  const [address, ...rest] = parts;
  if (!address || address.length < 4) return "";
  // don't repeat the town when the address already has it
  const extra = rest.filter((p) => p && !address.toLowerCase().includes(p.toLowerCase()));
  return [address, ...extra, "Ontario", "Canada"].join(", ").slice(0, 250);
}

/** → { lat, lng } or null when nothing was found. Throws when the geocoder can't be reached. */
async function geocode(query, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "ca" }).toString();
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "LeamingtonExpress/1.0 (+https://leamingtonexpress.ca)", "Accept-Language": "en" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Geocoder answered ${res.status}`);
  const hits = await res.json();
  const hit = Array.isArray(hits) ? hits[0] : null;
  const lat = Number(hit && hit.lat);
  const lng = Number(hit && hit.lon);
  return hit && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

module.exports = { geoQuery, geocode };
