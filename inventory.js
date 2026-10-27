"use strict";

const softwarePage = document.querySelector(".software");

// --- 1) IMPORT & INIT FIREBASE (replace firebaseConfig with yours) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot, // ✅ ADD
  setDoc, // ✅ ADD
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgrPM2Pe3jP6N6pfqAqHROY0mXSEPJBRA",
  authDomain: "express-corp.firebaseapp.com",
  projectId: "express-corp",
  storageBucket: "express-corp.firebasestorage.app",
  messagingSenderId: "499821040541",
  appId: "1:499821040541:web:e3347ca4ff4c4dc84e1574",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/********************************** 
LOGIN PAGE
*****************************************/

/*********************************
 * ADMIN LOGIN (SINGLE USER) - FIREBASE AUTH
 *********************************/

// ✅ imports (adjust paths to your setup)
// If you already export auth/db from your firebase file, keep that and remove extra init.
// import { auth } from "../src/myaccount";

// DOM READY
window.addEventListener("DOMContentLoaded", () => {
  const adminWrapper = document.querySelector(".admin");
  const loginForm = document.querySelector(".admin__login--form");
  const loginBtn = document.querySelector(".admin__login--form-btn");
  const logoutBtn = document.querySelector(".software__nav--links-link-logout");

  console.log("✅ adminWrapper:", adminWrapper);
  console.log("✅ loginForm:", loginForm);
  console.log("✅ loginBtn:", loginBtn);

  if (!adminWrapper || !loginForm) {
    console.error("❌ Missing .admin or .admin__login--form in DOM");
    return;
  }

  // Put your admin UID here
  const ALLOWED_ADMINS = new Set(["FNTtxDJo1RbFw68eVcbkIFGGqza2"]);

  function hardHideAdmin() {
    // HARD hide so it cannot fail
    adminWrapper.classList.add("hidden");
    adminWrapper.style.display = "none";
    adminWrapper.style.visibility = "hidden";
    adminWrapper.style.pointerEvents = "none";

    console.log("✅ ADMIN UI HIDDEN (forced)", adminWrapper.className);
  }

  function hardShowAdmin() {
    adminWrapper.classList.remove("hidden");
    adminWrapper.style.display = "";
    adminWrapper.style.visibility = "";
    adminWrapper.style.pointerEvents = "";

    console.log("✅ ADMIN UI SHOWN", adminWrapper.className);
  }

  function getInputValue(formEl, name) {
    return formEl.querySelector(`input[name="${name}"]`)?.value.trim() || "";
  }

  async function doLogin(e) {
    e.preventDefault();

    console.log("it works");

    const email = getInputValue(loginForm, "Email");
    const password = getInputValue(loginForm, "Password");

    console.log("➡️ Attempt login with:", email);

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      // session persistence
      await setPersistence(auth, browserSessionPersistence);

      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Signed in UID:", cred.user.uid);

      if (!ALLOWED_ADMINS.has(cred.user.uid)) {
        alert("You do not have access to the admin software.");
        await signOut(auth);
        hardShowAdmin();
        return;
      }

      // ✅ SUCCESS
      hardHideAdmin();
    } catch (err) {
      console.error("❌ Login error:", err);

      if (err.code === "auth/invalid-credential")
        alert("Invalid email or password");
      else if (err.code === "auth/too-many-requests")
        alert("Too many attempts. Try again later.");
      else alert("Login failed. Check console.");

      hardShowAdmin();
    }
  }

  // ✅ submit on form
  loginForm.addEventListener("submit", doLogin);

  // ✅ also click on button (in case form submit isn't firing)
  loginBtn?.addEventListener("click", doLogin);

  // ✅ keep session after refresh
  onAuthStateChanged(auth, (user) => {
    console.log("🔁 onAuthStateChanged user:", user?.uid || null);

    if (!user) {
      hardShowAdmin();
      return;
    }

    if (ALLOWED_ADMINS.has(user.uid)) {
      hardHideAdmin();
    } else {
      hardShowAdmin();
    }
  });

  // ✅ logout
  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    hardShowAdmin();
    console.log("✅ Admin logged out");
  });
});
/******************************************
 *
 *
 *
 *
 * */

const productModifyPreview = document.querySelector(
  ".product__modify--preview",
);
const productModifyForm = document.querySelector(".product__modify--form");
const productModifyEdit = document.querySelector(".product__modify--edit");

const softwareBtnNewProduct = document.querySelector(
  ".software__btn--new-product",
);

const productModifyCloseBtn = document.querySelectorAll(
  ".product__modify--close",
);

const productCloseFormBtn = document.querySelectorAll(
  ".product__modify--footer-btn-form",
);

softwareBtnNewProduct?.addEventListener("click", function () {
  productModifyForm.classList.toggle("hidden");
  softwarePage.classList.toggle("software__low");
});

productModifyCloseBtn.forEach((btn) => {
  btn.addEventListener("click", function () {
    productModifyForm.classList.add("hidden");
    softwarePage.classList.remove("software__low");
  });
});

productCloseFormBtn.forEach((btn) => {
  btn.addEventListener("click", function () {
    productModifyForm.classList.add("hidden");
    softwarePage.classList.remove("software__low");
  });
});

/***********************
 * LIVE STATS (DASHBOARD)
 ***********************/
const statsBoxes = Array.from(
  document.querySelectorAll(".software__content--page-statistic-box"),
);

// Find stat box by its heading text
function getStatSpanByHeading(headingText) {
  const box = statsBoxes.find((b) => {
    const h = b.querySelector(".software__content--page-statistic-box-heading");
    return (
      h && h.textContent.trim().toLowerCase() === headingText.toLowerCase()
    );
  });
  return (
    box?.querySelector(".software__content--page-statistic-box-bottom span") ||
    null
  );
}

