import { cdnImage } from "./cloudinary.js";

/**
 * Photos from Unsplash — free to use, also commercially (https://unsplash.com/license).
 * They're served by Unsplash's image CDN, which resizes them and sends WebP/AVIF
 * to browsers that support it, so phones only download what they need.
 */
const UNSPLASH = "https://images.unsplash.com/";

export const isUnsplash = (url) => typeof url === "string" && url.startsWith(UNSPLASH);

/** Full-size link for an Unsplash photo id ("1463695970743-ae65cca05743"). */
export const unsplash = (id) => `${UNSPLASH}photo-${id}?auto=format&fit=crop&w=1600&q=70`;

/** Resized version of a photo link (Unsplash or Cloudinary; other links are returned as they are). */
export function photoUrl(url, w, h) {
  if (!url || typeof url !== "string") return "";
  if (isUnsplash(url)) {
    const u = new URL(url);
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    u.searchParams.set("w", String(Math.round(w)));
    if (h) u.searchParams.set("h", String(Math.round(h)));
    else u.searchParams.delete("h");
    if (!u.searchParams.has("q")) u.searchParams.set("q", "70");
    return u.toString();
  }
  return cdnImage(url, { w, h, fit: h ? "fill" : "limit" });
}

/** srcset for links we can resize; undefined for any other link. */
export function photoSrcSet(url, widths = [320, 480, 800, 1200, 1600], ratio) {
  if (!url || typeof url !== "string") return undefined;
  if (!isUnsplash(url) && !url.includes("res.cloudinary.com")) return undefined;
  return widths.map((w) => `${photoUrl(url, w, ratio ? w / ratio : undefined)} ${w}w`).join(", ");
}

/** Photos used around the site (trip photos live with each trip in features/travel/data/trips.js). */
export const PHOTOS = {
  niagara: { src: unsplash("1489447068241-b3490214e879"), by: "Sergey Pesterev" },
  niagaraBoat: { src: unsplash("1509074042217-fd3b279c38b2"), by: "Darran Shen" },
  quebecDusk: { src: unsplash("1766277232470-fbb06553dc84"), by: "Mario Rojas Amayo" },
  minivan: { src: unsplash("1646314672985-fb7d73cb7ad1"), by: "CAMCAT - Christopher Michael" },
  van: { src: unsplash("1724479839764-65981526641d"), by: "Janosch Jost" },
  driver: { src: unsplash("1600320254374-ce2d293c324e"), by: "Paul Hanaoka" },
};
