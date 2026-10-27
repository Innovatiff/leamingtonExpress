"use strict";

/* =========================================================
   GLOBAL HEADER / PHONE SEARCH / PHONE CART BADGE
   This file is safe to use on every page.
========================================================= */

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { getGuestCart } from "./guestCart.js";

/* =========================================================
   FIREBASE
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBgrPM2Pe3jP6N6pfqAqHROY0mXSEPJBRA",
  authDomain: "express-corp.firebaseapp.com",
  projectId: "express-corp",
  storageBucket: "express-corp.firebasestorage.app",
  messagingSenderId: "499821040541",
  appId: "1:499821040541:web:e3347ca4ff4c4dc84e1574",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================================================
   HELPERS
========================================================= */
function cleanStr(v) {
  return (v ?? "").toString().trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseMoney(val) {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return parseMoney(v).toFixed(2);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dedupeStrings(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function formatPhoneNumber(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)} - ${digits.slice(7)}`;
  }

  return String(phone).trim();
}

function pickFirstName(fullName) {
  const name = cleanStr(fullName);
  if (!name) return "";
  return name.split(/\s+/)[0];
}

/* =========================================================
   DEFAULT AUTH PERSISTENCE
========================================================= */
// await setPersistence(auth, browserLocalPersistence);
// (async function defaultPersistence() {
//   try {
//     await setPersistence(auth, browserLocalPersistence);
//   } catch (e) {
//     console.warn("Persistence not set:", e);
//   }
// })();

/* =========================================================
   PHONE CART BADGE / TOTAL
   Safe on every page
========================================================= */
const phoneCartBtn = document.querySelector("#cartBtn");
let phoneCartBadge = null;

function ensurePhoneCartBadge() {
  if (!phoneCartBtn) return null;

  let badge = phoneCartBtn.querySelector(".phheader__user--badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "phheader__user--badge hidden";
    badge.style.position = "absolute";
    badge.style.top = "-0.4rem";
    badge.style.right = "-0.4rem";
    badge.style.minWidth = "1.8rem";
    badge.style.height = "1.8rem";
    badge.style.padding = "0 0.4rem";
    badge.style.borderRadius = "999rem";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.fontSize = "1rem";
    badge.style.fontWeight = "700";
    badge.style.background = "#2563eb";
    badge.style.color = "#fff";

    const computedPosition = window.getComputedStyle(phoneCartBtn).position;
    if (computedPosition === "static") {
      phoneCartBtn.style.position = "relative";
    }

    phoneCartBtn.appendChild(badge);
  }

  phoneCartBadge = badge;
  return badge;
}

function normalizeCartItem(item) {
  const qty = Math.max(1, Math.floor(num(item?.qty ?? item?.quantity ?? 1)));
  const price =
    parseMoney(item?.price) ||
    parseMoney(item?.currentPrice) ||
    parseMoney(item?.actualPrice) ||
    parseMoney(item?.pricing?.currentPrice) ||
    0;

  return {
    qty,
    price,
  };
}

function calcCartCount(cart = []) {
  return cart.reduce((sum, item) => {
    const c = normalizeCartItem(item);
    return sum + c.qty;
  }, 0);
}

function calcCartSubtotal(cart = []) {
  return cart.reduce((sum, item) => {
    const c = normalizeCartItem(item);
    return sum + c.qty * c.price;
  }, 0);
}

function renderPhoneCartBadge(cart = []) {
  const badge = ensurePhoneCartBadge();
  if (!badge) return;

  const count = calcCartCount(cart);

  if (count <= 0) {
    badge.classList.add("hidden");
    badge.textContent = "";
    return;
  }

  badge.classList.remove("hidden");
  badge.textContent = count > 99 ? "99+" : String(count);
}

/* =========================================================
   LEGACY DESKTOP HEADER SUPPORT
   Safe if old selectors still exist on some pages
========================================================= */
const headerUserLabel = document.querySelector(
  ".header__store--cart-user .header__store--side span",
);
const headerUserAction = document.querySelector(
  ".header__store--cart .header__store--account",
);
const headerAddressWrap = document.querySelector(".header__personal--address");
const headerAddressText = headerAddressWrap?.querySelector("span");
const headerPhoneWrap = document.querySelector(".header__personal--number");
const headerPhoneText = headerPhoneWrap?.querySelector("span");
const headerSep = document.querySelector(".header__personal--sep");
const accountUserModalWrap = document.querySelector(".account__user");
const accountSignupModal = document.querySelector(".account__signup");
const accountLoginModal = document.querySelector(".account__login");
const headerCartAmountEl = document.querySelector(
  ".header__store--cart-amount",
);
const cartSubTotalEl = document.querySelector(".cart__summary--sub-total p");
const cartYouSaveEl = document.querySelector(
  ".cart__summary--sub-total-saved p",
);

function renderHeaderUser(userData) {
  const ui = userData?.userInformation || {};
  const first = cleanStr(ui.firstName || userData?.firstName || "");
  const signupName = cleanStr(userData?.name || userData?.Name || "");

  let displayName = "";
  if (first) displayName = first;
  else if (signupName) displayName = pickFirstName(signupName);
  else displayName = "User";

  if (headerUserLabel) headerUserLabel.textContent = displayName;
  if (headerUserAction) headerUserAction.textContent = "My account";
}

function renderHeaderContact(userData) {
  const addressObj = userData?.address || {};
  const ui = userData?.userInformation || {};

  const city = cleanStr(addressObj.city || addressObj.cityProvince || "");
  const home = cleanStr(addressObj.homeAddress || "");
  const postal = cleanStr(addressObj.postalCode || "");

  let addressLine = "";
  if (home && city && postal) addressLine = `${home}, ${city} ${postal}`;
  else if (home && city) addressLine = `${home}, ${city}`;
  else if (city) addressLine = city;

  const phoneRaw = cleanStr(ui.phoneNumber || userData?.phoneNumber || "");
  const phoneLine = formatPhoneNumber(phoneRaw);

  const hasAddress = Boolean(addressLine);
  const hasPhone = Boolean(phoneLine);

  if (headerAddressWrap) {
    if (hasAddress) {
      headerAddressWrap.classList.remove("hidden");
      if (headerAddressText) headerAddressText.textContent = addressLine;
    } else {
      headerAddressWrap.classList.add("hidden");
    }
  }

  if (headerPhoneWrap) {
    if (hasPhone) {
      headerPhoneWrap.classList.remove("hidden");
      if (headerPhoneText) headerPhoneText.textContent = phoneLine;
    } else {
      headerPhoneWrap.classList.add("hidden");
    }
  }

  if (headerSep) {
    if (hasAddress && hasPhone) headerSep.classList.remove("hidden");
    else headerSep.classList.add("hidden");
  }
}

function showLoginFirstIfOnAccountPage() {
  if (!accountSignupModal || !accountLoginModal) return;
  accountLoginModal.classList.remove("hidden");
  accountSignupModal.classList.add("hidden");
}

function setAuthModalsHidden(isHidden) {
  if (!accountUserModalWrap) return;
  accountUserModalWrap.classList.toggle("hidden", Boolean(isHidden));
}

function renderDesktopCartTotals({ subtotal, youSave }) {
  if (headerCartAmountEl)
    headerCartAmountEl.textContent = `$ ${money(subtotal)}`;
  if (cartSubTotalEl) cartSubTotalEl.textContent = `$${money(subtotal)}`;
  if (cartYouSaveEl) cartYouSaveEl.textContent = `$${money(youSave)}`;
}

function calcDesktopCartTotals(cart = []) {
  let subtotal = 0;
  let totalOld = 0;

  for (const item of cart) {
    const qty = Math.max(1, Math.floor(num(item?.qty ?? item?.quantity ?? 1)));
    const price =
      parseMoney(item?.price) ||
      parseMoney(item?.currentPrice) ||
      parseMoney(item?.productPrice) ||
      parseMoney(item?.cost) ||
      0;

    const oldP =
      parseMoney(item?.oldPrice) ||
      parseMoney(item?.previousPrice) ||
      parseMoney(item?.wasPrice) ||
      0;

    subtotal += price * qty;
    totalOld += oldP * qty;
  }

  return {
    subtotal,
    youSave: Math.max(0, totalOld - subtotal),
  };
}

/* =========================================================
   HEADER LIVE VISITS
========================================================= */
const numberDisplay = document.querySelector(".header__stats--number");

if (numberDisplay) {
  function getRangeByTime() {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 8) return [100, 500];
    if (hour >= 8 && hour < 12) return [500, 1200];
    if (hour >= 12 && hour < 17) return [1200, 3000];
    if (hour >= 17 && hour < 20) return [3000, 5000];
    return [100, 1000];
  }

  function formatNumber(numValue) {
    return numValue.toLocaleString("en-US");
  }

  const savedNumber = parseInt(localStorage.getItem("headerNumber"));
  const [min, max] = getRangeByTime();
  let currentNumber =
    !isNaN(savedNumber) && savedNumber >= min && savedNumber <= max
      ? savedNumber
      : Math.floor(Math.random() * (max - min + 1)) + min;

  numberDisplay.textContent = formatNumber(currentNumber);
  localStorage.setItem("headerNumber", currentNumber);

  function updateNumber() {
    const [rangeMin, rangeMax] = getRangeByTime();
    const target =
      Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;

    const diff = target - currentNumber;
    let change = Math.floor(diff * 0.05);

    if (change === 0) change = diff > 0 ? 1 : -1;
    change += Math.floor(Math.random() * 5 - 2);

    currentNumber = Math.max(
      rangeMin,
      Math.min(rangeMax, currentNumber + change),
    );
    numberDisplay.textContent = formatNumber(currentNumber);
    localStorage.setItem("headerNumber", currentNumber);

    const nextUpdate = Math.floor(Math.random() * (20000 - 10000)) + 10000;
    setTimeout(updateNumber, nextUpdate);
  }

  const firstUpdate = Math.floor(Math.random() * (20000 - 10000)) + 10000;
  setTimeout(updateNumber, firstUpdate);
}

/* =========================================================
   PHONE SEARCH PANEL
========================================================= */
const PHONE_SEARCH_STORAGE_KEY = "express_phone_recent_searches_v1";
const PHONE_SEARCH_MAX_RECENT = 6;
const PHONE_SEARCH_MAX_SUGGESTIONS = 8;

const phoneHeaderSearchWrap = document.querySelector(".phheader__search");
const phoneHeaderSearchInput = document.querySelector(
  ".phheader__search input",
);

const phoneHeaderPanel = document.querySelector(".phheader__panel");
const phoneHeaderPanelInput = document.querySelector(
  ".phheader__panel--search input",
);
const phoneHeaderPanelCancel = document.querySelector(
  ".phheader__panel--cancel",
);

const phoneHeaderPanelResults = document.querySelectorAll(
  ".phheader__panel--results",
);
const phoneHeaderLiveResults = phoneHeaderPanelResults[0] || null;
const phoneHeaderRecentTitle = document.querySelector(".phheader__panel h4");
const phoneHeaderRecentResults = phoneHeaderPanelResults[1] || null;

let phoneSearchProducts = [];
let phoneSearchLoaded = false;
let phoneSearchBound = false;

const PHONE_SEARCH_SUGGESTIONS = [
  "Samsung",
  "Samsung Galaxy",
  "Samsung S24",
  "Samsung S24 Ultra",
  "Samsung S25",
  "Samsung S25 Ultra",
  "Samsung TV",
  "Samsung audifonos",
  "Samsung headphones",
  "Apple",
  "Apple Watch",
  "Apple Watch Ultra 2",
  "Apple AirPods",
  "Apple AirPods Pro",
  "Apple iPhone",
  "Apple iPad",
  "Apple audifonos",
  "JBL",
  "JBL speaker",
  "JBL bocinas",
  "JBL headphones",
  "Sony",
  "Sony headphones",
  "Sony audifonos",
  "Sony bocinas",
  "Beats",
  "Beats Solo",
  "Beats headphones",
  "Philips",
  "Philips TV",
  "Roku TV",
  "Smart TV",
  "TV",
  "Television",
  "Televisor",
  "Pantalla",
  "Pantallas",
  "Bocina",
  "Bocinas",
  "Speaker",
  "Speakers",
  "Audifonos",
  "Auriculares",
  "Headphones",
  "Earbuds",
  "AirPods",
  "Telefono",
  "Telefonos",
  "Celular",
  "Celulares",
  "Smartphone",
  "Tablet",
  "Tableta",
  "iPad",
  "Reloj inteligente",
  "Smartwatch",
  "Electronicos",
  "Casa",
  "Hogar",
  "Ofertas",
  "Mejores ofertas",
  "Ofertas rapidas",
  "Recomendado",
];

const PHONE_SEARCH_SYNONYMS = {
  audifonos: ["headphones", "earbuds", "airpods", "auriculares"],
  auriculares: ["headphones", "earbuds", "airpods", "audifonos"],
  bocina: ["speaker", "speakers", "bocinas", "jbl", "sony"],
  bocinas: ["speaker", "speakers", "bocina", "jbl", "sony"],
  telefono: ["phone", "smartphone", "iphone", "samsung"],
  telefonos: ["phone", "smartphone", "iphone", "samsung"],
  celular: ["phone", "smartphone", "iphone", "samsung"],
  celulares: ["phone", "smartphone", "iphone", "samsung"],
  televisor: ["tv", "television", "smart tv", "pantalla"],
  television: ["tv", "televisor", "smart tv", "pantalla"],
  pantalla: ["tv", "television", "smart tv"],
  pantallas: ["tv", "television", "smart tv"],
  reloj: ["smartwatch", "apple watch"],
  smartwatch: ["apple watch", "reloj inteligente"],
  electronicos: ["electronics", "tv", "headphones", "speaker", "smartwatch"],
  casa: ["hogar", "home"],
  hogar: ["casa", "home"],
};

function normalizePhoneSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getPhoneRecentSearches() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(PHONE_SEARCH_STORAGE_KEY) || "[]",
    );
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function savePhoneRecentSearch(term) {
  const clean = cleanStr(term);
  if (!clean) return;

  const current = getPhoneRecentSearches().filter(
    (item) =>
      normalizePhoneSearchText(item) !== normalizePhoneSearchText(clean),
  );

  current.unshift(clean);

  localStorage.setItem(
    PHONE_SEARCH_STORAGE_KEY,
    JSON.stringify(current.slice(0, PHONE_SEARCH_MAX_RECENT)),
  );
}

function getSearchProductName(product) {
  return (
    product?.name ||
    product?.productName ||
    product?.porductName ||
    product?.title ||
    ""
  );
}

function getSearchProductBrand(product) {
  return product?.brand || product?.Brand || "";
}

function getSearchProductCategory(product) {
  return product?.category || "";
}

function getSearchProductCategoryDetail(product) {
  return product?.categoryDetail || "";
}

function buildPhoneSearchTokens(product) {
  const base = [
    getSearchProductName(product),
    getSearchProductBrand(product),
    getSearchProductCategory(product),
    getSearchProductCategoryDetail(product),
  ].filter(Boolean);

  const normalized = base.map(normalizePhoneSearchText);
  const expanded = [...base];

  normalized.forEach((token) => {
    if (PHONE_SEARCH_SYNONYMS[token]) {
      expanded.push(...PHONE_SEARCH_SYNONYMS[token]);
    }
  });

  if (normalized.some((x) => x.includes("speaker"))) {
    expanded.push("bocina", "bocinas", "parlante");
  }

  if (
    normalized.some(
      (x) =>
        x.includes("headphone") ||
        x.includes("airpods") ||
        x.includes("earbuds"),
    )
  ) {
    expanded.push("audifonos", "auriculares");
  }

  if (normalized.some((x) => x.includes("tv") || x.includes("television"))) {
    expanded.push("televisor", "television", "pantalla", "smart tv");
  }

  return dedupeStrings(expanded);
}

async function loadPhoneSearchProducts() {
  if (phoneSearchLoaded) return phoneSearchProducts;

  try {
    const snap = await getDocs(collection(db, "express_products"));
    phoneSearchProducts = snap.docs.map((docSnap) => ({
      ...docSnap.data(),
      id: docSnap.id,
    }));
    phoneSearchLoaded = true;
  } catch (err) {
    console.error("❌ Phone search load failed:", err);
    phoneSearchProducts = [];
  }

  return phoneSearchProducts;
}

function getPhoneSmartSuggestions(query) {
  const q = normalizePhoneSearchText(query);
  if (!q) return [];

  const staticPool = [...PHONE_SEARCH_SUGGESTIONS];
  const dynamicPool = [];

  phoneSearchProducts.forEach((product) => {
    dynamicPool.push(...buildPhoneSearchTokens(product));
  });

  const pool = dedupeStrings([...staticPool, ...dynamicPool]);

  const startsWith = [];
  const contains = [];

  pool.forEach((item) => {
    const normalizedItem = normalizePhoneSearchText(item);
    if (!normalizedItem) return;

    const synonymHits = PHONE_SEARCH_SYNONYMS[q] || [];
    const synonymMatch = synonymHits.some((syn) =>
      normalizedItem.includes(normalizePhoneSearchText(syn)),
    );

    if (normalizedItem.startsWith(q)) {
      startsWith.push(item);
      return;
    }

    if (normalizedItem.includes(q) || synonymMatch) {
      contains.push(item);
    }
  });

  return dedupeStrings([...startsWith, ...contains]).slice(
    0,
    PHONE_SEARCH_MAX_SUGGESTIONS,
  );
}

function goToPhoneSearchResults(term) {
  const clean = cleanStr(term);
  if (!clean) return;

  savePhoneRecentSearch(clean);
  window.location.href = `products.html?q=${encodeURIComponent(clean)}`;
}

function createPhoneLiveResultRow(text) {
  const row = document.createElement("div");
  row.className = "phheader__panel--results-box";
  row.innerHTML = `
    <span>${escapeHtml(text)}</span><i class="ph ph-arrow-up-right"></i>
  `;

  row.addEventListener("click", () => {
    goToPhoneSearchResults(text);
  });

  return row;
}

function createPhoneRecentResultRow(text) {
  const row = document.createElement("div");
  row.className = "phheader__panel--results-box";
  row.innerHTML = `
    <div class="phheader__panel--results-box-top">
      <i class="ph ph-clock-countdown"></i>
      <span>${escapeHtml(text)}</span>
    </div>
    <i class="ph ph-arrow-up-right"></i>
  `;

  row.addEventListener("click", () => {
    goToPhoneSearchResults(text);
  });

  return row;
}

function renderPhoneLiveSuggestions(query) {
  if (!phoneHeaderLiveResults) return;

  phoneHeaderLiveResults.innerHTML = "";

  const suggestions = getPhoneSmartSuggestions(query);

  suggestions.forEach((text) => {
    phoneHeaderLiveResults.appendChild(createPhoneLiveResultRow(text));
  });

  if (!suggestions.length) {
    const fallback = document.createElement("div");
    fallback.className = "phheader__panel--results-box";
    fallback.innerHTML = `
      <span>Buscar "${escapeHtml(query)}"</span><i class="ph ph-arrow-up-right"></i>
    `;
    fallback.addEventListener("click", () => {
      goToPhoneSearchResults(query);
    });
    phoneHeaderLiveResults.appendChild(fallback);
  }

  phoneHeaderLiveResults.classList.remove("hidden");
}

function renderPhoneRecentSearches() {
  if (!phoneHeaderRecentTitle || !phoneHeaderRecentResults) return;

  const recent = getPhoneRecentSearches();
  phoneHeaderRecentResults.innerHTML = "";

  if (!recent.length) {
    phoneHeaderRecentTitle.classList.add("hidden");
    phoneHeaderRecentResults.classList.add("hidden");
    return;
  }

  recent.forEach((term) => {
    phoneHeaderRecentResults.appendChild(createPhoneRecentResultRow(term));
  });

  phoneHeaderRecentTitle.classList.remove("hidden");
  phoneHeaderRecentResults.classList.remove("hidden");
}

function renderPhoneDefaultSuggestions() {
  if (!phoneHeaderLiveResults) return;

  const defaults = ["Samsung", "Headphones", "Audifonos", "Telefonos"];
  phoneHeaderLiveResults.innerHTML = "";

  defaults.forEach((text) => {
    phoneHeaderLiveResults.appendChild(createPhoneLiveResultRow(text));
  });

  phoneHeaderLiveResults.classList.remove("hidden");
}

function refreshPhoneSearchPanel() {
  const value = cleanStr(phoneHeaderPanelInput?.value || "");

  if (value) {
    renderPhoneLiveSuggestions(value);
    phoneHeaderRecentTitle?.classList.add("hidden");
    phoneHeaderRecentResults?.classList.add("hidden");
    return;
  }

  renderPhoneDefaultSuggestions();
  renderPhoneRecentSearches();
}

function openPhoneSearchPanel() {
  if (!phoneHeaderPanel) return;

  phoneHeaderPanel.classList.remove("hidden");

  if (phoneHeaderPanelInput) {
    phoneHeaderPanelInput.value = cleanStr(phoneHeaderSearchInput?.value || "");
    phoneHeaderPanelInput.focus();
    phoneHeaderPanelInput.setSelectionRange(
      phoneHeaderPanelInput.value.length,
      phoneHeaderPanelInput.value.length,
    );
  }

  refreshPhoneSearchPanel();
}

function closePhoneSearchPanel() {
  if (!phoneHeaderPanel) return;

  phoneHeaderPanel.classList.add("hidden");

  if (phoneHeaderPanelInput) phoneHeaderPanelInput.value = "";
  refreshPhoneSearchPanel();
}

function wirePhoneSearchPanel() {
  if (phoneSearchBound) return;
  phoneSearchBound = true;

  if (!phoneHeaderPanel || !phoneHeaderSearchWrap || !phoneHeaderPanelInput)
    return;

  function bindOpenSearchPanel() {
    if (!phoneHeaderSearchWrap) return;

    const openFromHeaderSearch = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPhoneSearchPanel();
    };

    // Open when clicking anywhere inside .phheader__search
    phoneHeaderSearchWrap.addEventListener("pointerdown", openFromHeaderSearch);
    phoneHeaderSearchWrap.addEventListener("click", openFromHeaderSearch);

    // Extra safety for children like the input
    phoneHeaderSearchWrap.querySelectorAll("*").forEach((child) => {
      child.addEventListener("pointerdown", openFromHeaderSearch);
      child.addEventListener("click", openFromHeaderSearch);
    });

    // Open on keyboard/tab focus too
    phoneHeaderSearchInput?.addEventListener("focus", () => {
      openPhoneSearchPanel();
    });
  }

  phoneHeaderPanelCancel?.addEventListener("click", () => {
    closePhoneSearchPanel();
  });

  phoneHeaderPanelInput.addEventListener("input", () => {
    refreshPhoneSearchPanel();
  });

  phoneHeaderPanelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = cleanStr(phoneHeaderPanelInput.value);
      if (term) goToPhoneSearchResults(term);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      phoneHeaderPanel &&
      !phoneHeaderPanel.classList.contains("hidden")
    ) {
      closePhoneSearchPanel();
    }
  });

  document.addEventListener("click", (e) => {
    if (!phoneHeaderPanel || phoneHeaderPanel.classList.contains("hidden"))
      return;

    const insidePanel = e.target.closest(".phheader__panel");
    const insideSearch = e.target.closest(".phheader__search");

    if (!insidePanel && !insideSearch) {
      closePhoneSearchPanel();
    }
  });

  bindOpenSearchPanel();
}

async function initPhoneSearch() {
  if (!phoneHeaderPanel) return;

  await loadPhoneSearchProducts();
  wirePhoneSearchPanel();
  refreshPhoneSearchPanel();
}

/* =========================================================
   AUTH + LIVE CART
========================================================= */
let unsubscribeUserDoc = null;
let unsubscribeCartListener = null;

function stopUserDocListener() {
  if (typeof unsubscribeUserDoc === "function") {
    unsubscribeUserDoc();
    unsubscribeUserDoc = null;
  }
}

function stopCartListener() {
  if (typeof unsubscribeCartListener === "function") {
    unsubscribeCartListener();
    unsubscribeCartListener = null;
  }

  renderDesktopCartTotals({ subtotal: 0, youSave: 0 });
  renderPhoneCartBadge(getGuestCart());
}

function startCartListener(uid) {
  stopCartListener();

  const userRef = doc(db, "users", uid);

  unsubscribeCartListener = onSnapshot(
    userRef,
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const cart = Array.isArray(data?.cart) ? data.cart : [];

      const totals = calcDesktopCartTotals(cart);
      renderDesktopCartTotals(totals);
      renderPhoneCartBadge(cart);
    },
    (err) => {
      console.error("❌ Cart listener error:", err);
    },
  );
}

onAuthStateChanged(auth, async (user) => {
  stopUserDocListener();

  if (!user) {
    setAuthModalsHidden(false);
    showLoginFirstIfOnAccountPage();

    stopCartListener();
    renderPhoneCartBadge(getGuestCart());
    return;
  }

  setAuthModalsHidden(true);

  const userRef = doc(db, "users", user.uid);

  unsubscribeUserDoc = onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      console.log("✅ Signed-in user doc:", { uid: user.uid, ...data });

      renderHeaderUser(data);
      renderHeaderContact(data);
    },
    (err) => {
      console.error("❌ onSnapshot users failed:", err);
    },
  );

  startCartListener(user.uid);
});

/* =========================================================
   INIT
========================================================= */
ensurePhoneCartBadge();
renderPhoneCartBadge(getGuestCart());
initPhoneSearch();

export { renderHeaderUser, renderHeaderContact, formatPhoneNumber };