const statAllProducts = getStatSpanByHeading("All Products");
const statTotalAssets = getStatSpanByHeading("Total Assets");
const statAPC = getStatSpanByHeading("APC");
const statAPV = getStatSpanByHeading("APV");
const statTPS = getStatSpanByHeading("TPS Summary"); // matches your HTML label

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return `$${num(v).toFixed(2)}`;
}

function computeStatsFromProducts(products) {
  const totalProducts = products.length;

  const totalCost = products.reduce((sum, p) => sum + num(p?.pricing?.cost), 0);
  const totalPrice = products.reduce(
    (sum, p) => sum + num(p?.pricing?.price),
    0,
  );

  const apc = totalProducts ? totalCost / totalProducts : 0;
  const apv = totalProducts ? totalPrice / totalProducts : 0;

  return {
    totalProducts,
    totalAssets: totalCost, // assets = sum of cost
    apc,
    apv,
    tpsSummary: 0, // for now
  };
}

function updateStatsUI(stats) {
  if (statAllProducts)
    statAllProducts.textContent = String(stats.totalProducts);
  if (statTotalAssets) statTotalAssets.textContent = money(stats.totalAssets);
  if (statAPC) statAPC.textContent = money(stats.apc);
  if (statAPV) statAPV.textContent = money(stats.apv);
  if (statTPS) statTPS.textContent = String(stats.tpsSummary);
}

// Save to Firestore (so it’s available elsewhere)
async function saveStatsToFirestore(stats) {
  try {
    const statsRef = doc(db, "express_stats", "inventory");
    await setDoc(
      statsRef,
      {
        ...stats,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("❌ Failed to save stats:", err);
  }
}

// --- 2) HELPERS ---
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ===== OFFER HELPERS =====
function offerToMs(unit, count) {
  const n = Number(count || 0);
  if (!n || n < 0) return 0;

  const u = String(unit || "").toLowerCase();

  if (u === "minutes") return n * 60 * 1000;
  if (u === "hours") return n * 60 * 60 * 1000;
  if (u === "days") return n * 24 * 60 * 60 * 1000;
  if (u === "weeks") return n * 7 * 24 * 60 * 60 * 1000;
  if (u === "months") return n * 30 * 24 * 60 * 60 * 1000; // simple month

  return 0;
}

// ===== DELIVERY HELPERS =====
function deliveryToMs(unit, count) {
  // reuse same logic as offer
  return offerToMs(unit, count);
}

function deliveryLabel(unit, count) {
  return offerLabel(unit, count);
}

function offerLabel(unit, count) {
  const n = Number(count || 0);
  if (!n) return "";
  const u = String(unit || "");
  return `${n} ${u}`;
}

function generateProductId() {
  return Date.now().toString().slice(-8);
}

function parseNumber(str) {
  if (str == null) return null;
  // remove $, commas, whitespace
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "") return null;
  const parsed = Number(n);
  return Number.isNaN(parsed) ? null : parsed;
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return (
    "pid_" +
    Date.now().toString(36) +
    "_" +
    Math.floor(Math.random() * 1e6).toString(36)
  );
}

// zip two arrays same length
function zip(a, b) {
  const out = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) out.push([a[i], b[i]]);
  return out;
}

// --- 3) FORM & SELECTORS (based on the HTML you posted) ---
const addForm = document.querySelector(
  ".product__modify--form .product__modify--container-form",
);
const editForm = document.querySelector(
  ".product__modify--edit .product__modify--container-form",
);
const saveBtn = document.querySelector(".product__add--product-software");

if (!addForm || !editForm || !saveBtn) {
  console.warn(
    "Could not find add form, edit form, or Save button. Check selectors.",
  );
}

