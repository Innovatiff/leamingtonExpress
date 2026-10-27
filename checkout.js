"use strict";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteField,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getGuestCart,
  getGuestBuyNow,
  clearGuestBuyNow,
  clearGuestCart,
} from "./guestCart.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   DOM
========================= */
const addressChangeBtn = document.querySelector(
  ".phcheckout__box--top-btn-address",
);

const addressMainEl = document.querySelector(
  ".phcheckout__info--template-main",
);
const addressNameEl = document.querySelector(
  ".phcheckout__info--template-other-name",
);
const addressStreetEl = document.querySelector(
  ".phcheckout__info--template-other-address",
);
const addressCityEl = document.querySelector(
  ".phcheckout__info--template-other-city",
);
const addressPhoneEl = document.querySelector(
  ".phcheckout__info--template-other-number",
);

const shippingPriceEl = document.querySelector(
  ".phcheckout__info--template-limit p",
);

const paymentRows = Array.from(
  document.querySelectorAll(
    ".phcheckout__box:nth-of-type(3) .phcheckout__info",
  ),
);

const subtotalEl = document.querySelector(".phcheckout__order--box-subtotal");
const savingsEl = document.querySelector(".phcheckout__order--box-delivery");
const taxEl = document.querySelector(".phcheckout__order--box-tax");
const totalEl = document.querySelector(".phcheckout__order--box-total");

const discountRowEl = document.querySelector(
  ".phcheckout__order--box-discount",
);

const discountTextEl = discountRowEl?.querySelector("span");
const discountAmountEl = discountRowEl?.querySelector("p");

const savingsCheckoutEl = document.querySelector(
  ".phcheckout__order--box-saved",
);

const placeOrderBtn = document.querySelector(".phcheckout__place");
const placeOrderTextEl = document.querySelector(".phcart__checkout--buy");
const placeOrderUrgencyEl = document.querySelector(
  ".phcart__checkout--urgency",
);

const checkoutPanel = document.querySelector(".phcheckout__panel");
const checkoutPanelSubmitBtn = document.querySelector(
  ".phcheckout__panel--submit",
);
const checkoutPanelCancelBtn = document.querySelector(
  ".phcheckout__panel--cancel",
);

const guestFullNameInput = document.querySelector(
  '.phcheckout__panel input[name="fullName"]',
);
const guestAddressInput = document.querySelector(
  '.phcheckout__panel input[name="address"]',
);
const guestPostalCodeInput = document.querySelector(
  '.phcheckout__panel input[name="postalCode"]',
);
const guestPhoneInput = document.querySelector(
  '.phcheckout__panel input[name="phoneNumber"]',
);

/* DISCOUNT DOM */
const discountCheckoutBoxEl = document.querySelector(
  ".phcheckout__content .phcheckout__box:nth-of-type(4)",
);
const discountCodeLabelEl = document.querySelector(
  ".phcheckout__info--template-discount strong",
);
const discountAmountLabelEl = document.querySelector(
  ".phcheckout__info--template-discount-amount",
);

/* =========================
   CONSTANTS
========================= */
const SHIPPING_COST = 5.0;
const TAX_RATE = 0.0;
const GUEST_CHECKOUT_INFO_KEY = "express_guest_checkout_info_v1";
const CHECKOUT_PROMO_KEY = "express_checkout_promo";

/* =========================
   STATE
========================= */
let liveCart = [];
let checkoutMode = "cart";
let currentUserData = null;
let currentAuthUser = null;
let selectedPaymentMethod = "cash";
let appliedPromo = null;

/* =========================
   HELPERS
========================= */
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
  const n = Number(String(val).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(val) {
  return `$${parseMoney(val).toFixed(2)}`;
}

function formatPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
  }
  return input || "";
}

function restoreCheckoutPromo() {
  try {
    const raw = localStorage.getItem(CHECKOUT_PROMO_KEY);
    if (!raw) {
      appliedPromo = null;
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.code) {
      appliedPromo = null;
      return;
    }

    appliedPromo = {
      code: cleanStr(parsed.code),
      discount: parseMoney(parsed.discount),
    };
  } catch (err) {
    console.warn("Promo restore failed:", err);
    appliedPromo = null;
  }
}

