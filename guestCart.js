// guestCart.js
"use strict";

const GUEST_CART_KEY = "express_guest_cart_v1";
const GUEST_BUYNOW_KEY = "express_guest_buy_now_v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function getGuestCart() {
  return safeParse(localStorage.getItem(GUEST_CART_KEY), []);
}

export function setGuestCart(cart) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart || []));
}

export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

export function upsertGuestCartItem(newItem) {
  // expected newItem: { docId, productId, name, price, oldPrice, quantity, variant, image, category, ... }
  const cart = getGuestCart();

  const docId = String(newItem?.docId || "").trim();
  const variant = String(newItem?.variant || "").trim();

  if (!docId) return cart;

  const idx = cart.findIndex(
    (x) =>
      String(x?.docId || "").trim() === docId &&
      String(x?.variant || "").trim() === variant,
  );

  if (idx >= 0) {
    const oldQty = Number(cart[idx]?.quantity || cart[idx]?.qty || 0) || 0;
    const addQty = Number(newItem?.quantity || newItem?.qty || 0) || 0;

    const mergedQty = Math.max(1, oldQty + addQty);

    cart[idx] = {
      ...cart[idx],
      ...newItem,
      quantity: mergedQty,
      qty: mergedQty, // keep both for compatibility
      updatedAt: Date.now(),
    };
  } else {
    const q = Math.max(1, Number(newItem?.quantity || newItem?.qty || 1) || 1);
    cart.push({
      ...newItem,
      quantity: q,
      qty: q,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  setGuestCart(cart);
  return cart;
}

export function updateGuestCartQty(index, newQty) {
  const cart = getGuestCart();
  if (!cart[index]) return cart;

  const q = Math.max(1, Math.floor(Number(newQty) || 1));
  cart[index].quantity = q;
  cart[index].qty = q;
  cart[index].updatedAt = Date.now();

  setGuestCart(cart);
  return cart;
}

export function removeGuestCartItem(index) {
  const cart = getGuestCart();
  const next = cart.filter((_, i) => i !== index);
  setGuestCart(next);
  return next;
}

export function setGuestBuyNow(item) {
  localStorage.setItem(GUEST_BUYNOW_KEY, JSON.stringify(item || {}));
}

export function getGuestBuyNow() {
  return safeParse(localStorage.getItem(GUEST_BUYNOW_KEY), null);
}

export function clearGuestBuyNow() {
  localStorage.removeItem(GUEST_BUYNOW_KEY);
}
