"use strict";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   FIREBASE
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyBgrPM2Pe3jP6N6pfqAqHROY0mXSEPJBRA",
  authDomain: "express-corp.firebaseapp.com",
  projectId: "express-corp",
  storageBucket: "express-corp.firebasestorage.app",
  messagingSenderId: "499821040541",
  appId: "1:499821040541:web:e3347ca4ff4c4dc84e1574",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
   DOM
========================= */
const productsDisplay = document.querySelector(".phproducts__products");
const loadMoreBtn = document.querySelector(".phproducts__more");
const resultsHeading = document.querySelector(".phheader__bottom--results");

if (!productsDisplay) {
  console.warn("❌ .phproducts__products not found.");
}

/* =========================
   STATE
========================= */
const PRODUCTS_PER_LOAD = 15;
let allFilteredProducts = [];
let visibleCount = PRODUCTS_PER_LOAD;

/* =========================
   HELPERS
========================= */
function renderStarsHTML(stars = 0, count = 0) {
  const fullStars = Math.floor(Number(stars) || 0);
  const totalStars = 5;

  let starsHTML = "";

  for (let i = 0; i < totalStars; i++) {
    starsHTML +=
      i < fullStars
        ? '<i class="ph-fill ph-star"></i>'
        : '<i class="ph ph-star"></i>';
  }

  return `
    <div class="phproducts__product--rating">
      <div class="phproducts__product--rating-stars">
        ${starsHTML}
      </div>
      <span class="phproducts__product--rating-text">(${count || 0})</span>
    </div>
  `;
}

function expandSearchTerms(query) {
  const q = normalizeText(query);

  const synonyms = {
    audifonos: ["headphones", "earbuds", "airpods", "auriculares"],
    auriculares: ["headphones", "earbuds", "airpods", "audifonos"],
    headphones: ["audifonos", "auriculares", "earbuds", "airpods"],

    telefono: ["phone", "phones", "smartphone", "iphone", "galaxy"],
    telefonos: ["phone", "phones", "smartphone", "iphone", "galaxy"],
    celular: ["phone", "phones", "smartphone", "iphone", "galaxy"],
    celulares: ["phone", "phones", "smartphone", "iphone", "galaxy"],
    phone: ["telefono", "telefonos", "celular", "celulares", "smartphone"],
    phones: ["telefono", "telefonos", "celular", "celulares", "smartphone"],

    bocina: ["speaker", "speakers", "jbl", "sony"],
    bocinas: ["speaker", "speakers", "jbl", "sony"],
    speaker: ["bocina", "bocinas"],
    speakers: ["bocina", "bocinas"],

    televisor: ["tv", "television", "smart tv", "roku tv", "pantalla"],
    television: ["tv", "televisor", "smart tv", "roku tv", "pantalla"],
    tv: ["television", "televisor", "pantalla"],
  };

  return [q, ...(synonyms[q] || [])];
}

function safeText(v) {
  return v === null || v === undefined ? "" : String(v);
}

