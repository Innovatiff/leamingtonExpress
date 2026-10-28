export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());

export function phoneDigits10(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

/** North-American number (10 digits, optional leading 1). */
export const isPhone = (v) => phoneDigits10(v).length === 10;

/** As-you-type phone mask: (226) 555-0123 */
export function maskPhone(v) {
  const d = phoneDigits10(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Canadian postal code "N8H 3X9" */
export function formatPostal(v) {
  const s = String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return s.length > 3 ? `${s.slice(0, 3)} ${s.slice(3)}` : s;
}

export const isPostal = (v) => /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(String(v || "").trim());

export const isFilled = (v) => String(v ?? "").trim().length > 0;
