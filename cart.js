"use strict";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getGuestCart,
  updateGuestCartQty,
  removeGuestCartItem,
  clearGuestBuyNow,
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
const cartProductsEl = document.querySelector(".phcart__products");
const subtotalEl = document.querySelectorAll(
  ".phcart__info--details-amount",
)[0];
const savingsEl = document.querySelectorAll(".phcart__info--details-amount")[1];
const checkoutBtn = document.querySelector(".phcart__checkout");
const checkoutBtnText = document.querySelector(".phcart__checkout--buy");

const promoWrapEl = document.querySelector(".phcart__info--promo");
const promoInputEl = document.querySelector(".phcart__info--promo input");
const promoCodeTextEl = document.querySelector(".phcart__info--promo-code");
const promoBtnEl = document.querySelector(".phcart__info--promo-btn");
const discountBoxEl = document.querySelector(
  ".phcart__info--details-box-discount",
);
const discountTitleEl = discountBoxEl?.querySelector(
  ".phcart__info--details-title",
);
const discountAmountEl = discountBoxEl?.querySelector(
  ".phcart__info--details-amount",
);

/* =========================
   STATE
========================= */
let liveCart = [];
let guestEventsBound = false;
let userEventsBound = false;

let appliedPromo = null;
// shape:
// {
//   code: "Jh5J8810",
//   discount: 10
// }

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
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function money(val) {
  return `$${parseMoney(val).toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = stripUndefined(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value === undefined ? undefined : value;
}

function normalizeCode(code) {
  return cleanStr(code).toLowerCase();
}

function persistPromo() {
  if (appliedPromo) {
    localStorage.setItem("express_applied_promo", JSON.stringify(appliedPromo));
  } else {
    localStorage.removeItem("express_applied_promo");
  }
}

function restorePromo() {
  try {
    const raw = localStorage.getItem("express_applied_promo");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return;
    appliedPromo = {
      code: cleanStr(parsed.code),
      discount: parseMoney(parsed.discount),
    };
  } catch (err) {
    console.warn("Promo restore failed:", err);
  }
}

function clearPromo() {
  appliedPromo = null;
  persistPromo();
  syncPromoUI();
  const { subtotal, saved, checkoutTotal, promoDiscount, finalTotal } =
    calcTotals(liveCart);
  renderTotals(subtotal, saved, checkoutTotal, promoDiscount, finalTotal);
}

function syncPromoUI() {
  const hasPromo = !!appliedPromo;

  promoWrapEl?.classList.toggle("phcart__info--promo-filled", hasPromo);

  if (promoBtnEl) {
    promoBtnEl.textContent = hasPromo ? "Quitar" : "Añadir";
  }

  if (promoInputEl) {
    promoInputEl.value = hasPromo ? appliedPromo.code : "";
    promoInputEl.disabled = hasPromo;
  }

  if (promoCodeTextEl) {
    promoCodeTextEl.textContent = hasPromo
      ? `${appliedPromo.code.toUpperCase()} ✔`
      : "";
    promoCodeTextEl.style.display = hasPromo ? "inline-flex" : "none";
  }

  if (discountBoxEl) {
    discountBoxEl.style.display = hasPromo ? "flex" : "none";
  }

  if (discountTitleEl) {
    discountTitleEl.innerHTML = hasPromo
      ? `Descuento <strong>(${escapeHtml(appliedPromo.code.toUpperCase())})</strong>`
      : `Descuento`;
  }

  if (discountAmountEl) {
    discountAmountEl.textContent = hasPromo
      ? `- ${money(appliedPromo.discount)}`
      : `- ${money(0)}`;
  }
}

function normalizeCartItem(item) {
  const docId = cleanStr(item?.docId);
  const productId = cleanStr(item?.productId || item?.id || item?.productID);
  const finalDocId = docId || productId;

  const qty = Math.max(1, Math.floor(num(item?.qty ?? item?.quantity ?? 1)));

  const price =
    parseMoney(item?.price) ||
    parseMoney(item?.currentPrice) ||
    parseMoney(item?.actualPrice) ||
    0;

  const oldPrice =
    parseMoney(item?.oldPrice) ||
    parseMoney(item?.originalPrice) ||
    parseMoney(item?.wasPrice) ||
    parseMoney(item?.compareAtPrice) ||
    0;

  const name =
    cleanStr(item?.name || item?.title || item?.productName) || "Producto";

  const image =
    cleanStr(
      item?.image ||
        item?.mainImage ||
        item?.img ||
        item?.imageMain ||
        item?.images?.[0],
    ) || "";

  const variant =
    cleanStr(
      item?.variant || item?.selectedVariant || item?.color || item?.option,
    ) || "Default";

  return {
    docId: finalDocId,
    productId: productId || finalDocId,
    name,
    image,
    variant,
    price,
    oldPrice,
    qty,
    quantity: qty,
    raw: item,
  };
}

function calcTotals(cart) {
  let checkoutTotal = 0;
  let saved = 0;

  if (!Array.isArray(cart)) {
    return {
      subtotal: 0,
      saved: 0,
      checkoutTotal: 0,
      promoDiscount: 0,
      finalTotal: 0,
    };
  }

  for (const item of cart) {
    const c = normalizeCartItem(item);

    checkoutTotal += c.price * c.qty;
    saved += Math.max(0, (c.oldPrice - c.price) * c.qty);
  }

  const subtotal = checkoutTotal + saved;
  const promoDiscount = Math.min(
    parseMoney(appliedPromo?.discount || 0),
    checkoutTotal,
  );
  const finalTotal = Math.max(0, checkoutTotal - promoDiscount);

  return {
    subtotal,
    saved,
    checkoutTotal,
    promoDiscount,
    finalTotal,
  };
}

function renderTotals(
  subtotal,
  saved,
  checkoutTotal,
  promoDiscount = 0,
  finalTotal = checkoutTotal,
) {
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (savingsEl) savingsEl.textContent = `- ${money(saved)}`;

  if (discountAmountEl) {
    discountAmountEl.textContent = `- ${money(promoDiscount)}`;
  }

  if (checkoutBtnText) {
    checkoutBtnText.textContent =
      finalTotal > 0
        ? `Finalizar compra — ${money(finalTotal)}`
        : "Finalizar compra";
  }

  if (checkoutBtn) {
    const isEmpty =
      finalTotal <= 0 || !Array.isArray(liveCart) || !liveCart.length;

    checkoutBtn.disabled = isEmpty;
    checkoutBtn.classList.toggle("phcart__checkout--inactive", isEmpty);
    checkoutBtn.style.opacity = isEmpty ? "0.5" : "1";
    checkoutBtn.style.pointerEvents = isEmpty ? "none" : "auto";
  }
}

async function findDiscountCode(inputCode) {
  const rawCode = cleanStr(inputCode);
  if (!rawCode) return null;

  const normalizedInput = normalizeCode(rawCode);

  try {
    // Try exact match first
    const exactSnap = await getDocs(
      query(
        collection(db, "express_dicount_codes"),
        where("Code", "==", rawCode),
      ),
    );

    if (!exactSnap.empty) {
      const data = exactSnap.docs[0].data();
      return {
        code: cleanStr(data?.Code || rawCode),
        discount: parseMoney(data?.Discount),
        reusable: cleanStr(data?.reusable),
      };
    }

    // Fallback: case-insensitive scan
    const allSnap = await getDocs(collection(db, "express_dicount_codes"));
    const found = allSnap.docs.find((d) => {
      const data = d.data();
      return normalizeCode(data?.Code) === normalizedInput;
    });

    if (!found) return null;

    const data = found.data();
    return {
      code: cleanStr(data?.Code || rawCode),
      discount: parseMoney(data?.Discount),
      reusable: cleanStr(data?.reusable),
    };
  } catch (err) {
    console.error("Discount code lookup failed:", err);
    return null;
  }
}

async function applyPromoCode(inputCode) {
  const codeData = await findDiscountCode(inputCode);

  if (!codeData) {
    alert("Ese código no es válido.");
    return false;
  }

  if (codeData.discount <= 0) {
    alert("Ese código no tiene descuento válido.");
    return false;
  }

  appliedPromo = {
    code: codeData.code,
    discount: codeData.discount,
  };

  persistPromo();
  syncPromoUI();

  const { subtotal, saved, checkoutTotal, promoDiscount, finalTotal } =
    calcTotals(liveCart);
  renderTotals(subtotal, saved, checkoutTotal, promoDiscount, finalTotal);

  return true;
}

function renderCart(cart) {
  if (!cartProductsEl) return;

  if (!Array.isArray(cart) || cart.length === 0) {
    cartProductsEl.innerHTML = `
      <div style="padding:1rem 0;font-size:1.6rem;">
        Tu carrito está vacío.
      </div>
    `;
    renderTotals(0, 0, 0, 0, 0);
    return;
  }

  cartProductsEl.innerHTML = cart
    .map((item, index) => {
      const c = normalizeCartItem(item);
      const clickId = c.docId || c.productId || "";

      const minusDisabled =
        c.qty <= 1 ? "phcart__product--quantity-btn-insu" : "";

      return `
        <div class="phcart__product" data-index="${index}" data-clickid="${escapeHtml(clickId)}">
          <img
            class="phcart__js-open"
            src="${escapeHtml(c.image)}"
            alt="${escapeHtml(c.name)}"
          />

          <div class="phcart__product--right">
            <div class="phcart__product--right-top phcart__js-open">
              <span class="phcart__product--name">${escapeHtml(c.name)}</span>
              <span class="phcart__product--variant">${escapeHtml(c.variant)}</span>
            </div>

            <div class="phcart__product--right-bottom">
              <span class="phcart__product--price">${money(c.price * c.qty)}</span>

              <div class="phcart__product--quantity">
                <button
                  class="phcart__product--quantity-btn phcart__product--quantity-btn-remove ${minusDisabled}"
                  data-action="dec"
                >
                  <i class="ph-bold ph-minus-circle"></i>
                </button>

                <span class="phcart__product--quantity-number">${c.qty}</span>

                <button
                  class="phcart__product--quantity-btn phcart__product--quantity-btn-add"
                  data-action="inc"
                >
                  <i class="ph-bold ph-plus-circle"></i>
                </button>

                <button
                  class="phcart__product--quantity-btn-erase"
                  data-action="remove"
                  title="Eliminar"
                  style="margin-left:.8rem;"
                >
                  <i class="ph-bold ph-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const { subtotal, saved, checkoutTotal, promoDiscount, finalTotal } =
    calcTotals(cart);
  renderTotals(subtotal, saved, checkoutTotal, promoDiscount, finalTotal);
}

