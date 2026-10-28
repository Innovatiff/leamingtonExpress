// Sample catalog for demo mode only (never used in production builds).
// Same document shape as the real `express_products` collection.

const svg = (body, bg = ["#f3f6fc", "#e3e9f6"]) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset=".55" stop-color="#2f56d6"/><stop offset="1" stop-color="#7aa6ff"/></linearGradient></defs><rect width="600" height="600" fill="url(#b)"/><ellipse cx="300" cy="520" rx="200" ry="22" fill="#0b1530" opacity=".08"/>${body}</svg>`,
  );

const ART = {
  tv: (c) => `<rect x="70" y="140" width="460" height="280" rx="14" fill="${c}"/><rect x="84" y="154" width="432" height="252" rx="6" fill="url(#s)"/><path d="M84 154h220L164 406H84z" fill="#fff" opacity=".08"/><path d="M190 420l-30 80M410 420l30 80" stroke="${c}" stroke-width="14" stroke-linecap="round"/>`,
  phone: (c) => `<rect x="195" y="80" width="210" height="430" rx="38" fill="${c}"/><rect x="207" y="92" width="186" height="406" rx="28" fill="url(#s)"/><rect x="270" y="104" width="60" height="16" rx="8" fill="${c}"/><circle cx="300" cy="300" r="46" fill="#fff" opacity=".12"/>`,
  headphones: (c) => `<path d="M170 330c0-90 58-170 130-170s130 80 130 170" fill="none" stroke="${c}" stroke-width="30" stroke-linecap="round"/><rect x="138" y="300" width="74" height="140" rx="34" fill="${c}"/><rect x="388" y="300" width="74" height="140" rx="34" fill="${c}"/><rect x="152" y="318" width="20" height="104" rx="10" fill="#fff" opacity=".18"/>`,
  earbuds: (c) => `<rect x="160" y="300" width="280" height="170" rx="80" fill="${c}"/><path d="M160 360h280" stroke="#000" stroke-opacity=".12" stroke-width="4"/><circle cx="240" cy="210" r="44" fill="${c}"/><rect x="226" y="230" width="26" height="80" rx="13" fill="${c}"/><circle cx="360" cy="210" r="44" fill="${c}"/><rect x="348" y="230" width="26" height="80" rx="13" fill="${c}"/><circle cx="300" cy="404" r="8" fill="#fff" opacity=".6"/>`,
  speaker: (c) => `<rect x="190" y="110" width="220" height="390" rx="110" fill="${c}"/><g fill="#000" opacity=".16">${Array.from({ length: 9 }, (_, r) => Array.from({ length: 6 }, (_, k) => `<circle cx="${232 + k * 27}" cy="${178 + r * 30}" r="5"/>`).join("")).join("")}</g><circle cx="300" cy="450" r="10" fill="#fff" opacity=".5"/>`,
  tablet: (c) => `<rect x="150" y="90" width="300" height="420" rx="28" fill="${c}"/><rect x="164" y="104" width="272" height="392" rx="16" fill="url(#s)"/><circle cx="300" cy="300" r="70" fill="#fff" opacity=".1"/>`,
  laptop: (c) => `<rect x="140" y="140" width="320" height="220" rx="14" fill="${c}"/><rect x="154" y="154" width="292" height="192" rx="6" fill="url(#s)"/><path d="M90 380h420l-26 56H116z" fill="${c}"/><rect x="250" y="384" width="100" height="10" rx="5" fill="#000" opacity=".15"/>`,
  watch: (c) => `<rect x="250" y="70" width="100" height="460" rx="40" fill="${c}" opacity=".85"/><rect x="200" y="190" width="200" height="220" rx="56" fill="#1d2433"/><rect x="216" y="206" width="168" height="188" rx="44" fill="url(#s)"/><rect x="398" y="250" width="16" height="50" rx="8" fill="#1d2433"/>`,
  printer: (c) => `<rect x="190" y="120" width="220" height="110" rx="8" fill="#fff" stroke="#d5dbe7" stroke-width="4"/><rect x="110" y="210" width="380" height="200" rx="30" fill="${c}"/><rect x="170" y="360" width="260" height="120" rx="8" fill="#fff" stroke="#d5dbe7" stroke-width="4"/><circle cx="440" cy="260" r="10" fill="#4ade80"/>`,
  purse: (c) => `<path d="M220 250c0-60 30-100 80-100s80 40 80 100" fill="none" stroke="${c}" stroke-width="22"/><path d="M150 250h300l30 250H120z" fill="${c}"/><rect x="270" y="300" width="60" height="30" rx="8" fill="#e8c46b"/>`,
  gaming: (c) => `<path d="M175 230h250c60 0 95 90 95 170 0 50-40 70-75 40l-55-50H215l-55 50c-35 30-75 10-75-40 0-80 35-170 90-170z" fill="${c}"/><circle cx="420" cy="290" r="14" fill="#f87171"/><circle cx="450" cy="320" r="14" fill="#60a5fa"/><path d="M190 300h60M220 270v60" stroke="#fff" stroke-width="16" stroke-linecap="round" opacity=".7"/>`,
  hair: (c) => `<rect x="150" y="270" width="320" height="34" rx="17" fill="${c}" transform="rotate(-20 300 300)"/><rect x="140" y="320" width="320" height="34" rx="17" fill="${c}" transform="rotate(-8 300 300)"/><circle cx="160" cy="390" r="20" fill="${c}"/>`,
};

const img = (kind, color, bg) => svg(ART[kind](color), bg);

const DAY = 86400000;
const now = Date.now();
const ago = (days) => new Date(now - days * DAY).toISOString();
const inHours = (h) => new Date(now + h * 3600000).toISOString();

let n = 0;
function p({ name, brand, cat, kind, colors, price, current, stock = 6, sections = [], specs = [], days = 60, points = 20, delivery = [2, "hours"], offerHours = 0, stars = 0, ratings = 0, dept = "Electronics" }) {
  n += 1;
  const sd = { allProducts: true };
  sections.forEach((s) => (sd[s] = true));
  return {
    id: `demo-${String(n).padStart(3, "0")}`,
    productId: String(40000000 + n * 137),
    sku: `D${String(100 + n)}-0${n % 9}`,
    name,
    brand,
    category: cat,
    categoryDetail: dept,
    origin: "Leamington Express",
    pricing: { price, currentPrice: current },
    stock,
    images: colors.map((c, i) => img(kind, c, i % 2 ? ["#eef2fb", "#dfe6f5"] : undefined)),
    variants: colors.length > 1 ? ["Negro", "Azul", "Blanco", "Rosa"].slice(0, colors.length) : ["Negro"],
    delivery: { count: delivery[0], unit: delivery[1] },
    offer: offerHours ? { count: 1, unit: "days", endsAt: inHours(offerHours) } : { count: 0, unit: "days", endsAt: null },
    expressPoints: points,
    sectionDisplay: sd,
    specifications: specs.map(([title, description]) => ({ title, description })),
    stars,
    ratingsNumber: ratings,
    performance: Math.max(0, 12 - (n % 13)),
    createdAt: ago(days),
  };
}

export const DEMO_PRODUCTS = [
  p({ name: '55" 4K Smart TV con Roku integrado', brand: "Philips", cat: "Television", kind: "tv", colors: ["#20242e"], price: 445, current: 398, sections: ["dayOffer", "mostSearched"], specs: [["Resolución", "3840 × 2160 (4K UHD)"], ["Tamaño", "55 pulgadas"], ["HDR", "HDR10"], ["Puertos", "3 × HDMI, 1 × USB"]], days: 40, points: 50, offerHours: 30, stars: 4.5, ratings: 128 }),
  p({ name: '32" HD Smart TV LR600 con apps', brand: "LG", cat: "Television", kind: "tv", colors: ["#2a2f3b"], price: 299, current: 249, sections: ["bestOffers"], specs: [["Resolución", "1366 × 768 (HD)"], ["Sistema", "webOS"]], days: 90, points: 25 }),
  p({ name: '65" QLED 4K Smart TV Q60', brand: "Samsung", cat: "Television", kind: "tv", colors: ["#151821"], price: 1099, current: 949, sections: ["recommended", "events"], specs: [["Resolución", "4K UHD"], ["Panel", "QLED"], ["Hz", "60 Hz"]], days: 5, points: 90 }),
  p({ name: '43" Full HD Smart TV Google TV', brand: "TCL", cat: "Television", kind: "tv", colors: ["#262a33"], price: 329, current: 279, sections: ["fastOffer"], days: 12, points: 30, offerHours: 9 }),
  p({ name: "Galaxy A16 128 GB desbloqueado", brand: "Samsung", cat: "Phone", kind: "phone", colors: ["#1f2433", "#3459d6", "#e8ebf2"], price: 329, current: 279, sections: ["mostSearched", "mostBought"], specs: [["Almacenamiento", "128 GB"], ["Pantalla", '6.7" Super AMOLED'], ["Cámara", "50 MP"], ["Batería", "5000 mAh"]], days: 20, points: 40, stars: 4.4, ratings: 61 }),
  p({ name: "iPhone 15 128 GB (renovado)", brand: "Apple", cat: "Phone", kind: "phone", colors: ["#2b2f38", "#f2d7dc"], price: 899, current: 799, sections: ["recommended", "EveryoneLikes"], specs: [["Almacenamiento", "128 GB"], ["Estado", "Renovado, garantía 1 año"]], days: 3, points: 80 }),
  p({ name: "Moto G Play 64 GB desbloqueado", brand: "Motorola", cat: "Phone", kind: "phone", colors: ["#283a6b"], price: 199, current: 159, sections: ["dayOffer"], days: 70, points: 15, stock: 2 }),
  p({ name: "Redmi Note 14 256 GB", brand: "Redmi", cat: "Phone", kind: "phone", colors: ["#1b1f2a", "#5b7cfa"], price: 349, current: 299, sections: ["bestOffers", "mostBought"], days: 9, points: 35 }),
  p({ name: "AirPods Pro (2.ª generación) con estuche USB‑C", brand: "Apple", cat: "Earbuds", kind: "earbuds", colors: ["#f5f6fa"], price: 329, current: 279, sections: ["mostSearched", "EveryoneLikes", "events"], specs: [["Cancelación de ruido", "Activa"], ["Batería", "Hasta 30 h con estuche"]], days: 15, points: 40, stars: 4.8, ratings: 342 }),
  p({ name: "Galaxy Buds FE inalámbricos", brand: "Samsung", cat: "Earbuds", kind: "earbuds", colors: ["#2a2e38", "#eef0f5"], price: 129, current: 89, sections: ["fastOffer", "dayOffer"], days: 25, points: 15, offerHours: 18 }),
  p({ name: "Tune Buds 2 cancelación de ruido", brand: "JBL", cat: "Earbuds", kind: "earbuds", colors: ["#1e2230", "#3b5bdb"], price: 119, current: 79, sections: ["bestOffers"], days: 33, points: 12 }),
  p({ name: "Go Air Pop True Wireless", brand: "JLab", cat: "Earbuds", kind: "earbuds", colors: ["#5f3dc4", "#e64980"], price: 34.99, current: 24.99, sections: ["mostBought"], days: 50, points: 5, stock: 12 }),
  p({ name: "Solo 4 audífonos inalámbricos on-ear", brand: "Beats", cat: "Headphones", kind: "headphones", colors: ["#1d1f26", "#c92a2a"], price: 399.99, current: 299.99, sections: ["recommended", "events"], specs: [["Batería", "Hasta 50 h"], ["Conexión", "Bluetooth Clase 1"]], days: 28, points: 40, stars: 4.6, ratings: 77 }),
  p({ name: "WH-CH720N con cancelación de ruido", brand: "Sony", cat: "Headphones", kind: "headphones", colors: ["#2b2d33", "#dee2e6"], price: 199.99, current: 149.99, sections: ["mostSearched"], days: 18, points: 20 }),
  p({ name: "Hesh Evo inalámbricos 36 h", brand: "Skullcandy", cat: "Headphones", kind: "headphones", colors: ["#2f3a4a"], price: 189, current: 139, sections: ["dayOffer"], days: 65, points: 15 }),
  p({ name: "Flip 6 bocina Bluetooth resistente al agua", brand: "JBL", cat: "Speaker", kind: "speaker", colors: ["#1f2a44", "#e03131", "#2b8a3e"], price: 169.99, current: 129.99, sections: ["mostSearched", "events"], specs: [["Resistencia", "IP67"], ["Batería", "12 h"]], days: 22, points: 15, stars: 4.7, ratings: 210 }),
  p({ name: "Charge 5 bocina portátil", brand: "JBL", cat: "Speaker", kind: "speaker", colors: ["#1b2436", "#1971c2"], price: 249.99, current: 199.99, sections: ["recommended", "mostBought"], days: 6, points: 25 }),
  p({ name: "Bocina Rugged Mini con Party Sync", brand: "Onn", cat: "Speaker", kind: "speaker", colors: ["#343a40"], price: 49, current: 39, sections: ["fastOffer"], days: 80, points: 5, stock: 15 }),
  p({ name: "Bocina para fiestas con luces LED", brand: "Monster", cat: "Speaker", kind: "speaker", colors: ["#141517"], price: 299, current: 229, sections: ["EveryoneLikes"], days: 2, points: 30, stock: 0 }),
  p({ name: 'iPad 10.9" Wi‑Fi 64 GB', brand: "Apple", cat: "Tablet", kind: "tablet", colors: ["#9aa5b8", "#4c6ef5"], price: 499, current: 449, sections: ["recommended"], specs: [["Pantalla", '10.9" Liquid Retina'], ["Chip", "A14 Bionic"]], days: 14, points: 45 }),
  p({ name: 'Galaxy Tab A9+ 11" 64 GB', brand: "Samsung", cat: "Tablet", kind: "tablet", colors: ["#2d3240"], price: 299, current: 229, sections: ["bestOffers", "dayOffer"], days: 35, points: 25 }),
  p({ name: 'Tablet 8" para niños con funda', brand: "Onn", cat: "Tablet", kind: "tablet", colors: ["#f08c00"], price: 99, current: 79, sections: ["events"], days: 45, points: 10 }),
  p({ name: 'Laptop 15.6" Core i5, 16 GB RAM, 512 GB SSD', brand: "HP", cat: "Laptop", kind: "laptop", colors: ["#adb5bd"], price: 899, current: 749, sections: ["recommended", "mostSearched"], specs: [["Procesador", "Intel Core i5"], ["RAM", "16 GB"], ["Almacenamiento", "512 GB SSD"]], days: 8, points: 70 }),
  p({ name: 'Aspire 3 14" Ryzen 5, 8 GB, 256 GB', brand: "Acer", cat: "Laptop", kind: "laptop", colors: ["#868e96"], price: 649, current: 529, sections: ["bestOffers"], days: 55, points: 50 }),
  p({ name: "Chromebook 14\" 64 GB", brand: "Lenovo", cat: "Laptop", kind: "laptop", colors: ["#495057"], price: 329, current: 259, sections: ["fastOffer"], days: 4, points: 25, offerHours: 44 }),
  p({ name: "Apple Watch SE (GPS) 40 mm", brand: "Apple", cat: "Watch", kind: "watch", colors: ["#e9d8c4", "#212529"], price: 329, current: 299, sections: ["events", "EveryoneLikes"], days: 11, points: 30 }),
  p({ name: "Galaxy Watch7 44 mm Bluetooth", brand: "Samsung", cat: "Watch", kind: "watch", colors: ["#343a40", "#dee2e6"], price: 399, current: 319, sections: ["recommended"], days: 19, points: 35 }),
  p({ name: "Impresora multifunción inalámbrica DeskJet", brand: "HP", cat: "Printer", kind: "printer", colors: ["#e9ecef"], price: 129, current: 99, sections: ["mostBought"], days: 75, points: 10 }),
  p({ name: "Impresora EcoTank ET‑2800 sin cartuchos", brand: "Epson", cat: "Printer", kind: "printer", colors: ["#212529"], price: 299, current: 259, sections: ["recommended"], days: 41, points: 25 }),
  p({ name: "Control inalámbrico DualSense", brand: "Playstation", cat: "Gaming", kind: "gaming", colors: ["#f1f3f5", "#1c7ed6"], price: 89.99, current: 74.99, sections: ["mostSearched", "events"], days: 1, points: 10 }),
  p({ name: "Control inalámbrico Xbox Series", brand: "XBOX", cat: "Gaming", kind: "gaming", colors: ["#212529", "#2f9e44"], price: 79.99, current: 64.99, sections: ["fastOffer"], days: 27, points: 8 }),
  p({ name: "Bolso tote de piel sintética", brand: "Time and Tru", cat: "Purse", kind: "purse", colors: ["#8d5b3a", "#212529"], price: 59, current: 39, sections: ["events"], dept: "Handbags", days: 16, points: 5, delivery: [24, "hours"] }),
  p({ name: "Bolso cruzado acolchado", brand: "Madden NYC", cat: "Purse", kind: "purse", colors: ["#c2255c"], price: 49, current: 34, sections: ["EveryoneLikes"], dept: "Handbags", days: 30, points: 5, delivery: [24, "hours"] }),
  p({ name: "Plancha para cabello de cerámica 1\"", brand: "L'ange Hair", cat: "Hair Straightener", kind: "hair", colors: ["#e64980"], price: 129, current: 89, sections: ["events"], dept: "Hair care", days: 10, points: 10, delivery: [2, "days"] }),
];