// --- 4) BUILD PRODUCT OBJECT FROM FORM FIELDS ---
function buildProductFromForm(formEl) {
  // Category select and the "If other..." input (they are siblings in markup)
  const categorySelect = formEl.querySelector('select[name="productTag"]');
  const otherCategoryInput = categorySelect
    ? categorySelect.nextElementSibling
    : formEl.querySelector(
        'input[placeholder="If other..."], input[placeholder="If other."]',
      );

  const productNameInput =
    formEl.querySelector('input[name="porductName"]') ||
    formEl.querySelector('input[placeholder="Product Name"]');

  // Images - main image and other paste link inputs
  const mainImageInput = formEl.querySelector(
    'input[placeholder="Main Image"]',
  );
  const moreImageInputs = formEl.querySelectorAll(
    'input[placeholder="paste image link"]',
  );

  const skuInput = formEl.querySelector('input[name="SKU"]');
  const brandInput = formEl.querySelector('input[placeholder="Samsung"]');
  const categoryDetailInput = formEl.querySelector(
    'input[placeholder="Phone"]',
  );
  const originInput = formEl.querySelector(
    'input[placeholder="Leamington Express"]',
  );
  const stockLocationInput = formEl.querySelector(
    'input[placeholder="Express Suppliers"]',
  );
  const sourceNameInput = formEl.querySelector('input[placeholder="Walmart"]');
  const sourceLinkInput = formEl.querySelector(
    'input[placeholder="Paste product link"]',
  );

  const variantInput = formEl.querySelector(
    'input[placeholder="Black, White"]',
  );

  const ratingsNumberInput = formEl.querySelector(
    'input[name="ratingsNumber"]',
  );
  const starsInput = formEl.querySelector('input[name="stars"]');

  const stockInput = formEl.querySelector('input[name="stock"]');

  const expressPointsInput = formEl.querySelector(
    'input[name="ExpressPoints"]',
  );

  const offerUnitSelect = formEl.querySelector('select[name="offer"]');
  const offerCountInput = formEl.querySelector('input[name="offerCount"]');

  const deliveryUnitSelect = formEl.querySelector('select[name="delivery"]');
  const deliveryCountInput = formEl.querySelector(
    'input[name="deliveryCount"]',
  );

  const specTitleEls = Array.from(
    formEl.querySelectorAll('input[placeholder="Title"]'),
  );
  const specDescEls = Array.from(
    formEl.querySelectorAll('input[placeholder="Description"]'),
  );

  const costInput = formEl.querySelector('input[name="cost"]');
  const priceInput = formEl.querySelector('input[name="price"]');
  const currentPriceInput = formEl.querySelector('input[name="currentPrice"]');

  const product = {};

  // IDs & names
  product.productId =
    formEl.querySelector('input[name="productId"]')?.value?.trim() ||
    generateProductId();
  product.sku = (skuInput && skuInput.value.trim()) || null;
  product.name = (productNameInput && productNameInput.value.trim()) || null;

  // Category
  const categorySelectValue = categorySelect ? categorySelect.value : null;
  const otherCategoryValue = otherCategoryInput
    ? otherCategoryInput.value.trim()
    : "";
  product.category = otherCategoryValue
    ? otherCategoryValue
    : categorySelectValue;

  // detail category
  product.categoryDetail =
    (categoryDetailInput && categoryDetailInput.value.trim()) || null;

  // Images
  const imgs = [];
  if (mainImageInput && mainImageInput.value.trim())
    imgs.push(mainImageInput.value.trim());
  Array.from(moreImageInputs).forEach((inp) => {
    if (inp && inp.value && inp.value.trim()) imgs.push(inp.value.trim());
  });
  product.images = imgs;

  // Brand / source / origin
  product.brand = (brandInput && brandInput.value.trim()) || null;
  product.origin = (originInput && originInput.value.trim()) || null;
  product.stockLocation =
    (stockLocationInput && stockLocationInput.value.trim()) || null;
  product.sourceName =
    (sourceNameInput && sourceNameInput.value.trim()) || null;
  product.sourceLink =
    (sourceLinkInput && sourceLinkInput.value.trim()) || null;

  // Variants
  product.variants =
    variantInput && variantInput.value
      ? variantInput.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  // Reviews & stock
  product.ratingsNumber = parseInt(ratingsNumberInput?.value || "", 10) || 0;
  product.stars = parseFloat(starsInput?.value || "") || 0;
  product.stock = parseInt(stockInput?.value || "", 10) || 0;

  // ✅ Performance starts at 0 (sales will update it later)
  product.performance = 0;

  // ✅ DO NOT SET performance anymore
  // product.performance = ...

  // Specifications
  product.specifications = zip(
    specTitleEls.map((e) => e.value.trim()),
    specDescEls.map((e) => e.value.trim()),
  )
    .filter(([t, d]) => t || d)
    .map(([t, d]) => ({ title: t || null, description: d || null }));

  // Pricing
  const cost = parseNumber(costInput?.value || "") ?? 0;
  const price = parseNumber(priceInput?.value || "") ?? 0;
  const currentPrice = parseNumber(currentPriceInput?.value || "") ?? 0;

  product.pricing = {
    cost,
    price,
    currentPrice,
    profitRange: calculateProfitRange(cost, price, currentPrice),
  };

  // ✅ Offer
  const offerUnit = offerUnitSelect?.value.toLowerCase() || "days";
  const offerCount = Number(offerCountInput?.value || 0);

  const ms = offerToMs(offerUnit, offerCount);
  product.offer = {
    unit: offerUnit,
    count: offerCount,
    endsAt: ms ? Timestamp.fromMillis(Date.now() + ms) : null,
  };

  // ✅ Delivery
  const deliveryUnit = deliveryUnitSelect?.value.toLowerCase() || "days";
  const deliveryCount = Number(deliveryCountInput?.value || 0);
  const dms = deliveryToMs(deliveryUnit, deliveryCount);

  product.delivery = {
    unit: deliveryUnit,
    count: deliveryCount,
    arrivesAt: dms ? Timestamp.fromMillis(Date.now() + dms) : null,
  };

  // Express points 0 if blank
  product.expressPoints = Number(expressPointsInput?.value || 0);

  // Product Section Display (checkboxes)
  product.sectionDisplay = readSectionDisplayFrom(formEl);

  // metadata
  product.createdAt = serverTimestamp();

  return product;
}

// --- 5) SAVE HANDLER ---
async function handleSave(e) {
  e?.preventDefault?.();

  const product = buildProductFromForm(addForm);

  if (!product.name) {
    alert("Please provide a product name.");
    return;
  }

  try {
    const col = collection(db, "express_products");
    const docRef = await addDoc(col, {
      ...product,
      createdAt: serverTimestamp(),
    });

    alert("Product saved! ID: " + docRef.id);

    addForm.reset();
    applySectionDisplayTo(addForm, { allProducts: true });

    productModifyForm?.classList.add("hidden");
    softwarePage?.classList.remove("software__low");
  } catch (err) {
    console.error("Error saving product:", err);
    alert("Failed to save product. See console for details.");
  }
}

// Delete Document
async function deleteCurrentProduct() {
  const docId =
    (previewModal &&
      !previewModal.classList.contains("hidden") &&
      previewModal.dataset.docId) ||
    (editModal &&
      !editModal.classList.contains("hidden") &&
      editModal.dataset.docId);

  if (!docId) return;

  const ok = confirm("Delete this product permanently?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "express_products", docId));

    // remove local cache
    productsMap.delete(docId);

    // close modals
    closeModal(previewModal);
    closeModal(editModal);

    // refresh inventory
    startLiveInventory();

    console.log("✅ Deleted product:", docId);
  } catch (err) {
    console.error("❌ deleteDoc failed:", err);
    alert("Delete failed. Check console for details.");
  }
}

// attach event
saveBtn?.addEventListener("click", handleSave);