/* =========================
   PRODUCT LINK RESOLVER
========================= */
const PRODUCT_ID_TO_DOCID = new Map();

async function resolveDocIdFromCartItem(item) {
  const c = normalizeCartItem(item);

  if (c.docId) return c.docId;

  const pid = c.productId;
  if (!pid) return "";

  if (PRODUCT_ID_TO_DOCID.has(pid)) return PRODUCT_ID_TO_DOCID.get(pid);

  try {
    const directSnap = await getDoc(doc(db, "express_products", pid));
    if (directSnap.exists()) {
      PRODUCT_ID_TO_DOCID.set(pid, pid);
      return pid;
    }
  } catch (e) {
    console.warn("Direct docId check failed:", e);
  }

  try {
    const colRef = collection(db, "express_products");

    let res = await getDocs(query(colRef, where("productId", "==", pid)));
    if (res.empty) {
      res = await getDocs(query(colRef, where("ProductID", "==", pid)));
    }

    if (!res.empty) {
      const foundDocId = res.docs[0].id;
      PRODUCT_ID_TO_DOCID.set(pid, foundDocId);
      return foundDocId;
    }
  } catch (e) {
    console.error("Product lookup failed:", e);
  }

  return "";
}

/* =========================
   FIRESTORE SAVE
========================= */
async function saveCart(uid, newCartArray) {
  const ref = doc(db, "users", uid);
  const safeCart = stripUndefined(newCartArray);
  await setDoc(ref, { cart: safeCart }, { merge: true });
}

