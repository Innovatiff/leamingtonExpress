const moneyFmt = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const moneyFmt0 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/** Parse "$1,299.99", "10.00", 12 → number (0 when invalid). */
export function parseMoney(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** $1,234.56 — CAD for every language. `whole` drops cents when they're zero. */
export function money(value, { whole = false } = {}) {
  const n = parseMoney(value);
  if (whole && Number.isInteger(round2(n))) return moneyFmt0.format(n);
  return moneyFmt.format(n);
}

/** Firestore Timestamp | Date | ISO string | millis → Date (or null). */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && "seconds" in value) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const locale = (lang) => (lang === "en" ? "en-CA" : "es-MX");

export function formatDate(value, lang = "es", opts = { day: "numeric", month: "short", year: "numeric" }) {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat(locale(lang), opts).format(d) : "";
}

export function formatDateTime(value, lang = "es") {
  return formatDate(value, lang, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value, lang = "es") {
  return formatDate(value, lang, { hour: "numeric", minute: "2-digit" });
}

/** "YYYY-MM-DD" (local) for date inputs and departure ids. */
export function isoDay(date) {
  const d = toDate(date);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse "YYYY-MM-DD" as a local date (no timezone shift). */
export function fromIsoDay(day) {
  const [y, m, d] = String(day || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function relativeTime(value, lang = "es") {
  const d = toDate(value);
  if (!d) return "";
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d, lang);
}

/** (226) 555-0123 */
export function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(raw || "").trim();
}

/** tel: / wa.me friendly digits with country code. */
export function phoneDigits(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export function plural(n, one, other) {
  return `${n} ${n === 1 ? one : other}`;
}