// Optional: If you want the "Generate" button in the Product Id row to populate an input,
// you can attach a handler that finds a productId input or shows the generated ID:
// (Find the "Generate" button and make it populate a hidden input or display area)
(function wireGenerateBtn() {
  if (!addForm) return;

  const generateBtn = Array.from(addForm.querySelectorAll("button")).find(
    (b) => b.textContent.trim().toLowerCase() === "generate",
  );
  if (!generateBtn) return;

  let pidInput = addForm.querySelector('input[name="productId"]');
  if (!pidInput) {
    pidInput = document.createElement("input");
    pidInput.type = "hidden";
    pidInput.name = "productId";
    addForm.appendChild(pidInput);
  }

  generateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const id = generateProductId();
    pidInput.value = id;
    alert("Generated Product ID: " + id);
  });
})();
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
// DISPLAY PRODUCTS ON INVENTORY

/***********************
 * FIREBASE (MODULAR v9)
 ***********************/

/***********************
 * DOM REFERENCES
 ***********************/
const inventoryEl = document.querySelector(".software__content--inventory");

const editModal = document.querySelector(".product__modify--edit");
const previewModal = document.querySelector(".product__modify--preview");

// Edit modal: Save button (specific class from your HTML)
const editSaveBtn = editModal?.querySelector(
  ".product__modify--footer-btnsp-form",
);
// Edit modal: Cancel button
const editCancelBtn = editModal?.querySelector(
  ".product__modify--footer-btn-form",
);
// Close buttons (both modals use same class)
const modalCloseBtns = document.querySelectorAll(".product__modify--close");

/***********************
 * STATE
 ***********************/
const productsMap = new Map(); // docId -> product object
let currentDocId = null; // which product we are editing / previewing

/***********************
 * HELPERS
 ***********************/
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function moneyProduct(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
}

function calculateProfitRange(cost, price, offer) {
  const minProfit = offer - cost;
  const maxProfit = price - cost;

  return `$${moneyProduct(minProfit)} — $${moneyProduct(maxProfit)}`;
}

function safeText(v) {
  return v === null || v === undefined ? "" : String(v);
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  softwarePage.classList.add("software__low");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  softwarePage.classList.remove("software__low");
}

const SECTION_META = [
  { key: "allProducts", label: "All products", note: "page", locked: true },
  {
    key: "mostSearched",
    label: "Most searched",
    note: "section (Max: 10 products)",
  },
  { key: "dayOffer", label: "Day offer", note: "section (Max: 5 products)" },
  { key: "fastOffer", label: "Fast Offer", note: "section (Max: 4 products)" },
  {
    key: "recommended",
    label: "Recommended",
    note: "section (Max: 10 products)",
  },
  {
    key: "EveryoneLikes",
    label: "Everyone like this ones",
    note: "section (Max: 10 products)",
  },
  {
    key: "mostBought",
    label: "Most bought",
    note: "section (Max: 10 products)",
  },
  {
    key: "bestOffers",
    label: "Best Offers",
    note: "section (Max: 4 products)",
  },
  {
    key: "events",
    label: "Events",
    note: "section (Max: 10 products)",
  },
];

function readSectionDisplayFrom(rootEl) {
  const out = {};
  SECTION_META.forEach(({ key, locked }) => {
    const el = rootEl.querySelector(`input[type="checkbox"][name="${key}"]`);
    // allProducts is ALWAYS true
    out[key] = locked ? true : !!el?.checked;
  });
  return out;
}

function applySectionDisplayTo(rootEl, sectionDisplay) {
  SECTION_META.forEach(({ key, locked }) => {
    const el = rootEl.querySelector(`input[type="checkbox"][name="${key}"]`);
    if (!el) return;

    if (locked) {
      el.checked = true;
      el.disabled = true;
      el.style.pointerEvents = "none";
    } else {
      el.checked = !!sectionDisplay?.[key];
      el.disabled = false;
      el.style.pointerEvents = "";
    }
  });
}

function renderSectionDisplayPreview(sectionDisplay) {
  return SECTION_META.map(({ key, label, note, locked }) => {
    const isAdded = locked ? true : !!sectionDisplay?.[key];

    const bg = isAdded ? "" : "background-color:#ffc9c9;";
    const border = isAdded ? "" : "border:1px solid #ff8787;";

    return `
      <div class="product__modify--form-box product__modify--form-box-vertical">
        <div class="product__modify--form-box-vertical-preview"
             style="${bg}${border}">
          ${isAdded ? "added" : "not added"}
        </div>
        <div>
          <p>${label}</p>
          <strong>${note}</strong>
        </div>
      </div>
    `;
  }).join("");
}

function setCheckbox(modalEl, name, value) {
  const el = modalEl.querySelector(`input[type="checkbox"][name="${name}"]`);
  if (!el) return;
  el.checked = !!value;
}

/***********************
 * 1) LOAD + RENDER INVENTORY
 ***********************/
/***********************
 * LIVE INVENTORY + LIVE STATS
 ***********************/
let unsubscribeProducts = null;

function startLiveInventory() {
  if (!inventoryEl) return;

  // Stop previous listener (safety)
  if (unsubscribeProducts) unsubscribeProducts();

  const colRef = collection(db, "express_products");

  unsubscribeProducts = onSnapshot(
    colRef,
    async (snap) => {
      inventoryEl.innerHTML = "";
      productsMap.clear();

      const products = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      products.forEach((p) => productsMap.set(p.id, p));

      // Render inventory
      const maxStock = Math.max(
        1,
        ...products.map((p) => Number(p.stock || 0)),
      );
      products.forEach((product) => {
        inventoryEl.appendChild(renderInventoryProduct(product, maxStock));
      });

      // Compute + show stats
      const stats = computeStatsFromProducts(products);
      updateStatsUI(stats);

      // Save stats to Firestore
      await saveStatsToFirestore(stats);

      console.log("✅ Live update:", { products: products.length, stats });
    },
    (err) => {
      console.error("❌ onSnapshot error:", err);
    },
  );
}