function parseMoney(val) {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  const n = Number(String(val).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(val) {
  return parseMoney(val).toFixed(2);
}
function getSavings(product) {
  const price = parseMoney(product?.pricing?.price);
  const current = parseMoney(product?.pricing?.currentPrice);

  if (price > 0 && current > 0 && current < price) {
    return price - current;
  }

  return 0;
}
function roundSavings(value) {
  return Math.round(value / 5) * 5;
}

function isOnSale(product) {
  const price = parseMoney(product?.pricing?.price);
  const current = parseMoney(product?.pricing?.currentPrice);
  return current > 0 && price > 0 && current < price;
}

function getDisplayPrice(product) {
  const price = parseMoney(product?.pricing?.price);
  const current = parseMoney(product?.pricing?.currentPrice);
  return current > 0 ? current : price;
}

function productLink(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

function sortProductsById(products) {
  return [...products].sort((a, b) => {
    const aId = String(a.productId || a.id || "");
    const bId = String(b.productId || b.id || "");
    return aId.localeCompare(bId, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getSectionTitle(section) {
  const map = {
    mostSearched: "Resultados de “Los mas buscado hoy 🔥”",
    dayOffer: "Resultados de “Ofertas del dia 🎁”",
    fastOffer: "Resultados de “Ofertas rapidas 😃”",
    recommended: "Resultados de “Recomendado para ti 😏”",
    EveryoneLikes: "Resultados de “Todos les gusta estos 👀”",
    events: "Resultados de “Regalos para Mama”",
    mostBought: "Resultados de “Lo mas comprados 🙌”",
    bestOffers: "Resultados de “Mejores ofertas 👌”",
  };

  return map[section] || "Todos los productos";
}

function renderPhoneProductsCard(product) {
  const img = product?.images?.[0] || "";
  const name = product?.name || "";
  const currentPrice = getDisplayPrice(product);
  const regularPrice = parseMoney(product?.pricing?.price);

  const savings = getSavings(product);

  const stars = Number(product?.stars || 0);
  const ratingsNumber = Number(product?.ratingsNumber || 0);

  const card = document.createElement("a");
  card.href = productLink(product);
  card.className = "phproducts__product phproducts__product--grid";

  card.innerHTML = `
${isOnSale(product) ? '<span class="phproducts__product--sale">OFERTA</span>' : ""}

<img
  class="phproducts__product--img"
  src="${safeText(img)}"
  alt="${safeText(name)}"
  loading="lazy"
/>

<span class="phproducts__product--name">${safeText(name)}</span>

${renderStarsHTML(stars, ratingsNumber)}

${
  savings > 0
    ? `
  <div class="phproducts__product--save">
    <p class="phproducts__product--save-text">Oferta</p>
    <p class="phproducts__product--save-value">-$${roundSavings(savings)}</p>
  </div>
`
    : ""
}

<div class="phproducts__product--price">
  <span class="phproducts__product--price-actual">$${money(currentPrice)}</span>
  <span class="phproducts__product--price-reg">-$${money(regularPrice)}</span>
</div>
`;

  return card;
}

function updateLoadMoreButton() {
  if (!loadMoreBtn) return;

  if (allFilteredProducts.length <= PRODUCTS_PER_LOAD) {
    loadMoreBtn.classList.add("hidden");
    return;
  }

  if (visibleCount >= allFilteredProducts.length) {
    loadMoreBtn.classList.add("hidden");
  } else {
    loadMoreBtn.classList.remove("hidden");
  }
}

function renderVisibleProducts() {
  if (!productsDisplay) return;

  productsDisplay.innerHTML = "";

  if (!allFilteredProducts.length) {
    productsDisplay.innerHTML = `
    <div style="
      width: 100%;
      text-align: center;
      padding: 4rem 0;
      font-size: 1.6rem;
      opacity: 0.7;
    ">
      No se encontraron productos 😕
    </div>
  `;

    loadMoreBtn?.classList.add("hidden");
    return;
  }

  const visibleProducts = allFilteredProducts.slice(0, visibleCount);

  visibleProducts.forEach((product) => {
    productsDisplay.appendChild(renderPhoneProductsCard(product));
  });

  updateLoadMoreButton();
}

function filterProducts(products) {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section") || "";
  const specialOffers = params.get("specialOffers") || "";
  const category = normalizeText(params.get("categoryDetail") || "");
  const q = normalizeText(params.get("q") || "");

  let filtered = [...products];

  if (section) {
    filtered = filtered.filter(
      (product) => product?.sectionDisplay?.[section] === true,
    );
  }

  if (specialOffers === "true") {
    filtered = filtered.filter((product) => {
      const sd = product?.sectionDisplay || {};
      return (
        sd.mostSearched === true ||
        sd.dayOffer === true ||
        sd.fastOffer === true ||
        sd.recommended === true ||
        sd.EveryoneLikes === true ||
        sd.bestOffers === true
      );
    });
  }

  if (category) {
    filtered = filtered.filter((product) => {
      const detail = normalizeText(product?.categoryDetail || "");

      return (
        detail === category || detail.includes(category) // extra safety (optional)
      );
    });
  }

  if (q) {
    const expandedTerms = expandSearchTerms(q);
    const queryWords = expandedTerms.flatMap((term) =>
      term.split(" ").filter(Boolean),
    );

    filtered = filtered.filter((product) => {
      const name = normalizeText(product?.name);
      const brand = normalizeText(product?.brand);
      const category = normalizeText(product?.category);
      const categoryDetail = normalizeText(product?.categoryDetail);

      const fullText = `${name} ${brand} ${category} ${categoryDetail}`;

      return queryWords.some((word) => fullText.includes(word));
    });
  }

  filtered = sortProductsById(filtered);

  if (resultsHeading) {
    if (q) {
      resultsHeading.textContent = `Resultados de "${params.get("q")}"`;
    } else if (specialOffers === "true") {
      resultsHeading.textContent = 'Resultados de "Todas las ofertas ✨"';
    } else if (category) {
      if (category === "electronics") {
        resultsHeading.textContent = 'Resultados de "Electronicos"';
      } else if (category === "casa") {
        resultsHeading.textContent = 'Resultados de "Casa"';
      } else {
        resultsHeading.textContent = `Resultados de "${category}"`;
      }
    } else if (section) {
      resultsHeading.textContent = getSectionTitle(section);
    } else {
      resultsHeading.textContent = "Todos los productos";
    }
  }

  return filtered;
}

/* =========================
   LIVE LOAD PRODUCTS
========================= */
function listenProducts() {
  const colRef = collection(db, "express_products");

  onSnapshot(
    colRef,
    (snap) => {
      const products = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));

      allFilteredProducts = filterProducts(products);
      visibleCount = PRODUCTS_PER_LOAD;

      renderVisibleProducts();

      console.log(
        "✅ Phone products page updated:",
        allFilteredProducts.length,
      );
    },
    (err) => {
      console.error("❌ Products listener error:", err);
    },
  );
}

/* =========================
   LOAD MORE
========================= */
loadMoreBtn?.addEventListener("click", () => {
  visibleCount += PRODUCTS_PER_LOAD;
  renderVisibleProducts();
});

/* =========================
   INIT
========================= */
if (productsDisplay) {
  listenProducts();
}
