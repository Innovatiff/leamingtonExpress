"use strict";

// Product photos that live on other websites (walmartimages.ca,
// m.media-amazon.com, …) are copied to the project's own Firebase Storage, so
// the store, the order pages and the employees only see Express links. Each
// copy is shrunk to at most 1000 px and saved as WebP without the original
// file's metadata, under a name made from a hash of the link it came from
// (so the same photo is copied once).

const crypto = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { millis } = require("./catalog");

let sharp = null;
try {
  sharp = require("sharp");
  sharp.cache(false);
  sharp.concurrency(1);
} catch {
  sharp = null; // photos are then copied as they are
}

const FOLDER = "products";
const MAX_SIDE = 1000;
const MAX_BYTES = 15 * 1024 * 1024;
const RETRY_AFTER = 6 * 60 * 60 * 1000; // a product whose photos failed is tried again after this
// Some image servers only answer browsers
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

/** Our own photos: the project's Storage bucket and the admin's uploads (Cloudinary). Any other http(s) photo gets copied. */
function isOwnPhoto(url, bucket) {
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
const outsidePhotos = (images, bucket) => (Array.isArray(images) ? images : []).filter((u) => !isOwnPhoto(u, bucket));

/** Does this product have photos to copy now? (Not when they failed lately and nothing changed since.) */
function needsCopy(p, bucket, now = Date.now()) {
  if (!outsidePhotos(p.images, bucket).length) return false;
  const failed = millis(p.photosFailedAt);
  return !failed || failed < millis(p.updatedAt) || failed < now - RETRY_AFTER;
}

/** gone: the photo isn't there or isn't a photo (it's taken off the product). code NO_STORAGE: Storage isn't turned on. */
class PhotoError extends Error {
  constructor(message, { gone = false, code = "" } = {}) {
    super(message);
    this.gone = gone;
    this.code = code;
  }
}

function storageError(err) {
  const msg = String(err?.message || "");
  if (/bucket does not exist|bucket name not specified/i.test(msg)) return new PhotoError("Firebase Storage is not turned on", { code: "NO_STORAGE" });
  return err;
}

const fileName = (url) => `${FOLDER}/${crypto.createHash("sha256").update(url).digest("hex").slice(0, 32)}`;

function publicLink(bucket, name, token) {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = emulator ? `http://${emulator.replace(/^https?:\/\//, "")}` : "https://firebasestorage.googleapis.com";
  return `${base}/v0/b/${bucket.name}/o/${encodeURIComponent(name)}?alt=media&token=${token}`;
}

/** The link of a photo copied before, or "" */
async function earlierCopy(bucket, name) {
  const file = bucket.file(name);
  let meta;
  try {
    [meta] = await file.getMetadata();
  } catch (err) {
    if (err?.code === 404 && !/bucket/i.test(String(err.message))) return "";
    throw storageError(err);
  }
  let token = String(meta?.metadata?.firebaseStorageDownloadTokens || "").split(",")[0];
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  return publicLink(bucket, name, token);
}

/** What kind of picture these bytes are (from their first bytes), or "" */
function sniff(buf) {
  if (!buf || buf.length < 12) return "";
  const ascii = (a, b) => buf.subarray(a, b).toString("latin1");
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 12) === "ftypavif") return "image/avif";
  return "";
}

/** A smaller WebP without metadata; the bytes as they are when they can't be converted but browsers can show them */
async function shrink(input) {
  if (sharp) {
    try {
      const data = await sharp(input, { failOn: "none", limitInputPixels: 50e6 })
        .rotate()
        .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      return { data, contentType: "image/webp" };
    } catch {
      // not a picture sharp can read: kept as it is below when browsers can show it
    }
  }
  const type = sniff(input);
  if (!type) throw new PhotoError("Not a photo", { gone: true });
  return { data: input, contentType: type };
}

/** Copy one photo to the bucket → its Express link. Throws a PhotoError. */
async function copyPhoto(url, bucket, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const name = fileName(url);
  const before = await earlierCopy(bucket, name);
  if (before) return before;
  let res;
  let input;
  try {
    res = await fetchImpl(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404 || res.status === 410) throw new PhotoError(`The photo is gone (${res.status})`, { gone: true });
    if (!res.ok) throw new PhotoError(`The website answered ${res.status}`);
    if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new PhotoError("The photo is too large", { gone: true });
    input = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof PhotoError) throw err;
    throw new PhotoError(`Couldn't download it (${err?.name === "TimeoutError" ? "too slow" : err?.message || "network"})`);
  }
  if (input.length > MAX_BYTES) throw new PhotoError("The photo is too large", { gone: true });
  const { data, contentType } = await shrink(input);
  const token = crypto.randomUUID();
  try {
    await bucket.file(name).save(data, {
      resumable: false,
      metadata: { contentType, cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
    });
  } catch (err) {
    throw storageError(err);
  }
  return publicLink(bucket, name, token);
}

/** Run fn over the items, at most `limit` at a time */
async function eachLimit(items, limit, fn) {
  const queue = [...items];
  const worker = async () => {
    while (queue.length) await fn(queue.shift());
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

/**
 * Copy one product's outside photos and put the Express links in their place →
 * { copied, removed, failed }. Photos that are gone are taken off the product;
 * the ones that failed stay as they are for a later try (photosFailedAt).
 */
async function copyProductPhotos(ref, bucket, { logger, ...opts } = {}) {
  const result = { copied: 0, removed: 0, failed: 0 };
  const snap = await ref.get();
  const outside = [...new Set(outsidePhotos(snap.get("images"), bucket.name))];
  if (!snap.exists || !outside.length) return result;
  const done = new Map(); // outside link → Express link ("" = taken off)
  let stop = null;
  await eachLimit(outside, 3, async (url) => {
    if (stop) return;
    try {
      done.set(url, await copyPhoto(url, bucket, opts));
      result.copied += 1;
    } catch (err) {
      if (err.code === "NO_STORAGE") {
        stop = err;
        return;
      }
      if (err.gone) {
        done.set(url, "");
        result.removed += 1;
      } else {
        result.failed += 1;
      }
      logger?.warn?.("Product photo not copied", { product: ref.id, reason: err.message });
    }
  });
  if (stop) throw stop;
  // in a transaction, so photos changed in the meantime (in the admin) aren't undone
  await ref.firestore.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) return;
    const images = Array.isArray(cur.get("images")) ? cur.get("images") : [];
    const next = [...new Set(images.map((u) => (done.has(u) ? done.get(u) : u)).filter(Boolean))];
    const patch = { photosFailedAt: result.failed ? FieldValue.serverTimestamp() : FieldValue.delete() };
    if (next.length !== images.length || next.some((u, i) => u !== images[i])) Object.assign(patch, { images: next, updatedAt: FieldValue.serverTimestamp() });
    if (patch.images || result.failed || cur.get("photosFailedAt") !== undefined) tx.update(ref, patch);
  });
  return result;
}

module.exports = { isOwnPhoto, outsidePhotos, needsCopy, copyPhoto, copyProductPhotos, sniff, PhotoError, RETRY_AFTER };