function renderInventoryProduct(product, maxStock) {
  const wrap = document.createElement("div");
  wrap.className = "software__content--inventory-product";

  const img0 = product.images?.[0] || "";
  const name = safeText(product.name);
  const stars = safeText(product.stars ?? "");
  const perfNum = Number(product.performance);
  const perf = Number.isFinite(perfNum) ? perfNum : 0;
  const stock = Number(product.stock || 0);

  const cost = product.pricing?.cost ?? "";
  const price = product.pricing?.price ?? "";
  const currentPrice = product.pricing?.currentPrice ?? "";
  const profitRange = calculateProfitRange(
    product.pricing?.cost || 0,
    product.pricing?.price || 0,
    product.pricing?.currentPrice || 0,
  );

  const stockWidth = clamp((stock / maxStock) * 100, 0, 100);

  wrap.innerHTML = `
    <div class="software__content--inventory-product-box">
      <img
        class="software__content--inventory-img"
        src="${img0}"
      />
      <div class="software__content--inventory-info">
        <span class="software__content--inventory-info-name">
          ${name}
        </span>
        <div class="software__content--inventory-info-review">
          <span>Review</span>
          <p>:</p>
          <p class="software__content--inventory-info-review-number">
            ${stars}
          </p>
          <ion-icon name="star"></ion-icon>
        </div>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <h4 class="software__content--inventory-product-box-heading">
        Performance
      </h4>
      <div class="software__content--inventory-product-box-bottom">
        <ion-icon name="bar-chart-outline"></ion-icon>
        <p class="software__content--inventory-product-box-cost">
          ${perf}
        </p>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <h4 class="software__content--inventory-product-box-heading">
        Stock
      </h4>
      <div class="software__content--inventory-product-box-stock">
        <span
          class="software__content--inventory-product-box-stock-line"
          style="width:${stockWidth}%; display:inline-block;"
        >${stock}</span>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <h4 class="software__content--inventory-product-box-heading">
        Product Cost
      </h4>
      <div class="software__content--inventory-product-box-bottom">
        <span>$</span>
        <p class="software__content--inventory-product-box-cost">
          ${moneyProduct(cost)}
        </p>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <h4 class="software__content--inventory-product-box-heading">
        Product Price
      </h4>
      <div class="software__content--inventory-product-box-bottom">
        <span>$</span>
        <p class="software__content--inventory-product-box-cost">
          ${moneyProduct(price)}
        </p>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <h4 class="software__content--inventory-product-box-heading">
        Offer price
      </h4>
      <div class="software__content--inventory-product-box-bottom">
        <span>$</span>
        <p class="software__content--inventory-product-box-offer">
          ${moneyProduct(currentPrice)}
        </p>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div
      style="align-items: center"
      class="software__content--inventory-product-box software__content--inventory-product-box-parallel software__content--inventory-product-box-parallel-profit"
    >
      <h4 class="software__content--inventory-product-box-heading">
        Profit Range
      </h4>
      <div class="software__content--inventory-product-box-bottom">
        <p class="software__content--inventory-product-box-cost">
          ${safeText(profitRange)}
        </p>
      </div>
    </div>

    <div class="software__content--inventory-product-sep"></div>

    <div class="software__content--inventory-product-box software__content--inventory-product-box-parallel">
      <div class="software__content--inventory-product-box-container">
        <button
          class="software__content--inventory-product-box-icbtn software__content--inventory-product-box-edit-product"
          data-id="${product.id}"
          type="button"
        >
          <ion-icon name="create-outline"></ion-icon>
        </button>

        <button
          class="software__content--inventory-product-box-icbtn software__content--inventory-product-box-preview-product"
          data-id="${product.id}"
          type="button"
        >
          <ion-icon name="eye-outline"></ion-icon>
        </button>

        <button
          class="software__content--inventory-product-box-icbtn"
          type="button"
        >
          <ion-icon name="ellipsis-horizontal"></ion-icon>
        </button>
      </div>
    </div>
  `;

  return wrap;
}

/***********************
 * 2) EDIT MODAL PREFILL
 ***********************/