function syncCheckoutDiscountUI() {
  const hasPromo = !!appliedPromo && parseMoney(appliedPromo.discount) > 0;

  if (discountCheckoutBoxEl) {
    discountCheckoutBoxEl.classList.toggle(
      "phcheckout__box--discount",
      hasPromo,
    );
    discountCheckoutBoxEl.style.display = hasPromo ? "block" : "none";
  }

  if (discountCodeLabelEl) {
    discountCodeLabelEl.textContent = hasPromo
      ? `${appliedPromo.code.toUpperCase()} ✔`
      : "";
  }

  if (discountAmountLabelEl) {
    discountAmountLabelEl.textContent = hasPromo
      ? money(appliedPromo.discount)
      : money(0);
  }
}

function syncOrderDiscountUI(totals) {
  const hasPromo = appliedPromo && parseMoney(appliedPromo.discount) > 0;

  if (!discountRowEl) return;

  // SHOW / HIDE ROW
  discountRowEl.style.display = hasPromo ? "flex" : "none";

  if (!hasPromo) return;

  // TEXT
  if (discountTextEl) {
    discountTextEl.textContent = `Descuento (${appliedPromo.code})`;
  }

  // AMOUNT
  if (discountAmountEl) {
    discountAmountEl.textContent = `- ${money(totals.promoDiscount)}`;
  }
}

function clearCheckoutPromo() {
  appliedPromo = null;
  localStorage.removeItem(CHECKOUT_PROMO_KEY);
  syncCheckoutDiscountUI();
}

function normalizeCartItem(item) {
  const quantity = Math.max(
    1,
    Math.floor(num(item?.quantity ?? item?.qty ?? item?.count ?? 1)),
  );

  const price =
    parseMoney(item?.price) ||
    parseMoney(item?.currentPrice) ||
    parseMoney(item?.actualPrice) ||
    parseMoney(item?.pricing?.currentPrice) ||
    0;

  const oldPrice =
    parseMoney(item?.oldPrice) ||
    parseMoney(item?.pricing?.price) ||
    parseMoney(item?.originalPrice) ||
    0;

  return {
    docId: cleanStr(item?.docId || item?.id || ""),
    productId: cleanStr(item?.productId || item?.productID || ""),
    name: cleanStr(item?.name || item?.title || item?.productName) || "Product",
    image: cleanStr(item?.image || item?.images?.[0] || ""),
    variant:
      cleanStr(item?.variant || item?.selectedVariant || "") || "not added",
    category: cleanStr(item?.category || item?.productTag || "") || "Other",
    brand: cleanStr(item?.brand || item?.Brand || "") || "not added",
    origin: cleanStr(item?.origin || item?.Origin || "") || "not added",
    sku: cleanStr(item?.sku || item?.SKU || "") || "not added",
    points: Math.max(
      0,
      Math.floor(num(item?.points ?? item?.ExpressPoints ?? 0)),
    ),
    quantity,
    price,
    oldPrice,
    delivery:
      item?.delivery && typeof item.delivery === "object"
        ? {
            count: Math.max(0, Number(item.delivery.count || 0) || 0),
            unit: cleanStr(item.delivery.unit || "days") || "days",
          }
        : {
            count: 0,
            unit: "days",
          },
    raw: item,
  };
}

function calcTotals(cart) {
  let paySubtotal = 0;
  let savings = 0;

  for (const raw of Array.isArray(cart) ? cart : []) {
    const item = normalizeCartItem(raw);
    paySubtotal += item.price * item.quantity;
    savings += Math.max(0, (item.oldPrice - item.price) * item.quantity);
  }

  const displaySubtotal = paySubtotal + savings;

  const promoDiscount = Math.min(
    parseMoney(appliedPromo?.discount || 0),
    paySubtotal,
  );

  const tax = paySubtotal * TAX_RATE;

  const total = Math.max(0, paySubtotal - promoDiscount + SHIPPING_COST + tax);

  return {
    paySubtotal,
    displaySubtotal,
    savings, // ONLY product savings
    promoDiscount, // ONLY discount code
    tax,
    total,
  };
}

