"use strict";

// FAQ section
const faqBtn = document.querySelectorAll(".faq__questions--box");

faqBtn.forEach((btn) => {
  btn.addEventListener("click", function (e) {
    const answer = btn.children[1];
    const answerText = answer.children[0];
    const icon = btn.children[0].children[0];
    answer.classList.toggle("faq__questions--box-answer-open");
    answer.classList.toggle("faq__questions--box-answer-inner");
    answerText.classList.toggle("faq__questions--box-answer-text-show");
    icon.classList.toggle("faq__questions--box-ask-icon-open");
    btn.classList.toggle("faq__questions--box-open");
  });
});

// Top slider
const slides = document.querySelector(".phads__slides");
const slideItems = document.querySelectorAll(".phads__slide");
const points = document.querySelectorAll(".phads__point");

let current = 0;
const total = slideItems.length;
let autoSlide;

// Move slider
function goToSlide(index) {
  current = index;
  slides.style.transform = `translateX(-${index * 100}%)`;

  points.forEach((p) => p.classList.remove("phads__point--active"));
  points[index].classList.add("phads__point--active");
}

// Auto slide
function startAuto() {
  autoSlide = setInterval(() => {
    current = (current + 1) % total;
    goToSlide(current);
  }, 10000);
}

// Stop auto when interacting
function stopAuto() {
  clearInterval(autoSlide);
}

// Dot click
points.forEach((point) => {
  point.addEventListener("click", () => {
    stopAuto();
    goToSlide(Number(point.dataset.index));
    startAuto();
  });
});

// Swipe support (mobile)
let startX = 0;
let isDragging = false;

slides.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;
  stopAuto();
});

slides.addEventListener("touchend", (e) => {
  if (!isDragging) return;

  let endX = e.changedTouches[0].clientX;
  let diff = startX - endX;

  if (diff > 50) {
    current = (current + 1) % total;
  } else if (diff < -50) {
    current = (current - 1 + total) % total;
  }

  goToSlide(current);
  startAuto();
  isDragging = false;
});

// Init
goToSlide(0);
startAuto();

// Products
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

function renderPhoneHomeCard(product, isGrid = false) {
  const img = product?.images?.[0] || "";
  const name = product?.name || "";
  const stars = Number(product?.stars || 0);
  const ratingsNumber = Number(product?.ratingsNumber || 0);
  const currentPrice = getDisplayPrice(product);
  const regularPrice = parseMoney(product?.pricing?.price);
  const savings = getSavings(product);

  const card = document.createElement("a");
  card.href = productLink(product);
  card.className = isGrid
    ? "phproducts__product phproducts__product--grid"
    : "phproducts__product";

  card.innerHTML = `
${isOnSale(product) ? '<span class="phproducts__product--sale">Oferta</span>' : ""}

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
  <span class="phproducts__product--price-reg">$${money(regularPrice)}</span>
</div>


`;

  return card;
}

function getSectionProducts(products, key) {
  return sortProductsById(
    products.filter((p) => p?.sectionDisplay?.[key] === true),
  );
}

function renderSection(containerId, products, key, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { limit = null, grid = false } = options;

  const selected = getSectionProducts(products, key);
  const finalProducts = limit ? selected.slice(0, limit) : selected;

  container.innerHTML = "";

  finalProducts.forEach((product) => {
    container.appendChild(renderPhoneHomeCard(product, grid));
  });

  const sectionEl = container.closest(".phproducts");
  const viewAllBtn = sectionEl?.querySelector(".phproducts__header--more");

  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      window.location.href = `products.html?section=${encodeURIComponent(key)}`;
    });
  }
}

function wireCategoryBoxes() {
  const boxes = Array.from(document.querySelectorAll(".phcat__box"));
  if (boxes.length < 4) return;

  const allOffersBox = boxes[0];
  const electronicsBox = boxes[1];
  const casaBox = boxes[2];
  const moreBox = boxes[3];

  allOffersBox.style.cursor = "pointer";
  electronicsBox.style.cursor = "pointer";
  casaBox.style.cursor = "pointer";
  moreBox.style.cursor = "pointer";

  allOffersBox.onclick = () => {
    window.location.href = "products.html?specialOffers=true";
  };

  electronicsBox.onclick = () => {
    window.location.href = "products.html?categoryDetail=Electronics";
  };

  casaBox.onclick = () => {
    window.location.href = "products.html?categoryDetail=Casa";
  };

  moreBox.onclick = () => {
    window.location.href = "products.html";
  };
}

/* =========================
   HOME PRODUCTS
========================= */
function bootPhoneHomeProducts() {
  const colRef = collection(db, "express_products");

  onSnapshot(
    colRef,
    (snap) => {
      const products = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));

      renderSection("mostSearched", products, "mostSearched", { limit: 10 });
      renderSection("dayOffer", products, "dayOffer", { limit: 5 });
      renderSection("fastOffer", products, "fastOffer", {
        limit: 4,
        grid: true,
      });
      renderSection("recommended", products, "recommended", { limit: 10 });
      renderSection("EveryoneLikes", products, "EveryoneLikes", { limit: 10 });
      renderSection("mostBought", products, "mostBought", { limit: 10 });
      renderSection("bestOffers", products, "bestOffers", {
        limit: 4,
        grid: true,
      });
      renderSection("events", products, "events", {
        limit: 10,
        grid: true,
      });

      wireCategoryBoxes();

      console.log("✅ Phone home products loaded:", products.length);
    },
    (err) => {
      console.error("❌ Phone home products listener error:", err);
    },
  );
}

/* =========================
   START PRODUCTS
========================= */
bootPhoneHomeProducts();