/* =========================
   EVENTS - USER
========================= */
function setupUserCartEvents(uid, getCartRef) {
  if (!cartProductsEl || userEventsBound) return;
  userEventsBound = true;

  cartProductsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    const row = e.target.closest(".phcart__product");
    const open = e.target.closest(".phcart__js-open");

    if (open && row) {
      const index = Number(row.dataset.index);
      const cart = getCartRef();
      const item = cart?.[index];
      if (!item) return;

      const docId = await resolveDocIdFromCartItem(item);
      if (!docId) return alert("Producto no encontrado.");

      localStorage.setItem("express_selected_product_id", docId);
      window.location.href = `product.html?id=${encodeURIComponent(docId)}`;
      return;
    }

    if (!btn || !row) return;

    const action = btn.dataset.action;
    const index = Number(row.dataset.index);

    const cart = getCartRef();
    if (!Array.isArray(cart) || !cart[index]) return;

    const current = cart[index];
    const c = normalizeCartItem(current);

    try {
      if (action === "inc") {
        const newQty = c.qty + 1;
        const newCart = [...cart];
        newCart[index] = { ...current, qty: newQty, quantity: newQty };
        await saveCart(uid, newCart);
        return;
      }

      if (action === "dec") {
        const newQty = Math.max(1, c.qty - 1);
        const newCart = [...cart];
        newCart[index] = { ...current, qty: newQty, quantity: newQty };
        await saveCart(uid, newCart);
        return;
      }

      if (action === "remove") {
        const newCart = cart.filter((_, i) => i !== index);
        await saveCart(uid, newCart);
      }
    } catch (err) {
      console.error("Cart update failed:", err);
      alert("No se pudo actualizar el carrito.");
    }
  });
}