function renderTotals(cart) {
  const totals = calcTotals(cart);

  // Subtotal (before discounts)
  if (subtotalEl) {
    subtotalEl.textContent = money(totals.displaySubtotal);
  }

  // Ahorros = ONLY product savings
  if (savingsCheckoutEl) {
    savingsCheckoutEl.textContent = `⭐ Estás ahorrando ${money(
      totals.savings,
    )}`;
  }

  // Shipping + Tax
  if (shippingPriceEl) {
    shippingPriceEl.textContent = money(SHIPPING_COST);
  }

  if (taxEl) {
    taxEl.textContent = money(totals.tax);
  }

  // Total (AFTER discount)
  if (totalEl) {
    totalEl.textContent = money(totals.total);
  }

  if (placeOrderTextEl) {
    placeOrderTextEl.textContent = `Confirmar pedido — ${money(totals.total)}`;
  }

  // 🔥 IMPORTANT
  syncOrderDiscountUI(totals);

  window.__CHECKOUT_TOTALS__ = totals;
}

function getLongestDelivery(cart) {
  const items = Array.isArray(cart) ? cart.map(normalizeCartItem) : [];
  if (!items.length) return { count: 0, unit: "days", label: "0 days" };

  let longest = { count: 0, unit: "days", totalHours: 0 };

  for (const item of items) {
    const count = Math.max(0, Number(item?.delivery?.count || 0) || 0);
    const unit = cleanStr(item?.delivery?.unit || "days").toLowerCase();

    let hours = count;
    if (unit.startsWith("day")) hours = count * 24;
    else if (unit.startsWith("week")) hours = count * 24 * 7;
    else if (unit.startsWith("month")) hours = count * 24 * 30;

    if (hours >= longest.totalHours) {
      longest = { count, unit, totalHours: hours };
    }
  }

  return {
    count: longest.count,
    unit: longest.unit,
    label: `${longest.count} ${longest.unit}`,
  };
}

function getProductsCount(cart) {
  return (Array.isArray(cart) ? cart : []).reduce((sum, item) => {
    const q = Math.max(1, Number(item?.quantity || item?.qty || 1) || 1);
    return sum + q;
  }, 0);
}

function getTotalAccumulatedPoints(cart) {
  return (Array.isArray(cart) ? cart : []).reduce((sum, raw) => {
    const item = normalizeCartItem(raw);
    return sum + item.points * item.quantity;
  }, 0);
}

function setPaymentMethod(method) {
  selectedPaymentMethod = method;

  paymentRows.forEach((row, index) => {
    const isActive =
      (method === "cash" && index === 0) ||
      (method === "etransfer" && index === 1) ||
      (method === "card" && index === 2);

    row
      .querySelector(".phcheckout__info--radius")
      ?.classList.toggle("phcheckout__info--radius-active", isActive);

    row.classList.toggle("phcheckout__info--sp", isActive);
  });

  localStorage.setItem("express_payment_method_phone", method);
}

function restorePaymentMethod() {
  const saved = localStorage.getItem("express_payment_method_phone") || "cash";
  setPaymentMethod(saved);
}

function renderAddress(customer) {
  const fullName = cleanStr(customer?.fullName || "");
  const address = cleanStr(customer?.address || "");
  const city = cleanStr(customer?.city || "");
  const postalCode = cleanStr(customer?.postalCode || "");
  const phone = cleanStr(customer?.phone || "");

  if (addressMainEl)
    addressMainEl.textContent = `${fullName || ""} - ${address || "Añade tu informacion"}`;
  if (addressNameEl) addressNameEl.textContent = fullName || "";
  if (addressStreetEl) addressStreetEl.textContent = address || "";
  if (addressCityEl)
    addressCityEl.textContent = `${city}${postalCode ? `, ${postalCode}` : ""}`;
  if (addressPhoneEl) addressPhoneEl.textContent = formatPhone(phone || "");
}

