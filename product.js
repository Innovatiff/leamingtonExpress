"use strict";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

// auth not needed for guest-only product flow right now
// import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { upsertGuestCartItem, setGuestBuyNow } from "./guestCart.js";

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
// const auth = getAuth(app);
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

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function cleanStr(v) {
  return (v ?? "").toString().trim();
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

function moneyFmt(val) {
  return parseMoney(val).toFixed(2);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getSavings(product) {
  const price = parseMoney(product?.pricing?.price);
  const current = parseMoney(product?.pricing?.currentPrice);

  if (price > 0 && current > 0 && current < price) {
    return price - current;
  }

  return 0;
}

function getAny(obj, paths, fallback = undefined) {
  for (const path of paths) {
    const parts = path.split(".");
    let cur = obj;
    let ok = true;

    for (const p of parts) {
      if (!cur || typeof cur !== "object" || !(p in cur)) {
        ok = false;
        break;
      }
      cur = cur[p];
    }

    if (ok && cur !== undefined && cur !== null) return cur;
  }

  return fallback;
}

function readName(p) {
  return (
    cleanStr(getAny(p, ["name", "productName", "porductName", "title"], "")) ||
    "Producto"
  );
}

function readBrand(p) {
  return cleanStr(getAny(p, ["brand", "Brand"], "")) || "No agregado";
}

function readCategory(p) {
  return (
    cleanStr(getAny(p, ["category", "productTag", "Category"], "")) || "Other"
  );
}

function readCategoryDetail(p) {
  return cleanStr(getAny(p, ["categoryDetail"], "")) || "";
}

function readOrigin(p) {
  return cleanStr(getAny(p, ["origin", "Origin"], "")) || "Leamington Express";
}

function readStock(p) {
  const n = Number(getAny(p, ["stock", "Stock", "quantity"], 0));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function readRatings(p) {
  const stars = clamp(Number(getAny(p, ["stars", "rating"], 0)) || 0, 0, 5);
  const ratingsNumber =
    Number(getAny(p, ["ratingsNumber", "reviewsCount"], 0)) || 0;

  return { stars, ratingsNumber };
}

function readPoints(p) {
  return (
    Number(getAny(p, ["expressPoints", "ExpressPoints", "points"], 0)) || 0
  );
}

function readPrices(p) {
  const cost = parseMoney(getAny(p, ["pricing.cost", "cost"], 0));
  const price = parseMoney(getAny(p, ["pricing.price", "price"], 0));
  const currentPrice = parseMoney(
    getAny(p, ["pricing.currentPrice", "currentPrice", "actualPrice"], 0),
  );

  const displayNow = currentPrice > 0 ? currentPrice : price > 0 ? price : cost;
  const displayOld = price > 0 ? price : displayNow;

  return { cost, price, currentPrice, displayNow, displayOld };
}
function roundSavings(value) {
  return Math.round(value / 5) * 5;
}

function readOffer(p) {
  const obj = typeof p.offer === "object" ? p.offer : null;

  if (obj) {
    return {
      count: Number(obj.count || 0) || 0,
      unit: cleanStr(obj.unit || "days").toLowerCase() || "days",
    };
  }

  return {
    count: Number(p.offerCount || 0) || 0,
    unit: cleanStr(p.offerUnit || "days").toLowerCase() || "days",
  };
}

function readDelivery(p) {
  const obj = typeof p.delivery === "object" ? p.delivery : null;

  if (obj) {
    return {
      count: Number(obj.count || 0) || 0,
      unit: cleanStr(obj.unit || "days").toLowerCase() || "days",
    };
  }

  return {
    count: Number(p.deliveryCount || 0) || 0,
    unit: cleanStr(p.deliveryUnit || "days").toLowerCase() || "days",
  };
}

function parseVariants(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => cleanStr(x)).filter(Boolean);

  return String(v)
    .split(/[,|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function pickImages(product) {
  const arr = Array.isArray(product?.images)
    ? product.images.filter(Boolean)
    : [];
  return {
    main: arr[0] || "",
    all: arr,
    others: arr.slice(0, 5),
  };
}

function getSelectedProductId() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("id") ||
    params.get("pid") ||
    params.get("productId") ||
    localStorage.getItem("express_selected_product_id") ||
    ""
  );
}

function buildStarsText(stars) {
  return Number(stars || 0).toFixed(1);
}

function buildRatingCountText(count) {
  const n = Number(count || 0);
  if (n >= 1000) return `(${(n / 1000).toFixed(1)}k)`;
  return `(${n})`;
}

function isOnSale(product) {
  const { price, currentPrice } = readPrices(product);
  return currentPrice > 0 && price > 0 && currentPrice < price;
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

/* =========================
   DOM
========================= */
const backButtons = qsa(".phheader__back--btn");
const mainImg = qs(".phproduct__product--imgs-main");
const thumbsWrap = qs(".phproduct__product--imgs-other");

const nameEl = qs(".phproduct__product--name");
const brandEl = qs(".phproduct__product--brand-result");
const ratingResultEl = qs(".phproduct__product--rating-result");
const ratingCountEl = qs(".phproduct__product--rating-count");

const priceNowEl = qs(".phproduct__product--price-info-box-offer");
const priceOldEl = qs(".phproduct__product--price-info-box-regular");
const offerTextEl = qs(".phproduct__product--price-info-box-text");

const qtyMinus = qs(".phproduct__product--price-quantity-remove");
const qtyPlus = qs(".phproduct__product--price-quantity-add");
const qtyCountEl = qs(".phproduct__product--price-quantity-count");

const deliveryTextEl = qs(".phproduct__product--trigger-text");
const fastDeliveryTextEl = qs(".phproduct__product--trigger-box-top-sp span");

const paymentBottomEl = qs(".phproduct__product--trigger-box-bottom");

const stockTextEl = qs(".phproduct__product--stock > span");
const stockLineResultEl = qs(".phproduct__product--stock-result");

const variantBox = qs(".phproduct__product--variant-box");

const descriptionWrap = qs(".phproduct__product--description");
const descriptionHeading = qs(".phproduct__product--description-heading");

const buyNowBtn = qs(".phproduct__action--btn-now");
const addToCartBtn = qs(".phproduct__action--btn-cart");

const relatedProductsWrap = qs(".phproducts .phproducts__products");
const relatedViewAllBtn = qs(".phproducts .phproducts__header--more");

/* =========================
   STATE
========================= */
let currentProductId = "";
let currentProduct = null;
let selectedVariant = "";
let selectedImage = "";
let quantity = 1;
let currentStock = 0;

/* =========================
   UI RENDER
========================= */
function setQuantity(newQty) {
  const maxQty = currentStock > 0 ? currentStock : 1;

  quantity = clamp(Number(newQty) || 1, 1, maxQty);

  if (qtyCountEl) qtyCountEl.textContent = String(quantity);

  const canRemove = quantity > 1;
  const canAdd = quantity < maxQty && currentStock > 0;

  // Disable logic (you already had this)
  if (qtyMinus) qtyMinus.disabled = !canRemove;
  if (qtyPlus) qtyPlus.disabled = !canAdd;

  // 🔥 NEW: visual state (active / insufficient)
  if (qtyMinus) {
    qtyMinus.classList.toggle(
      "phproduct__product--price-quantity-insu",
      !canRemove,
    );
  }

  if (qtyPlus) {
    qtyPlus.classList.toggle(
      "phproduct__product--price-quantity-insu",
      !canAdd,
    );
  }
}

function setMainImage(url) {
  if (!mainImg || !url) return;
  mainImg.src = url;
  selectedImage = url;

  thumbsWrap?.querySelectorAll("img").forEach((img) => {
    img.classList.toggle(
      "phproduct__product--imgs-other-active",
      img.src === url,
    );
  });
}

function renderThumbs(images) {
  if (!thumbsWrap) return;

  thumbsWrap.innerHTML = "";

  images.forEach((url, index) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Product Image";

    if (
      (selectedImage && selectedImage === url) ||
      (!selectedImage && index === 0)
    ) {
      img.classList.add("phproduct__product--imgs-other-active");
    }

    img.addEventListener("click", () => setMainImage(url));
    thumbsWrap.appendChild(img);
  });
}

function renderVariants(variants) {
  if (!variantBox) return;

  variantBox.innerHTML = "";

  if (!variants.length) {
    const btn = document.createElement("button");
    btn.className =
      "phproduct__product--variant-box-btn phproduct__product--variant-box-btn-active";
    btn.textContent = "Default";
    variantBox.appendChild(btn);
    selectedVariant = "Default";
    return;
  }

  if (!selectedVariant || !variants.includes(selectedVariant)) {
    selectedVariant = variants[0];
  }

  variants.forEach((variant) => {
    const btn = document.createElement("button");
    btn.className = "phproduct__product--variant-box-btn";
    btn.textContent = variant;

    if (variant === selectedVariant) {
      btn.classList.add("phproduct__product--variant-box-btn-active");
    }

    btn.addEventListener("click", () => {
      selectedVariant = variant;
      variantBox.querySelectorAll("button").forEach((b) => {
        b.classList.remove("phproduct__product--variant-box-btn-active");
      });
      btn.classList.add("phproduct__product--variant-box-btn-active");
    });

    variantBox.appendChild(btn);
  });
}

function renderDescriptions(product) {
  if (!descriptionWrap) return;

  const specs = Array.isArray(product?.specifications)
    ? product.specifications
    : [];

  descriptionWrap.innerHTML = "";
  if (descriptionHeading) {
    const heading = document.createElement("h3");
    heading.className = "phproduct__product--description-heading";
    heading.textContent = "Descripción";
    descriptionWrap.appendChild(heading);
  }

  if (!specs.length) {
    const box = document.createElement("div");
    box.className = "phproduct__product--description-box";
    box.innerHTML = `
      <h4 class="phproduct__product--description-box-title">Detalles</h4>
      <p class="phproduct__product--description-box-desc">No hay descripción disponible.</p>
    `;
    descriptionWrap.appendChild(box);
    return;
  }

  specs.forEach((spec) => {
    const title = cleanStr(spec?.title || "Detalle");
    const desc = cleanStr(spec?.description || "No agregado");

    const box = document.createElement("div");
    box.className = "phproduct__product--description-box";
    box.innerHTML = `
      <h4 class="phproduct__product--description-box-title">${safeText(title)}</h4>
      <p class="phproduct__product--description-box-desc">${safeText(desc)}</p>
    `;
    descriptionWrap.appendChild(box);
  });
}

function renderRelatedCard(product) {
  const img = product?.images?.[0] || "";
  const name = readName(product);
  const { stars, ratingsNumber } = readRatings(product);
  const { displayNow, displayOld } = readPrices(product);
  const savings = displayOld - displayNow;

  const card = document.createElement("a");
  card.href = productLink(product);
  card.className = "phproducts__product";

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
  <span class="phproducts__product--price-actual">$${moneyFmt(displayNow)}</span>
  <span class="phproducts__product--price-reg">$${moneyFmt(displayOld)}</span>
</div>
`;

  return card;
}

function fillProductUI(productId, product) {
  currentProductId = productId;
  currentProduct = product;
  currentStock = readStock(product);

  const images = pickImages(product);
  selectedImage = images.main || "";

  if (images.main) {
    setMainImage(images.main);
  }
  renderThumbs(images.others.length ? images.others : images.all);

  const { stars, ratingsNumber } = readRatings(product);
  const { displayNow, displayOld } = readPrices(product);
  const offer = readOffer(product);
  const delivery = readDelivery(product);
  const variants = parseVariants(product?.variants || product?.variant);

  if (nameEl) nameEl.textContent = readName(product);
  if (brandEl) brandEl.textContent = readBrand(product);
  if (ratingResultEl) ratingResultEl.textContent = buildStarsText(stars);
  if (ratingCountEl)
    ratingCountEl.textContent = buildRatingCountText(ratingsNumber);

  if (priceNowEl) priceNowEl.textContent = `$${moneyFmt(displayNow)}`;
  if (priceOldEl) priceOldEl.textContent = `$${moneyFmt(displayOld)}`;

  if (offerTextEl) {
    if (offer.count > 0) {
      offerTextEl.textContent = `🔥 Oferta por tiempo limitado`;
    } else {
      offerTextEl.textContent = "🔥 Oferta por tiempo limitado";
    }
  }

  if (deliveryTextEl) {
    deliveryTextEl.textContent = `Entregado por ${readOrigin(product)}`;
  }

  if (fastDeliveryTextEl) {
    if (delivery.count > 0) {
      fastDeliveryTextEl.textContent = `Entrega en menos de ${delivery.count} ${delivery.unit}`;
    } else {
      fastDeliveryTextEl.textContent = "Entrega disponible";
    }
  }

  if (paymentBottomEl) {
    paymentBottomEl.innerHTML = `
      <p>Efectivo</p>
      <p>E-transfer</p>
      <p>Tarjeta debito o credito</p>
    `;
  }

  if (stockTextEl) {
    stockTextEl.textContent =
      currentStock > 0
        ? `Solo quedan ${currentStock} disponibles ⚠`
        : "Producto agotado";
  }

  if (stockLineResultEl) {
    stockLineResultEl.textContent = String(currentStock);
    const width = clamp(currentStock * 10, 8, 100);
    stockLineResultEl.style.width = `${width}%`;
  }

  renderVariants(variants);
  renderDescriptions(product);
  setQuantity(1);

  const outOfStock = currentStock <= 0;
  if (addToCartBtn) addToCartBtn.disabled = outOfStock;
  if (buyNowBtn) buyNowBtn.disabled = outOfStock;
  if (qtyPlus) qtyPlus.disabled = outOfStock;
  if (qtyMinus) qtyMinus.disabled = outOfStock;

  document.title = `${readName(product)} | Leamington Express`;
}

/* =========================
   CART / BUY NOW
========================= */
function buildCartItem(product, docId) {
  const { displayNow, displayOld } = readPrices(product);
  const offer = readOffer(product);
  const delivery = readDelivery(product);
  const images = pickImages(product);

  return {
    docId: cleanStr(docId || ""),
    productId: cleanStr(product?.productId || ""),
    name: readName(product),
    category: readCategory(product),
    brand: readBrand(product),
    origin: readOrigin(product),
    sku: cleanStr(product?.sku || ""),
    image: cleanStr(selectedImage || images.main || ""),
    price: parseMoney(displayNow),
    oldPrice: parseMoney(displayOld),
    points: Number(readPoints(product)) || 0,
    offer: {
      count: Number(offer.count) || 0,
      unit: cleanStr(offer.unit || "days"),
    },
    delivery: {
      count: Number(delivery.count) || 0,
      unit: cleanStr(delivery.unit || "days"),
    },
    variant: cleanStr(selectedVariant || ""),
    quantity: Number(quantity) || 1,
    qty: Number(quantity) || 1,
    updatedAt: Timestamp.now(),
    addedAt: Timestamp.now(),
  };
}

async function addToCart(product, productId) {
  const stock = readStock(product);

  if (stock <= 0) {
    alert("Este producto no tiene stock.");
    return;
  }

  if (quantity > stock) {
    setQuantity(stock);
    alert(`Solo puedes agregar ${stock} producto(s).`);
    return;
  }

  const item = buildCartItem(product, productId);
  upsertGuestCartItem(item);
  alert("✅ Agregado al carrito");
}

async function buyNow(product, productId) {
  const stock = readStock(product);

  if (stock <= 0) {
    alert("Este producto no tiene stock.");
    return;
  }

  if (quantity > stock) {
    setQuantity(stock);
    alert(`Solo puedes comprar ${stock} producto(s).`);
    return;
  }

  const item = buildCartItem(product, productId);

  // Guest-only flow for now
  setGuestBuyNow(item);
  window.location.href = "checkout.html?mode=buyNow";
}

/* =========================
   RELATED PRODUCTS
========================= */
async function loadRelatedProducts(currentProduct) {
  if (!relatedProductsWrap) return;

  const category = readCategory(currentProduct);
  if (!category) return;

  const colRef = collection(db, "express_products");

  let snaps = [];
  try {
    const res1 = await getDocs(
      query(colRef, where("category", "==", category)),
    );
    snaps = res1.docs;

    if (!snaps.length) {
      const res2 = await getDocs(
        query(
          colRef,
          where("categoryDetail", "==", readCategoryDetail(currentProduct)),
        ),
      );
      snaps = res2.docs;
    }
  } catch (err) {
    console.error("❌ Related products query failed:", err);
    return;
  }

  const products = snaps
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter((p) => p.id !== currentProductId);

  const sorted = sortProductsById(products).slice(0, 10);

  relatedProductsWrap.innerHTML = "";
  sorted.forEach((product) => {
    relatedProductsWrap.appendChild(renderRelatedCard(product));
  });

  relatedViewAllBtn?.addEventListener("click", () => {
    window.location.href = `products.html?q=${encodeURIComponent(category)}`;
  });
}

/* =========================
   LOAD PRODUCT
========================= */
async function loadProductPage() {
  const productId = getSelectedProductId();

  if (!productId) {
    console.warn("❌ No product id found.");
    return false;
  }

  localStorage.setItem("express_selected_product_id", productId);

  const ref = doc(db, "express_products", productId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("❌ Product not found:", productId);
    return false;
  }

  const product = { ...snap.data(), docId: snap.id };

  fillProductUI(snap.id, product);
  await loadRelatedProducts(product);

  return true;
}

/* =========================
   EVENTS
========================= */
backButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    if (index === 0) {
      window.history.back();
    }
  });
});

qtyMinus?.addEventListener("click", (e) => {
  e.preventDefault();
  setQuantity(quantity - 1);
});

qtyPlus?.addEventListener("click", (e) => {
  e.preventDefault();
  setQuantity(quantity + 1);
});

addToCartBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!currentProduct || !currentProductId) {
    const ok = await loadProductPage();
    if (!ok) return alert("Producto no cargado todavía.");
  }

  try {
    await addToCart(currentProduct, currentProductId);
  } catch (err) {
    console.error("❌ Add to cart failed:", err);
    alert("No se pudo agregar al carrito.");
  }
});

buyNowBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!currentProduct || !currentProductId) {
    const ok = await loadProductPage();
    if (!ok) return alert("Producto no cargado todavía.");
  }

  try {
    await buyNow(currentProduct, currentProductId);
  } catch (err) {
    console.error("❌ Buy now failed:", err);
    alert("No se pudo continuar.");
  }
});

/* =========================
   INIT
========================= */
if (addToCartBtn) addToCartBtn.disabled = true;
if (buyNowBtn) buyNowBtn.disabled = true;

document.addEventListener("DOMContentLoaded", async () => {
  await loadProductPage();
});
