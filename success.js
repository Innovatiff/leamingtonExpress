"use strict";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const qs = (s) => document.querySelector(s);

const els = {
  greeting: qs(".phsuccess__message--greeting"),
  message: qs(".phsuccess__message--message"),
  ordersList: qs(".phsuccess__orders-list"),
  subtotal: qs(".phsuccess__details--box-subtotal"),
  saved: qs(".phsuccess__details--box-saved"),
  delivery: qs(".phsuccess__details--box-delivery"),
  tax: qs(".phsuccess__details--box-tax"),
  total: qs(".phsuccess__details--box-total"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(n);
}

function capitalizeWords(text = "") {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("orderId") || "";
}

function getBuyerName(order) {
  return order?.customerInfo?.fullName || order?.customer || "Cliente";
}

function getOrderNumber(order) {
  return order?.orderNumber || "N/D";
}

function getProducts(order) {
  return Array.isArray(order?.products) ? order.products : [];
}

function getVariantText(product) {
  const variant = String(product?.variant || "").trim();
  if (!variant || variant.toLowerCase() === "not added") {
    return "Artículo estándar";
  }
  return variant;
}

function renderProducts(products) {
  if (!els.ordersList) return;

  if (!products.length) {
    els.ordersList.innerHTML = `
      <div class="phsuccess__order">
        <div class="phsuccess__order--container">
          <div class="phsuccess__order--details">
            <span class="phsuccess__order--details-name">
              Su pedido fue recibido correctamente.
            </span>
            <div class="phsuccess__order--details-bottom">
              <span class="phsuccess__order--details-variant">
                <strong>Estado:</strong> Confirmado
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  els.ordersList.innerHTML = products
    .map((product) => {
      const name = product?.name || "Producto";
      const image =
        product?.image || "https://via.placeholder.com/120x120?text=Producto";
      const variantText = getVariantText(product);
      const qty = Number(product?.quantity || 1);
      const lineTotal = Number(product?.lineTotal || 0);
      const lineSaved = Number(product?.lineSaved || 0);

      return `
        <div class="phsuccess__order">
          <div class="phsuccess__order--container">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />

            <div class="phsuccess__order--details">
              <span class="phsuccess__order--details-name">
                ${escapeHtml(name)}
              </span>

              <div class="phsuccess__order--details-bottom">
                <span class="phsuccess__order--details-variant">
                  <strong>Variante:</strong> ${escapeHtml(variantText)}
                </span>

                <span class="phsuccess__order--details-qty">
                  <strong>Qty:</strong> ${escapeHtml(String(qty))}
                </span>
              </div>
            </div>

            <div class="phsuccess__order--details phsuccess__order--details-nrm">
              <span class="phsuccess__order--details-price">${money(lineTotal)}</span>
              ${
                lineSaved > 0
                  ? `<span class="phsuccess__order--details-saved">Te ahorraste ${money(lineSaved)} 🔥</span>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTotals(order) {
  const totals = order?.total || {};

  if (els.subtotal) {
    els.subtotal.textContent = money(totals.productsTotal || 0);
  }

  if (els.saved) {
    els.saved.textContent = money(totals.totalSaved || 0);
  }

  if (els.delivery) {
    els.delivery.textContent = money(totals.shipping || 0);
  }

  if (els.tax) {
    els.tax.textContent = money(totals.tax || 0);
  }

  if (els.total) {
    els.total.textContent = money(totals.finalTotal || 0);
  }
}

function renderMessage(order) {
  const buyerName = capitalizeWords(getBuyerName(order));
  const orderNumber = getOrderNumber(order);

  if (els.greeting) {
    els.greeting.textContent = `Saludos ${buyerName},`;
  }

  if (els.message) {
    els.message.innerHTML = `
      Gracias por su compra con nosotros. Hemos recibido su pedido
      <strong class="phsuccess__message--order-number">Nº: ${escapeHtml(orderNumber)}</strong>.
      Le notificaremos cualquier actualización o inconveniente.
    `;
  }
}

function renderNotFound() {
  if (els.greeting) {
    els.greeting.textContent = "Saludos,";
  }

  if (els.message) {
    els.message.innerHTML = `
      No pudimos cargar los detalles de su pedido en este momento.
      Por favor, regrese a la página principal o inténtelo nuevamente.
    `;
  }

  if (els.ordersList) {
    els.ordersList.innerHTML = `
      <div class="phsuccess__order">
        <div class="phsuccess__order--container">
          <div class="phsuccess__order--details">
            <span class="phsuccess__order--details-name">
              No se encontraron productos para este pedido.
            </span>
          </div>
        </div>
      </div>
    `;
  }

  if (els.subtotal) els.subtotal.textContent = money(0);
  if (els.saved) els.saved.textContent = money(0);
  if (els.delivery) els.delivery.textContent = money(0);
  if (els.tax) els.tax.textContent = money(0);
  if (els.total) els.total.textContent = money(0);
}

async function loadOrder() {
  const orderId = getOrderId();

  if (!orderId) {
    console.warn("Missing orderId in URL.");
    renderNotFound();
    return;
  }

  try {
    const orderRef = doc(db, "express_orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      console.warn("Order not found:", orderId);
      renderNotFound();
      return;
    }

    const order = orderSnap.data();

    renderMessage(order);
    renderProducts(getProducts(order));
    renderTotals(order);
  } catch (error) {
    console.error("Failed to load success order:", error);
    renderNotFound();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadOrder();
});
