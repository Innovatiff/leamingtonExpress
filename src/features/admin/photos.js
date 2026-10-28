// Photos on other websites (walmartimages.ca, m.media-amazon.com, …) are copied to
// Express's own storage, so customers never see where a product comes from. The
// Cloud Functions also do it by themselves every few minutes; this does it now.
import * as admin from "@backend/admin";
import { firebaseConfig } from "@/config/firebase";
import { IS_DEMO } from "@/config/site";
import { outsidePhotos } from "@/lib/productPhotos";

const PER_CALL = 3; // products per call
const PARALLEL = 2; // calls at a time

/** Does this product still show photos from other websites? (Never in the demo, which has no storage.) */
export const hasOutsidePhotos = (images) => !IS_DEMO && outsidePhotos(images, firebaseConfig.storageBucket).length > 0;

/** Copy these products' photos now → { copied, removed, failed }. Throws when Storage isn't turned on. */
export async function copyPhotos(ids, onProgress) {
  const total = { copied: 0, removed: 0, failed: 0 };
  if (IS_DEMO || !ids.length) return total;
  const chunks = [];
  for (let i = 0; i < ids.length; i += PER_CALL) chunks.push(ids.slice(i, i + PER_CALL));
  let done = 0;
  let problem = null;
  const worker = async () => {
    while (chunks.length && !problem) {
      const chunk = chunks.shift();
      try {
        const { items } = await admin.copyPhotos(chunk);
        for (const r of items) for (const k of Object.keys(total)) total[k] += r[k] || 0;
      } catch (err) {
        problem = err;
        return;
      }
      done += chunk.length;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  if (problem) throw problem;
  return total;
}

/** What went wrong, in words the admin can act on */
export function photoProblem(err) {
  if (err?.details?.reason === "NO_STORAGE") return "Turn on Firebase Storage first (Firebase console → Storage → Get started), then try again.";
  return "Couldn't copy the photos right now. They're copied by themselves within a few minutes.";
}
