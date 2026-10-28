// Tiny in-browser "database" for demo mode (persisted to localStorage).
import { readJSON, writeJSON } from "@/lib/storage";
import { DEMO_PRODUCTS } from "./products";
import { seedAdminData } from "./seedAdmin";

const KEY = "lx_demo_db_v5";
const listeners = new Map(); // collection → Set<fn>

const seed = () => ({
  products: DEMO_PRODUCTS,
  productsPrivate: [],
  ...seedAdminData(DEMO_PRODUCTS),
  trips: [],
  discounts: [
    { id: "demo-code-1", Code: "BIENVENIDO10", Discount: "10.00", Reusable: true, Owner: "Demo", Origin: "Leamington Express" },
  ],
  settings: [
    {
      id: "leamington",
      contact: { phone: "2265550100", whatsapp: "2265550100", email: "hola@example.com" },
      store: { payments: { cash: true, etransfer: true, card: true }, etransferEmail: "pagos@example.com" },
    },
  ],
  users: [],
});

let state = readJSON(KEY, null) || seed();

const persist = () => writeJSON(KEY, state);

export const nowTs = () => new Date().toISOString();

export function all(name) {
  return state[name] || [];
}

export function get(name, id) {
  return all(name).find((d) => d.id === id) || null;
}

export function put(name, record) {
  const list = all(name).filter((d) => d.id !== record.id);
  state = { ...state, [name]: [...list, record] };
  persist();
  emit(name);
  return record;
}

export function patch(name, id, changes) {
  const current = get(name, id);
  if (!current) throw new Error(`${name}/${id} not found`);
  return put(name, { ...current, ...changes, updatedAt: nowTs() });
}

export function remove(name, id) {
  state = { ...state, [name]: all(name).filter((d) => d.id !== id) };
  persist();
  emit(name);
}

export function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  queueMicrotask(() => fn(all(name)));
  return () => listeners.get(name)?.delete(fn);
}

function emit(name) {
  listeners.get(name)?.forEach((fn) => fn(all(name)));
}

export function resetDemo() {
  state = seed();
  persist();
  listeners.forEach((_, name) => emit(name));
}

export const delay = (ms = 450) => new Promise((r) => setTimeout(r, ms));

export function newId() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
}
