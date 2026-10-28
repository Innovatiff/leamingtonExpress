/** Lowercase, strip accents and collapse whitespace — for search & matching. */
export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s".-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value) {
  return normalize(value)
    .replace(/["".]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function titleCase(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

export function cleanStr(value) {
  return String(value ?? "").trim();
}

/** "Juan Pérez" → "Juan" */
export function firstName(fullName) {
  return cleanStr(fullName).split(/\s+/)[0] || "";
}

export function initials(name) {
  return cleanStr(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase();
}

/** Classic Levenshtein distance (small strings only — used for "did you mean"). */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