function prefillEditModal(product) {
  if (!editModal) return;

  // Scope all queries to edit modal ONLY
  const q = (sel) => editModal.querySelector(sel);
  const qa = (sel) => Array.from(editModal.querySelectorAll(sel));

  // CATEGORY select + other text
  const catSelect = q('select[name="productTag"]');
  const catOther = q('input[placeholder="If other..."]');

  const category = product.category || "";
  if (catSelect) {
    const optionValues = Array.from(catSelect.options).map((o) => o.value);
    if (optionValues.includes(category)) {
      catSelect.value = category;
      if (catOther) catOther.value = "";
    } else {
      catSelect.value = "Other";
      if (catOther) catOther.value = category;
    }
  }

  // Product name (note: your input name is misspelled porductName in HTML)
  const nameInput = q('input[name="porductName"]');
  if (nameInput) nameInput.value = product.name || "";

  // Images (class .product__modify--form-box-link)
  const imageInputs = qa(".product__modify--form-box-link");
  imageInputs.forEach((inp, i) => {
    inp.value = product.images?.[i] || "";
  });

  // Product ID span (in Product Details)
  const productIdSpan = q(".product__modify--form-box-box span");
  if (productIdSpan) productIdSpan.textContent = product.productId || "";

  // SKU (has name="SKU")
  const skuInput = q('input[name="SKU"]');
  if (skuInput) skuInput.value = product.sku || "";

  // Brand (placeholder Samsung)
  const brandInput = q('input[placeholder="Samsung"]');
  if (brandInput) brandInput.value = product.brand || "";

  // Category Detail (placeholder Phone)
  const catDetailInput = q('input[placeholder="Phone"]');
  if (catDetailInput) catDetailInput.value = product.categoryDetail || "";

  // origin (placeholder Leamington Express)
  const originInput = q('input[placeholder="Leamington Express"]');
  if (originInput) originInput.value = product.origin || "";

  // stockLocation (placeholder Express Suppliers)
  const stockLocInput = q('input[placeholder="Express Suppliers"]');
  if (stockLocInput) stockLocInput.value = product.stockLocation || "";

  // sourceName (placeholder Walmart)
  const sourceNameInput = q('input[placeholder="Walmart"]');
  if (sourceNameInput) sourceNameInput.value = product.sourceName || "";

  // sourceLink (placeholder Paste product link)
  const sourceLinkInput = q('input[placeholder="Paste product link"]');
  if (sourceLinkInput) sourceLinkInput.value = product.sourceLink || "";

  // Variant input (placeholder Black, White)
  const variantInput = q('input[placeholder="Black, White"]');
  if (variantInput) variantInput.value = (product.variants || []).join(", ");

  // ratingsNumber + stars (names)
  const ratingsInput = q('input[name="ratingsNumber"]');
  if (ratingsInput) ratingsInput.value = product.ratingsNumber ?? "";

  const starsInput = q('input[name="stars"]');
  if (starsInput) starsInput.value = product.stars ?? "";

  // stock + performance
  const stockInput = q('input[name="stock"]');
  if (stockInput) stockInput.value = product.stock ?? "";

  // ✅ Offer fields
  const offerUnitSelect = q('select[name="offer"]');
  const offerCountInput = q('input[name="offerCount"]');

  if (offerUnitSelect) offerUnitSelect.value = product.offer?.unit || "days";
  if (offerCountInput) offerCountInput.value = product.offer?.count ?? "";

  // ✅ Delivery fields
  const deliveryUnitSelect = q('select[name="delivery"]');
  const deliveryCountInput = q('input[name="deliveryCount"]');

  if (deliveryUnitSelect)
    deliveryUnitSelect.value = product.delivery?.unit || "days";
  if (deliveryCountInput)
    deliveryCountInput.value = product.delivery?.count ?? "";

  // Express points
  const expressPointsInput = editModal.querySelector(
    'input[name="ExpressPoints"]',
  );
  if (expressPointsInput) expressPointsInput.value = product.expressPoints ?? 0;

  // pricing (names)
  const costInput = q('input[name="cost"]');
  const priceInput = q('input[name="price"]');
  const currentPriceInput = q('input[name="currentPrice"]');
  if (costInput) costInput.value = product.pricing?.cost ?? "";
  if (priceInput) priceInput.value = product.pricing?.price ?? "";
  if (currentPriceInput)
    currentPriceInput.value = product.pricing?.currentPrice ?? "";

  // profitRange span (display only)
  const profitSpan = q(".product__modify--form-box span");
  // careful: there are many spans; use the one near Profit Range label
  const profitRow = Array.from(
    editModal.querySelectorAll(".product__modify--form-box"),
  ).find((box) => box.querySelector('label[for="profitRange"]'));
  if (profitRow) {
    const span = profitRow.querySelector("span");
    const pr =
      product.pricing?.profitRange ||
      (product.pricing?.cost != null && product.pricing?.price != null
        ? `${money(product.pricing.cost)} - ${money(product.pricing.price)}`
        : "");
    if (span) span.textContent = pr;
  }

  // specifications (10 slots in HTML)
  const specPairs = qa(".product__modify--form-box-details");
  specPairs.forEach((pair, i) => {
    const inputs = pair.querySelectorAll("input");
    const t = inputs[0];
    const d = inputs[1];
    const spec = product.specifications?.[i];
    if (t) t.value = spec?.title || "";
    if (d) d.value = spec?.description || "";
  });

  // ---- Product Section Display (EDIT MODAL CHECKBOX PREFILL) ----
  applySectionDisplayTo(
    editForm,
    product.sectionDisplay || { allProducts: true },
  );

  // Store doc id for saving
  editModal.dataset.docId = product.id;

  wireProfitRangeLiveUpdate();
}

function wireProfitRangeLiveUpdate() {
  const costInput = editModal.querySelector('input[name="cost"]');
  const priceInput = editModal.querySelector('input[name="price"]');
  const offerInput = editModal.querySelector('input[name="currentPrice"]');

  const profitRow = Array.from(
    editModal.querySelectorAll(".product__modify--form-box"),
  ).find((box) => box.querySelector('label[for="profitRange"]'));

  const profitSpan = profitRow?.querySelector("span");

  function update() {
    const cost = Number(costInput?.value || 0);
    const price = Number(priceInput?.value || 0);
    const offer = Number(offerInput?.value || 0);

    if (profitSpan) {
      profitSpan.textContent = calculateProfitRange(cost, price, offer);
    }
  }

  costInput?.addEventListener("input", update);
  priceInput?.addEventListener("input", update);
  offerInput?.addEventListener("input", update);

  update(); // run once immediately
}

/***********************
 * 3) PREVIEW MODAL PREFILL
 ***********************/
function setPreviewRow(label, value, href) {
  if (!previewModal) return;
  const rows = Array.from(
    previewModal.querySelectorAll(".product__modify--box-details-content"),
  );
  const row = rows.find(
    (r) => r.querySelector("span")?.textContent.trim() === label,
  );
  if (!row) return;

  const a = row.querySelector("a");
  const p = row.querySelector("p");

  if (a) {
    a.textContent = safeText(value);
    if (href) a.href = href;
  } else if (p) {
    p.textContent = safeText(value);
  }
}

