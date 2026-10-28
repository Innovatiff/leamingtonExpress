// The services this device asked for (rides, orders, trip bookings), so the
// customer can follow them live without an account. Signed-in customers also
// see the ones saved in their account.
import { useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "@/lib/storage";

const KEY = "lx_tracking";
const MAX = 25;
const listeners = new Set();
let cache = null;

const read = () => {
  if (!cache) cache = readJSON(KEY, []).filter((x) => x && x.token && x.kind);
  return cache;
};

function write(list) {
  cache = list.slice(0, MAX);
  writeJSON(KEY, cache);
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = null;
    listeners.forEach((fn) => fn());
  });
}

/** Remember a service on this device: { kind: "ride"|"order"|"booking", token, ref, title } */
export function rememberService(entry) {
  if (!entry?.token || !entry?.kind) return;
  const list = read();
  const existing = list.find((x) => x.token === entry.token);
  const merged = { ...existing, ...entry, at: existing?.at || Date.now() };
  write([merged, ...list.filter((x) => x.token !== entry.token)]);
}

export function forgetService(token) {
  write(read().filter((x) => x.token !== token));
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useTrackedServices() {
  return useSyncExternalStore(subscribe, read, () => []);
}
