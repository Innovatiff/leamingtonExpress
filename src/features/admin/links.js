// Product links from Walmart and Amazon: which store, which item, and one key per product
// however the link is written. No imports, so tests and the extension's list can use them.

/** walmart.ca / amazon.ca link → { supplier, itemId } */
export function supplierFromLink(link) {
  const url = String(link || "");
  const walmart = url.match(/walmart\.(?:ca|com)\/(?:[a-z]{2}\/)?ip\/(?:[^/?#]+\/)?([A-Za-z0-9]+)/i);
  if (walmart) return { supplier: "walmart", itemId: walmart[1].toUpperCase() };
  const amazon = url.match(/amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (amazon) return { supplier: "amazon", itemId: amazon[1].toUpperCase() };
  if (/walmart\./i.test(url)) return { supplier: "walmart", itemId: "" };
  if (/amazon\.|amzn\./i.test(url)) return { supplier: "amazon", itemId: "" };
  return { supplier: "", itemId: "" };
}

/** The same link written differently (tracking parameters, http, trailing /) → one key. */
export const linkKey = (link) => {
  const s = String(link || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
};
