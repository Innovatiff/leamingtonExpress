"use strict";

// Address → map coordinates with OpenStreetMap's geocoder (Nominatim), so the
// customer's live map can show the pick-up point or their door. Best effort:
// a failure only means the map has no pin for that place.

// The towns the service runs from. Searches stay within ~45 km of them, so a
// street name can't land in another part of Canada.
const CITIES = {
  leamington: { name: "Leamington", lat: 42.0531, lng: -82.5995 },
  windsor: { name: "Windsor", lat: 42.3149, lng: -83.0364 },
  london: { name: "London", lat: 42.9849, lng: -81.2453 },
};
const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

/** What to look up for a ride's pick-up or an order's delivery address, most precise first. */
function geoQueries(kind, r) {
  let address = "";
  let town = "";
  if (kind === "ride") {
    address = clean(r.pickup && r.pickup.address);
    town = (CITIES[r.city] || {}).name || "";
  } else if (kind === "order") {
    const ci = r.customerInfo || {};
    address = clean(ci.address);
    town = clean(ci.city) || (CITIES[r.city] || {}).name || "";
  }
  if (address.length < 4) return [];
  const query = (parts) => [...parts, "Ontario", "Canada"].join(", ").slice(0, 250);
  // "25 Erie St S" is in the service's town; "25 Main St, Kingsville" already names its own.
  // Postal codes are left out: many aren't in OpenStreetMap and would make the search miss.
  const named = !town || address.toLowerCase().includes(town.toLowerCase()) || (kind === "ride" && address.includes(","));
  return named ? [query([address])] : [query([address, town]), query([address])];
}

/** → { lat, lng } or null when nothing was found. Throws when the geocoder can't be reached. */
async function geocode(query, { city, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const params = { q: query, format: "jsonv2", limit: "1", countrycodes: "ca" };
  const c = CITIES[city];
  if (c) Object.assign(params, { viewbox: [c.lng - 0.55, c.lat + 0.4, c.lng + 0.55, c.lat - 0.4].map((v) => v.toFixed(4)).join(","), bounded: "1" });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams(params).toString();
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

module.exports = { geoQueries, geocode };