/* =========================
   EVENTS - GUEST
========================= */
function setupGuestCartEvents() {
  if (!cartProductsEl || guestEventsBound) return;
  guestEventsBound = true;

  cartProductsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    const row = e.target.closest(".phcart__product");
    const open = e.target.closest(".phcart__js-open");

    if (open && row) {
      const index = Number(row.dataset.index);
      const item = liveCart?.[index];
      if (!item) return;

      const docId = await resolveDocIdFromCartItem(item);
      if (!docId) return alert("Producto no encontrado.");

      localStorage.setItem("express_selected_product_id", docId);
      window.location.href = `product.html?id=${encodeURIComponent(docId)}`;
      return;
    }

    if (!btn || !row) return;

    const action = btn.dataset.action;
    const index = Number(row.dataset.index);
    if (!liveCart[index]) return;

    if (action === "inc") {
      const cur = normalizeCartItem(liveCart[index]);
      liveCart = updateGuestCartQty(index, cur.qty + 1);
    }

    if (action === "dec") {
      const cur = normalizeCartItem(liveCart[index]);
      liveCart = updateGuestCartQty(index, Math.max(1, cur.qty - 1));
    }

    if (action === "remove") {
      liveCart = removeGuestCartItem(index);
    }

    renderCart(liveCart);
  });
}

/* =========================
   PROMO EVENTS
========================= */
promoBtnEl?.addEventListener("click", async () => {
  if (appliedPromo) {
    clearPromo();
    return;
  }

  if (!liveCart.length) {
    alert("Tu carrito está vacío.");
    return;
  }

  const inputCode = cleanStr(promoInputEl?.value);
  if (!inputCode) {
    alert("Ingresa un código.");
    return;
  }

  promoBtnEl.disabled = true;

  try {
    await applyPromoCode(inputCode);
  } finally {
    promoBtnEl.disabled = false;
  }
});

promoInputEl?.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();

  if (appliedPromo) return;

  promoBtnEl?.click();
});

/* =========================
   CHECKOUT BUTTON
========================= */
checkoutBtn?.addEventListener("click", () => {
  if (!Array.isArray(liveCart) || !liveCart.length) {
    return;
  }

  clearGuestBuyNow();

  if (appliedPromo) {
    localStorage.setItem(
      "express_checkout_promo",
      JSON.stringify(appliedPromo),
    );
  } else {
    localStorage.removeItem("express_checkout_promo");
  }

  window.location.href = "checkout.html?mode=cart";
});

/* =========================
   LIVE BOOT
========================= */
function bootUserCart(uid) {
  const userRef = doc(db, "users", uid);

  onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) {
        liveCart = [];
        renderCart([]);
        return;
      }

      const data = snap.data();
      liveCart = Array.isArray(data.cart) ? data.cart : [];
      renderCart(liveCart);
    },
    (err) => {
      console.error("Cart snapshot error:", err);
    },
  );

  setupUserCartEvents(uid, () => liveCart);
}

restorePromo();
syncPromoUI();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    liveCart = getGuestCart();
    renderCart(liveCart);
    setupGuestCartEvents();
    return;
  }

  bootUserCart(user.uid);
});
