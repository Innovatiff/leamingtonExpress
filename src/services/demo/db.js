// Tiny in-browser "database" for demo mode (persisted to localStorage).
import { PHOTOS, unsplash } from "@/lib/photos";
import { readJSON, writeJSON } from "@/lib/storage";
import { DEMO_PRODUCTS } from "./products";
import { seedAdminData } from "./seedAdmin";

const KEY = "lx_demo_db_v8";
const listeners = new Map(); // collection → Set<fn>

// Sample ads (Admin → Ads) so the demo shows what local businesses and sponsors look like
const DEMO_ADS = [
  {
    id: "demo-ad-tacos",
    kind: "side",
    name: "Taquería de ejemplo",
    title: "Martes de tacos 2×1",
    text: "Tacos al pastor, birria y aguas frescas hechas en casa.",
    note: "Talbot St, Leamington",
    cta: "Ver menú",
    url: "https://example.com",
    image: unsplash("1599974579688-8dbdd335c77f"),
    theme: "dark",
  },
  {
    id: "demo-ad-bakery",
    kind: "side",
    name: "Panadería de ejemplo",
    title: "Pan dulce recién horneado",
    text: "Conchas, bolillos y pasteles por encargo para tus fiestas.",
    note: "Erie St S, Leamington",
    cta: "Hacer un pedido",
    url: "https://example.com",
    image: unsplash("1509440159596-0249088772ff"),
    theme: "gold",
  },
  {
    id: "demo-ad-coffee",
    kind: "side",
    name: "Café de ejemplo",
    title: "Café y desayunos",
    text: "Abrimos a las 7 a.m. de lunes a sábado.",
    cta: "Cómo llegar",
    url: "https://example.com",
    image: unsplash("1495474472287-4d71bcdd2085"),
    theme: "light",
  },
  {
    id: "demo-ad-samsung",
    kind: "banner",
    name: "Samsung",
    title: "Semana Samsung en Express",
    text: "Televisores y celulares Samsung con entrega en 2 horas en Leamington.",
    note: "*Hasta agotar existencias.",
    cta: "Comprar ahora",
    productId: "demo-003",
    theme: "blue",
    pages: ["shop"],
  },
  {
    id: "demo-ad-niagara",
    kind: "banner",
    name: "Express Viajes",
    title: "Niagara Falls este fin de semana",
    text: "Transporte, hotel y crucero hasta las cataratas, saliendo de Leamington.",
    cta: "Ver el viaje",
    url: "/viajes/niagara-fallsview-fin-de-semana",
    image: PHOTOS.niagaraBoat.src,
    theme: "gold",
  },
];

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
      ads: DEMO_ADS,
    },
  ],
  users: [],
});

let state = readJSON(KEY, null) || seed();

const persist = () => writeJSON(KEY, state);

// Another tab (e.g. the employee app next to the store) changed the data →
// reload it here so both screens stay in sync, like the real database.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = readJSON(KEY, null) || seed();
    listeners.forEach((_, name) => emit(name));
  });
}

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

/** Many records at once (one save, one update for the screens). */
export function putMany(name, records) {
  const byId = new Map(all(name).map((d) => [d.id, d]));
  records.forEach((r) => byId.set(r.id, r));
  state = { ...state, [name]: [...byId.values()] };
  persist();
  emit(name);
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
