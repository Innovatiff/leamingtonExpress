import { IS_DEMO } from "@/config/site";

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD;
const PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;

/** Can the admin upload photos from the computer/phone? (Otherwise paste links.) */
export const canUpload = IS_DEMO || Boolean(CLOUD && PRESET);

/** Shrink a photo in the browser (demo mode keeps images in localStorage). */
function downscale(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Not an image"));
    };
    img.src = url;
  });
}

/**
 * Upload an image and return its public URL.
 * Production: Cloudinary unsigned upload preset (VITE_CLOUDINARY_PRESET).
 */
export async function uploadImage(file, folder = "express/products") {
  if (!file?.type?.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 15 * 1024 * 1024) throw new Error("The image is larger than 15 MB.");
  if (IS_DEMO) return downscale(file);
  if (!CLOUD || !PRESET) throw new Error("Uploads aren't set up yet. Paste an image link instead.");
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", PRESET);
  body.append("folder", folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) throw new Error(json?.error?.message || "Upload failed.");
  return json.secure_url;
}