function prefillPreviewModal(product) {
  if (!previewModal) return;

  // Top tag + name
  const tagEl = previewModal.querySelector(".product__modify--tag");
  const nameEl = previewModal.querySelector(".product__modify--name");
  if (tagEl)
    tagEl.textContent = product.categoryDetail || product.category || "";
  if (nameEl) nameEl.textContent = product.name || "";

  // Images
  const mainImg = previewModal.querySelector(".product__modify--img-main");
  if (mainImg) mainImg.src = product.images?.[0] || "";

  const subImgs = Array.from(
    previewModal.querySelectorAll(".product__modify--img-sub"),
  );
  subImgs.forEach((img, i) => {
    const src = product.images?.[i + 1] || "";
    img.src = src;
    img.style.display = src ? "" : "none";
  });

  // Details
  setPreviewRow("SKU", product.sku);
  setPreviewRow("Product ID", product.productId);
  setPreviewRow("Brand", product.brand);
  setPreviewRow("Category", product.category);
  setPreviewRow("Origin", product.origin);
  setPreviewRow("Stock", product.stockLocation);
  setPreviewRow("Source", product.sourceName, product.sourceLink);
  setPreviewRow("Variant", (product.variants || []).join(" | "));

  // Reviews
  setPreviewRow("Ratings Number", product.ratingsNumber);
  setPreviewRow("Stars", product.stars);

  // Behaviour
  // NOTE: In your preview HTML, Behaviour section uses "Stock" and "Performance"
  // It duplicates label "Stock" already used in Details section.
  // We will update the Behaviour section by targeting the Behaviour box directly.
  const behaviourBox = Array.from(
    previewModal.querySelectorAll(".product__modify--box"),
  ).find(
    (b) =>
      b.querySelector(".product__modify--box-heading")?.textContent.trim() ===
      "Behaviour",
  );
  if (behaviourBox) {
    const rows = behaviourBox.querySelectorAll(
      ".product__modify--box-details-content",
    );
    rows.forEach((r) => {
      const label = r.querySelector("span")?.textContent.trim();
      const p = r.querySelector("p");
      if (!p) return;

      if (label === "Stock") {
        p.textContent = safeText(product.stock ?? "");
      }

      if (label === "Offer ends") {
        p.textContent =
          offerLabel(product.offer?.unit, product.offer?.count) || "";
      }

      if (label === "Delivery in") {
        p.textContent =
          deliveryLabel(product.delivery?.unit, product.delivery?.count) || "";
      }

      if (label === "Express points") {
        const pts = product.expressPoints ?? 0;
        p.textContent = `${pts} Expts`;
      }
    });
  }

  // Specifications: rebuild list
  const specsContainer = previewModal.querySelector(
    ".product__modify--desc-content",
  );
  if (specsContainer) {
    const specs = product.specifications || [];
    specsContainer.innerHTML = specs
      .map(
        (s) => `
      <div class="product__modify--desc-box">
        <span>${safeText(s.title)}</span>
        <p>${safeText(s.description)}</p>
      </div>
    `,
      )
      .join("");
  }

  // Pricing
  const pricingBox = Array.from(
    previewModal.querySelectorAll(".product__modify--box"),
  ).find(
    (b) =>
      b
        .querySelector(".product__modify--box-heading")
        ?.textContent.trim()
        .toLowerCase() === "pricing",
  );
  if (pricingBox) {
    const rows = pricingBox.querySelectorAll(
      ".product__modify--box-details-content",
    );
    rows.forEach((r) => {
      const label = r.querySelector("span")?.textContent.trim();
      const p = r.querySelector("p");
      if (!p) return;

      if (label === "Cost")
        p.textContent = `${money(product.pricing?.cost ?? "")}`;
      if (label === "price")
        p.textContent = `${money(product.pricing?.price ?? "")}`;
      if (label === "Actual Price")
        p.textContent = `${money(product.pricing?.currentPrice ?? "")}`;
      if (label === "Profit Range") {
        const cost = product.pricing?.cost || 0;
        const price = product.pricing?.price || 0;
        const offer = product.pricing?.currentPrice || 0;

        p.textContent = calculateProfitRange(cost, price, offer);
      }
    });
  }

  // Product Section Display (Preview)
  const sectionBox = Array.from(
    previewModal.querySelectorAll(".product__modify--container-box"),
  ).find(
    (b) =>
      b
        .querySelector(".product__modify--container-box-heading")
        ?.textContent.trim() === "Product Section Display",
  );

  if (sectionBox) {
    const content = sectionBox.querySelector(
      ".product__modify--container-content",
    );
    if (content) {
      content.innerHTML = renderSectionDisplayPreview(product.sectionDisplay);
    }
  }

  // store for "Edit Product" button inside preview
  previewModal.dataset.docId = product.id;
}

/***********************
 * 4) SAVE EDIT (updateDoc)
 ***********************/
