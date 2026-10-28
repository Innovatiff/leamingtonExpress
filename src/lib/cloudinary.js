/**
 * Ask Cloudinary for a resized, auto-format (WebP/AVIF) version of an image.
 * Non-Cloudinary URLs are returned untouched.
 *   https://res.cloudinary.com/x/image/upload/v1/a.jpg
 *   → https://res.cloudinary.com/x/image/upload/f_auto,q_auto,c_limit,w_600/v1/a.jpg
 */
export function cdnImage(url, { w = 600, h, fit = "limit" } = {}) {
  if (!url || typeof url !== "string") return "";
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  const [head, tail] = url.split(marker);
  // Already transformed (first path segment contains commas or x_ params)
  const first = tail.split("/")[0];
  if (/(^|,)(w|h|c|f|q)_/.test(first)) return url;
  const parts = ["f_auto", "q_auto", `c_${fit}`, `w_${Math.round(w)}`];
  if (h) parts.push(`h_${Math.round(h)}`);
  return `${head}${marker}${parts.join(",")}/${tail}`;
}

/** srcset for responsive product images. */
export function cdnSrcSet(url, widths = [240, 360, 520, 720]) {
  if (!url || !url.includes("res.cloudinary.com")) return undefined;
  return widths.map((w) => `${cdnImage(url, { w })} ${w}w`).join(", ");
}
