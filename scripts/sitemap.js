// Writes public/sitemap.xml for search engines.
//   npm run sitemap                      → https://leamingtonexpress.ca
//   SITE_URL=https://windsorexpress.ca npm run sitemap
// Product pages come from Firestore and are discovered through the store's links.
import { writeFileSync } from "node:fs";
import { DEFAULT_TRIPS } from "../src/features/travel/data/trips.js";

const site = (process.env.SITE_URL || "https://leamingtonexpress.ca").replace(/\/$/, "");
const today = new Date().toISOString().slice(0, 10);

const pages = [
  ["/", "daily", "1.0"],
  ["/tienda", "daily", "0.9"],
  ["/tienda/productos", "daily", "0.8"],
  ["/ride", "monthly", "0.8"],
  ["/viajes", "weekly", "0.9"],
  ...DEFAULT_TRIPS.filter((t) => t.active !== false).map((t) => [`/viajes/${t.id}`, "weekly", "0.7"]),
  ["/ayuda", "monthly", "0.5"],
  ["/contacto", "yearly", "0.5"],
  ["/privacidad", "yearly", "0.2"],
  ["/terminos", "yearly", "0.2"],
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([path, freq, priority]) => `  <url><loc>${site}${path}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`).join("\n")}
</urlset>
`;

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`sitemap.xml: ${pages.length} pages for ${site}`);
