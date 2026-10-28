// Product photos on other websites (walmartimages.ca, m.media-amazon.com, …) are
// copied to the project's own Firebase Storage by the Cloud Functions, so the
// store only shows Express links. Same rules as functions/lib/photos.js.
// (The site's own Unsplash photos are in photos.js.)

/** Our own photos: the project's Storage bucket and the admin's uploads (Cloudinary). Any other http(s) photo gets copied. */
export function isOwnPhoto(url, bucket) {
  const s = typeof url === "string" ? url.trim() : "";
  if (!/^https?:\/\//i.test(s)) return true; // empty, relative or data: — nothing to copy
  let u;
  try {
    u = new URL(s);
  } catch {
    return true;
  }
  if (u.hostname === "res.cloudinary.com") return true;
  const storage = ["firebasestorage.googleapis.com", "storage.googleapis.com", "127.0.0.1", "localhost"].includes(u.hostname);
  return Boolean(bucket) && storage && (u.pathname.startsWith(`/v0/b/${bucket}/`) || u.pathname.startsWith(`/${bucket}/`));
}

/** The photos of a product that are still on other websites */
export const outsidePhotos = (images, bucket) => (Array.isArray(images) ? images : []).filter((u) => !isOwnPhoto(u, bucket));