function getCustomerFromProfile(user, userDocData) {
  const ui = userDocData?.userInformation || {};
  const ad = userDocData?.address || {};

  const firstName = cleanStr(ui.firstName || userDocData?.firstName || "");
  const lastName = cleanStr(ui.lastName || userDocData?.lastName || "");
  const phone = cleanStr(ui.phoneNumber || userDocData?.phoneNumber || "");
  const email = cleanStr(user?.email || userDocData?.email || "");
  const address = cleanStr(ad.homeAddress || userDocData?.homeAddress || "");
  const city = cleanStr(
    ad.city ||
      ad.cityProvince ||
      userDocData?.city ||
      userDocData?.cityProvince ||
      "",
  );
  const postalCode = cleanStr(ad.postalCode || userDocData?.postalCode || "");

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    phone,
    email,
    address,
    city,
    province: "Ontario",
    country: "Canada",
    postalCode,
    notes: "",
  };
}

function buildOrderProducts(cart) {
  return (Array.isArray(cart) ? cart : []).map((raw) => {
    const item = normalizeCartItem(raw);
    const lineTotal = item.price * item.quantity;
    const lineSaved = Math.max(0, (item.oldPrice - item.price) * item.quantity);

    return {
      docId: item.docId || "",
      productId: item.productId || "not added",
      name: item.name,
      image: item.image,
      category: item.category,
      brand: item.brand,
      origin: item.origin,
      sku: item.sku,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
      oldPrice: item.oldPrice,
      lineTotal,
      lineSaved,
      points: item.points,
      delivery: item.delivery,
    };
  });
}