function readEditModalToProduct() {
  if (!editModal) return null;

  const q = (sel) => editModal.querySelector(sel);
  const qa = (sel) => Array.from(editModal.querySelectorAll(sel));

  const docId = editModal.dataset.docId;
  if (!docId) return null;

  const product = productsMap.get(docId);
  if (!product) return null;

  // Category
  const catSelect = q('select[name="productTag"]');
  const catOther = q('input[placeholder="If other..."]');
  let category = catSelect ? catSelect.value : product.category || "";
  if (category === "Other" && catOther?.value.trim())
    category = catOther.value.trim();

  // name
  const name = q('input[name="porductName"]')?.value.trim() || "";

  // images
  const images = qa(".product__modify--form-box-link")
    .map((i) => i.value.trim())
    .filter(Boolean);

  // sku
  const sku = q('input[name="SKU"]')?.value.trim() || "";

  // brand, categoryDetail, origin, stockLocation, sourceName, sourceLink
  const brand = q('input[placeholder="Samsung"]')?.value.trim() || "";
  const categoryDetail = q('input[placeholder="Phone"]')?.value.trim() || "";
  const origin =
    q('input[placeholder="Leamington Express"]')?.value.trim() || "";
  const stockLocation =
    q('input[placeholder="Express Suppliers"]')?.value.trim() || "";
  const sourceName = q('input[placeholder="Walmart"]')?.value.trim() || "";
  const sourceLink =
    q('input[placeholder="Paste product link"]')?.value.trim() || "";

  // variants
  const variantStr = q('input[placeholder="Black, White"]')?.value || "";
  const variants = variantStr
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  // ratings, stars, stock, performance
  const ratingsNumber = Number(q('input[name="ratingsNumber"]')?.value || 0);
  const stars = Number(q('input[name="stars"]')?.value || 0);
  const stock = Number(q('input[name="stock"]')?.value || 0);
  // ✅ Offer (EDIT) - always re-save offer when editing
  const offerUnit = q('select[name="offer"]')?.value.toLowerCase() || "days";
  const offerCount = Number(q('input[name="offerCount"]')?.value || 0);

  const ms = offerToMs(offerUnit, offerCount);

  const offer = {
    unit: offerUnit,
    count: offerCount,
    endsAt: ms ? Timestamp.fromMillis(Date.now() + ms) : null,
  };

  // ✅ Delivery (EDIT)
  const deliveryUnit =
    q('select[name="delivery"]')?.value.toLowerCase() || "days";
  const deliveryCount = Number(q('input[name="deliveryCount"]')?.value || 0);

  const dms = deliveryToMs(deliveryUnit, deliveryCount);

  const delivery = {
    unit: deliveryUnit,
    count: deliveryCount,
    arrivesAt: dms ? Timestamp.fromMillis(Date.now() + dms) : null,
  };

  // Express Points
  const expressPoints = Number(q('input[name="ExpressPoints"]')?.value || 0);

  // pricing
  const cost = Number(q('input[name="cost"]')?.value || 0);
  const price = Number(q('input[name="price"]')?.value || 0);
  const currentPrice = Number(q('input[name="currentPrice"]')?.value || 0);
  const profitRange = calculateProfitRange(cost, price, currentPrice);

  const sectionDisplay = readSectionDisplayFrom(editForm);

  // specs (keep only filled)
  const specifications = qa(".product__modify--form-box-details")
    .map((pair) => {
      const inputs = pair.querySelectorAll("input");
      const title = (inputs[0]?.value || "").trim();
      const description = (inputs[1]?.value || "").trim();
      return { title, description };
    })
    .filter((s) => s.title || s.description);

  // Build update (match your firestore structure)
  const updated = {
    category,
    name,
    images,
    sku,
    brand,
    categoryDetail,
    origin,
    stockLocation,
    offer,
    delivery,
    sourceName,
    sourceLink,
    variants,
    ratingsNumber,
    stars,
    stock,
    specifications,
    sectionDisplay,
    expressPoints,
    pricing: {
      cost,
      price,
      currentPrice,
      profitRange,
    },
  };

  return { docId, updated };
}

async function saveEditToFirestore(e) {
  e?.preventDefault?.();

  const data = readEditModalToProduct();
  if (!data) return;

  const { docId, updated } = data;

  try {
    const ref = doc(db, "express_products", docId);
    await updateDoc(ref, updated);

    // update local cache
    const prev = productsMap.get(docId) || {};
    productsMap.set(docId, { ...prev, ...updated });

    // close edit, refresh inventory
    closeModal(editModal);
    startLiveInventory();

    // If preview is open for same product, refresh preview too
    if (
      previewModal &&
      !previewModal.classList.contains("hidden") &&
      previewModal.dataset.docId === docId
    ) {
      prefillPreviewModal(productsMap.get(docId));
    }

    console.log("✅ Updated product:", docId, updated);
  } catch (err) {
    console.error("❌ updateDoc failed:", err);
    alert("Update failed. Check console for details.");
  }
}

/***********************
 * 5) EVENTS: inventory buttons, modal buttons
 ***********************/
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest(
    ".software__content--inventory-product-box-edit-product",
  );
  const prevBtn = e.target.closest(
    ".software__content--inventory-product-box-preview-product",
  );

  // Inventory -> Edit
  if (editBtn) {
    const id = editBtn.dataset.id;
    const product = productsMap.get(id);
    if (!product) return;
    currentDocId = id;
    prefillEditModal(product);
    openModal(editModal);
    return;
  }

  // Inventory -> Preview
  if (prevBtn) {
    const id = prevBtn.dataset.id;
    const product = productsMap.get(id);
    if (!product) return;
    currentDocId = id;
    prefillPreviewModal(product);
    openModal(previewModal);
    return;
  }

  // Preview -> "Edit Product" button in footer
  const previewEditBtn = e.target.closest(
    ".product__modify--preview .product__modify--footer-btn",
  );
  if (previewEditBtn) {
    const id = previewModal?.dataset.docId;
    const product = productsMap.get(id);
    if (!product) return;

    closeModal(previewModal);
    prefillEditModal(product);
    openModal(editModal);
    return;
  }

  // Preview -> Trash delete button
  const trashBtn = e.target.closest(
    ".product__modify--preview .product__modify--footer-erase",
  );
  if (trashBtn) {
    e.preventDefault();
    deleteCurrentProduct();
    return;
  }
});

// Save in edit modal
if (editSaveBtn) editSaveBtn.addEventListener("click", saveEditToFirestore);

// Cancel in edit modal
if (editCancelBtn)
  editCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(editModal);
  });

// Close buttons (both modals)
modalCloseBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(editModal);
    closeModal(previewModal);
  });
});

/***********************
 * INIT
 ***********************/
startLiveInventory();
