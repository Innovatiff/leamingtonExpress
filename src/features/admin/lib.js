import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as admin from "@backend/admin";
import { toDate } from "@/lib/format";
import { normalize } from "@/lib/text";

/* ------------------------------------------------------------------------ */
/* Live collections shared by every admin page                               */
/* ------------------------------------------------------------------------ */
// One Firestore listener per collection for the whole admin session, so
// switching pages is instant and nothing is downloaded twice.
const LOADING = { status: "loading", data: [], error: null };
const stores = new Map();

function storeFor(name) {
  if (!stores.has(name)) stores.set(name, { snapshot: LOADING, listeners: new Set(), unsub: null });
  return stores.get(name);
}

function emit(store, snapshot) {
  store.snapshot = snapshot;
  store.listeners.forEach((fn) => fn());
}

export function useCollection(name) {
  const subscribe = useCallback(
    (onChange) => {
      const store = storeFor(name);
      store.listeners.add(onChange);
      if (!store.unsub) {
        store.unsub = admin.subscribeCollection(
          name,
          (data) => emit(store, { status: "ready", data, error: null }),
          (error) => {
            console.error(`[admin] ${name}`, error);
            emit(store, { status: "error", data: store.snapshot.data, error });
          },
        );
      }
      return () => store.listeners.delete(onChange);
    },
    [name],
  );
  return useSyncExternalStore(subscribe, () => stores.get(name)?.snapshot ?? LOADING);
}

/** Stop every listener (on sign-out, before permissions disappear). */
export function closeCollections() {
  stores.forEach((store) => store.unsub?.());
  stores.clear();
}

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */
/** When a record was created — new docs have createdAt, legacy orders only a `date` string. */
export function recordDate(r) {
  return toDate(r?.createdAt) || toDate(r?.timestamp) || toDate(r?.date) || null;
}

export const cityOf = (r) => r?.city || "leamington";

const dtf = (opts) => new Intl.DateTimeFormat("en-CA", opts);
const fmtDay = dtf({ month: "short", day: "numeric" });
const fmtDayYear = dtf({ month: "short", day: "numeric", year: "numeric" });
const fmtTime = dtf({ hour: "numeric", minute: "2-digit" });
const fmtWeekday = dtf({ weekday: "short", month: "short", day: "numeric" });

export function shortDate(d) {
  if (!d) return "—";
  return d.getFullYear() === new Date().getFullYear() ? fmtDay.format(d) : fmtDayYear.format(d);
}

export const dateTime = (d) => (d ? `${shortDate(d)}, ${fmtTime.format(d)}` : "—");
export const weekdayDate = (d) => (d ? fmtWeekday.format(d) : "—");
export const clock = (d) => (d ? fmtTime.format(d) : "");

export function timeAgo(d) {
  if (!d) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : shortDate(d);
}

/** "2026-11-14" → Date (local). */
export function dayToDate(day) {
  const [y, m, d] = String(day || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

export function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
}

// No earlier data → no percentage (a "+100%" from zero would mislead)
export const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : NaN);

export const digits = (v) => String(v || "").replace(/\D/g, "");

export function phonePretty(v) {
  const d = digits(v).slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(v || "");
}

export const telHref = (v) => `tel:+1${digits(v).slice(-10)}`;
export const waHref = (v, text = "") => `https://wa.me/1${digits(v).slice(-10)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const mapsHref = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const directionsHref = (from, to) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;

/** Accent- and case-insensitive search ("lopez" finds "López"); digits match phone numbers. */
export function matches(query, ...fields) {
  const q = normalize(query);
  if (!q) return true;
  const qDigits = digits(query);
  return fields.some((f) => {
    const s = String(f ?? "");
    return normalize(s).includes(q) || (qDigits.length >= 3 && digits(s).includes(qDigits));
  });
}

/* ------------------------------------------------------------------------ */
/* CSV export                                                                */
/* ------------------------------------------------------------------------ */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(","), ...rows.map((row) => columns.map((c) => esc(c.value(row))).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);

const currentTime = () => Date.now();

/** A clock for time-based numbers (refreshes every minute). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(currentTime);
  useEffect(() => {
    const id = setInterval(() => setNow(currentTime()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ------------------------------ Order helpers ----------------------------- */
export const isCancelledOrder = (o) => o?.status === "Cancelled" || o?.payment === "Expired";
export const orderNumber = (o) => o?.orderNumber || `#${String(o?.id || "").slice(0, 6).toUpperCase()}`;
export const customerName = (o) => o?.customerInfo?.fullName || o?.customer || [o?.customerInfo?.firstName, o?.customerInfo?.lastName].filter(Boolean).join(" ") || "—";