function buildOrderPayload({ cart, customer, paymentMethod, paymentStatus }) {
  const totals = window.__CHECKOUT_TOTALS__ || {};
  const longestDelivery = getLongestDelivery(cart);

  return {
    orderNumber: `ODR${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toLocaleDateString("en-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    payment: paymentStatus,
    paymentMethod:
      paymentMethod === "cash"
        ? "Cash"
        : paymentMethod === "etransfer"
          ? "E-transfer"
          : "Debit / Credit Card",

    customer: customer.fullName || "Guest Customer",

    customerInfo: {
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      fullName: customer.fullName || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      city: customer.city || "Leamington",
      province: customer.province || "Ontario",
      country: customer.country || "Canada",
      postalCode: customer.postalCode || "",
      orderNotes: customer.notes || "",
    },

    total: {
      productsTotal: num(totals.paySubtotal),
      shipping: SHIPPING_COST,
      discount: num(totals.promoDiscount), // code discount only
      tax: num(totals.tax),
      totalSaved: num(totals.savings), // product savings only
      totalAccumulatedPoints: getTotalAccumulatedPoints(cart),
      finalTotal: num(totals.total),
    },

    discountCode: appliedPromo?.code || "",
    discountAmount: num(appliedPromo?.discount || 0),

    delivery: {
      count: longestDelivery.count,
      unit: longestDelivery.unit,
      label: longestDelivery.label,
    },

    productsCount: getProductsCount(cart),

    fulfilment: "Unfulfilled",
    status: "Opened",
    inventoryApplied: false,
    products: buildOrderProducts(cart),

    source: checkoutMode,
    userId: auth.currentUser?.uid || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function getGuestCheckoutInfo() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(GUEST_CHECKOUT_INFO_KEY) || "{}",
    );
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveGuestCheckoutInfo(data) {
  localStorage.setItem(GUEST_CHECKOUT_INFO_KEY, JSON.stringify(data || {}));
}

function normalizePostalCode(value) {
  return cleanStr(value).replace(/\s+/g, "").toUpperCase();
}

function formatPostalCode(value) {
  const normalized = normalizePostalCode(value);
  if (normalized.length !== 6) return cleanStr(value);
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

function openCheckoutPanel() {
  checkoutPanel?.classList.remove("hidden");
}

function closeCheckoutPanel() {
  checkoutPanel?.classList.add("hidden");
}

function fillCheckoutPanelForm(data = {}) {
  if (guestFullNameInput)
    guestFullNameInput.value = cleanStr(data.fullName || "");
  if (guestAddressInput) guestAddressInput.value = cleanStr(data.address || "");
  if (guestPostalCodeInput) {
    guestPostalCodeInput.value = formatPostalCode(data.postalCode || "");
  }
  if (guestPhoneInput) guestPhoneInput.value = cleanStr(data.phone || "");
}

function getGuestCustomerFromPanel() {
  const fullName = cleanStr(guestFullNameInput?.value || "");
  const address = cleanStr(guestAddressInput?.value || "");
  const postalCode = formatPostalCode(guestPostalCodeInput?.value || "");
  const phone = cleanStr(guestPhoneInput?.value || "");

  return {
    fullName,
    address,
    city: "Leamington",
    postalCode,
    phone,
  };
}

function validateGuestCustomer(customer) {
  if (!customer.fullName) return "Añade tu nombre completo.";
  if (!customer.address) return "Añade tu dirección.";
  if (!customer.postalCode) return "Añade tu código postal.";
  if (!customer.phone) return "Añade tu número de teléfono.";
  return "";
}

function applyGuestCheckoutInfoToTemplate() {
  const guestInfo = getGuestCheckoutInfo();

  renderAddress({
    fullName: guestInfo.fullName || "",
    address: guestInfo.address || "",
    city: "Leamington",
    postalCode: guestInfo.postalCode || "",
    phone: guestInfo.phone || "",
  });
}

function isGuestCustomerValid(customer) {
  return (
    cleanStr(customer?.fullName) &&
    cleanStr(customer?.address) &&
    cleanStr(customer?.postalCode) &&
    cleanStr(customer?.phone)
  );
}

function updatePlaceOrderButtonState() {
  if (!placeOrderBtn) return;

  let isValid = false;

  if (auth.currentUser && currentUserData) {
    const customer = getCustomerFromProfile(auth.currentUser, currentUserData);
    isValid = isGuestCustomerValid(customer);
  } else {
    const guest = getGuestCheckoutInfo();
    isValid = isGuestCustomerValid(guest);
  }

  placeOrderBtn.classList.toggle("phcheckout__place--inactive", !isValid);
  placeOrderBtn.style.opacity = isValid ? "1" : "0.6";
  placeOrderBtn.style.pointerEvents = isValid ? "auto" : "none";
}

/* =========================
   SOURCE
========================= */
function setCheckoutItemsFromSource({ cart = [], buyNow = null }) {
  const params = new URLSearchParams(window.location.search);
  const forcedMode = cleanStr(params.get("mode"));

  if (forcedMode === "cart") {
    checkoutMode = "cart";
    liveCart = (Array.isArray(cart) ? cart : []).map(normalizeCartItem);
    renderTotals(liveCart);
    return;
  }

  if (
    forcedMode === "buyNow" &&
    buyNow &&
    typeof buyNow === "object" &&
    Object.keys(buyNow).length
  ) {
    checkoutMode = "buyNow";
    liveCart = [normalizeCartItem(buyNow)];
    clearCheckoutPromo(); // no promo on buyNow unless you want it later
    renderTotals(liveCart);
    return;
  }

  if (buyNow && typeof buyNow === "object" && Object.keys(buyNow).length) {
    checkoutMode = "buyNow";
    liveCart = [normalizeCartItem(buyNow)];
    clearCheckoutPromo();
    renderTotals(liveCart);
    return;
  }

  checkoutMode = "cart";
  liveCart = (Array.isArray(cart) ? cart : []).map(normalizeCartItem);
  restoreCheckoutPromo();
  renderTotals(liveCart);
}

/* =========================
   AUTH / PROFILE
========================= */
let unsubUserSnap = null;

function stopUserListener() {
  if (typeof unsubUserSnap === "function") {
    unsubUserSnap();
    unsubUserSnap = null;
  }
}

function startGuestMode() {
  stopUserListener();
  currentUserData = null;
  currentAuthUser = null;

  const guestBuyNow = getGuestBuyNow();
  const guestCart = getGuestCart();

  setCheckoutItemsFromSource({
    cart: guestCart,
    buyNow: guestBuyNow,
  });

  applyGuestCheckoutInfoToTemplate();
  updatePlaceOrderButtonState();
}

function startUserMode(user) {
  stopUserListener();

  const userRef = doc(db, "users", user.uid);

  unsubUserSnap = onSnapshot(
    userRef,
    (snap) => {
      const data = snap.exists() ? snap.data() : {};

      currentAuthUser = user;
      currentUserData = data;

      const cartRaw = Array.isArray(data.cart) ? data.cart : [];
      const buyNowRaw =
        data?.buyNow && typeof data.buyNow === "object" ? data.buyNow : null;

      setCheckoutItemsFromSource({
        cart: cartRaw,
        buyNow: buyNowRaw,
      });

      const customer = getCustomerFromProfile(user, data);
      renderAddress(customer);
      updatePlaceOrderButtonState();
    },
    (err) => {
      console.error("❌ Checkout snapshot error:", err);
    },
  );
}

/* =========================
   EVENTS
========================= */
paymentRows.forEach((row, index) => {
  row.addEventListener("click", () => {
    if (index === 0) setPaymentMethod("cash");
    if (index === 1) setPaymentMethod("etransfer");
    if (index === 2) setPaymentMethod("card");
  });
});

addressChangeBtn?.addEventListener("click", () => {
  fillCheckoutPanelForm(getGuestCheckoutInfo());
  openCheckoutPanel();
});

checkoutPanelCancelBtn?.addEventListener("click", () => {
  closeCheckoutPanel();
});

checkoutPanelSubmitBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  const customer = getGuestCustomerFromPanel();
  const validationError = validateGuestCustomer(customer);

  if (validationError) {
    alert(validationError);
    return;
  }

  saveGuestCheckoutInfo(customer);
  applyGuestCheckoutInfoToTemplate();
  updatePlaceOrderButtonState();
  closeCheckoutPanel();
});

guestPostalCodeInput?.addEventListener("input", (e) => {
  let value = String(e.target.value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 6);

  if (value.length > 3) {
    value = `${value.slice(0, 3)} ${value.slice(3)}`;
  }

  e.target.value = value;
});

placeOrderBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    if (!Array.isArray(liveCart) || !liveCart.length) {
      alert("Tu carrito está vacío.");
      return;
    }

    let customer = null;

    if (auth.currentUser && currentUserData) {
      customer = getCustomerFromProfile(auth.currentUser, currentUserData);
    } else {
      customer = getGuestCheckoutInfo();

      const validationError = validateGuestCustomer(customer);
      if (validationError) {
        alert(validationError);
        fillCheckoutPanelForm(customer);
        openCheckoutPanel();
        return;
      }
    }

    const paymentStatus =
      selectedPaymentMethod === "cash" || selectedPaymentMethod === "etransfer"
        ? "Pending"
        : "Success";

    const orderPayload = buildOrderPayload({
      cart: liveCart,
      customer,
      paymentMethod: selectedPaymentMethod,
      paymentStatus,
    });

    const orderRef = await addDoc(
      collection(db, "express_orders"),
      orderPayload,
    );

    localStorage.removeItem(CHECKOUT_PROMO_KEY);
    localStorage.removeItem("express_applied_promo");

    if (checkoutMode === "cart") {
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          cart: [],
        });
      } else {
        clearGuestCart();
      }
    }

    if (checkoutMode === "buyNow") {
      clearGuestBuyNow();

      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          buyNow: deleteField(),
        });
      }
    }

    alert("✅ Pedido confirmado");
    window.location.href = `success.html?orderId=${encodeURIComponent(orderRef.id)}`;
  } catch (err) {
    console.error("❌ Checkout failed:", err);
    alert("No se pudo confirmar el pedido.");
  }
});

/* =========================
   INIT
========================= */
restorePaymentMethod();
restoreCheckoutPromo();
syncCheckoutDiscountUI();
updatePlaceOrderButtonState();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    startGuestMode();
    return;
  }

  startUserMode(user);
});
