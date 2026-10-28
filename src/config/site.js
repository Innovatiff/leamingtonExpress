import { CITIES } from "./cities";

export const IS_DEMO = import.meta.env.VITE_DEMO === "true";

const PREVIEW_HOSTS = ["localhost", "127.0.0.1"];
const isPreviewHost = (host) =>
  PREVIEW_HOSTS.includes(host) || host.endsWith(".netlify.app") || host.endsWith(".local");

/**
 * Which city is this site serving?
 * 1. VITE_CITY at build time (set per Netlify site)
 * 2. The domain (windsorexpress.ca → windsor)
 * 3. On localhost / Netlify previews: ?city=windsor (remembered for the tab)
 * 4. Leamington
 */
function resolveCityId() {
  const forced = import.meta.env.VITE_CITY;
  if (forced && CITIES[forced]) return forced;
  if (typeof window === "undefined") return "leamington";

  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  const byDomain = Object.values(CITIES).find((c) => c.domains.includes(host));
  if (byDomain) return byDomain.id;

  if (isPreviewHost(host)) {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get("city");
      if (fromQuery && CITIES[fromQuery]) sessionStorage.setItem("lx_city", fromQuery);
      const stored = sessionStorage.getItem("lx_city");
      if (stored && CITIES[stored]) return stored;
    } catch {
      /* storage blocked */
    }
  }
  return "leamington";
}

export const CITY = CITIES[resolveCityId()];
export const SITE_URL = CITY.siteUrl.replace(/\/$/, "");
export const SITE_NAME = CITY.brand;
export const OTHER_CITIES = Object.values(CITIES).filter((c) => c.id !== CITY.id);
