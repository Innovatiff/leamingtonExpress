"use strict";

/*
 * Leamington Express — Cloud Functions
 *
 *  createOrder            callable  · checks stock, prices and discount on the server, saves the order,
 *                                     and opens a Stripe Checkout page for card payments
 *  validateDiscountCode   callable  · preview a discount code at checkout
 *  getOrder               callable  · order page for the customer (needs the order's private link)
 *  cancelOrder            callable  · customer left the card payment page → release the stock
 *  stripeWebhook          https     · Stripe tells us a payment succeeded / expired (same URL as before)
 *  onOrderUpdated         firestore · restock cancelled orders, give Express Points on delivery
 *
 * Secrets (already set for the previous version): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */

const crypto = require("node:crypto");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const P = require("./lib/pricing");

if (!getApps().length) initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const COL = {
  products: "express_products",
  orders: "express_orders",
  discounts: "express_dicount_codes",
  settings: "express_settings",
  users: "users",
};

// Websites allowed to call the functions and receive Stripe redirects
const SITES = {
  leamington: "https://leamingtonexpress.ca",
  windsor: "https://windsorexpress.ca",
  london: "https://londonexpress.ca",
};
const ORIGINS = [
  /^https:\/\/(www\.)?(leamington|windsor|london)express\.ca$/,
  /^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const CALL_OPTIONS = { cors: ORIGINS };

function safeOrigin(url, city) {
  try {
    const origin = new URL(url).origin;
    if (ORIGINS.some((re) => re.test(origin))) return origin;
  } catch (err) {
    // fall through to the city's site
  }
  return SITES[city] || SITES.leamington;
}

function stripeClient() {
  const key = String(STRIPE_SECRET_KEY.value() || "").trim();
  if (!/^(sk|rk)_(live|test)_\S+$/.test(key)) return null;
  const Stripe = require("stripe");
  return new Stripe(key);
}

const asHttpsError = (err) => {
  if (err instanceof HttpsError) return err;
  if (err instanceof P.OrderError) return new HttpsError(err.code, err.message, err.details);
  logger.error(err);
  return new HttpsError("internal", "Something went wrong. Please try again.");
};

/** Firestore Timestamps → ISO strings so the browser gets plain JSON. */
function serialize(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

async function loadCodes() {
  const snap = await db.collection(COL.discounts).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Stock changes for an order's lines, grouped per product (the same product can
 * appear twice with different options). direction +1 puts items back in stock,
 * -1 takes them out. Reads happen now; call the returned function to write.
 */
async function stockChanges(tx, lines, direction) {
  const qtyById = new Map();
  for (const l of Array.isArray(lines) ? lines : []) {
    if (l && l.docId) qtyById.set(l.docId, (qtyById.get(l.docId) || 0) + (Number(l.quantity) || 0));
  }
  const ids = [...qtyById.keys()];
  const snaps = ids.length ? await tx.getAll(...ids.map((id) => db.collection(COL.products).doc(id))) : [];
  const updates = snaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const data = snap.data();
      const qty = qtyById.get(snap.id);
      const update = { performance: Math.max(0, (Number(data.performance) || 0) - direction * qty) };
      if (P.stockOf(data) !== null) update.stock = Math.max(0, P.stockOf(data) + direction * qty);
      return [snap.ref, update];
    });
  return () => updates.forEach(([ref, update]) => tx.update(ref, update));
}

/** Put a cancelled/expired order's items back in stock. */
async function restock(orderRef, patch) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return false;
    const order = snap.data();
    const write = order.inventoryApplied ? await stockChanges(tx, order.products, +1) : () => {};
    write();
    tx.update(orderRef, { ...patch, inventoryApplied: false, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

/* ======================================================================== */
/* createOrder                                                               */
/* ======================================================================== */
exports.createOrder = onCall({ ...CALL_OPTIONS, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  try {
    const input = P.parseOrderInput(request.data);
    const settingsSnap = await db.collection(COL.settings).doc(input.city).get();
    const store = P.storeSettings(settingsSnap.exists ? settingsSnap.data() : null);
    if (!store.enabled) throw new HttpsError("failed-precondition", "Store closed", { reason: "STORE_CLOSED" });
    if (!store.payments[input.paymentMethod]) {
      throw new HttpsError("failed-precondition", "Payment method not available", {
        reason: input.paymentMethod === "card" ? "CARD_UNAVAILABLE" : "METHOD_UNAVAILABLE",
      });
    }
    const stripe = input.paymentMethod === "card" ? stripeClient() : null;
    if (input.paymentMethod === "card" && !stripe) {
      throw new HttpsError("failed-precondition", "Card payments are not set up", { reason: "CARD_UNAVAILABLE" });
    }

    const codes = input.discountCode ? await loadCodes() : [];
    const codeDoc = input.discountCode ? P.findCode(codes, input.discountCode) : null;
    const orderRef = db.collection(COL.orders).doc();
    const token = crypto.randomBytes(24).toString("hex");
    const ids = [...new Set(input.items.map((i) => i.id))];

    const order = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...ids.map((id) => db.collection(COL.products).doc(id)));
      const products = new Map(snaps.map((s) => [s.id, s.exists ? s.data() : null]));
      const built = P.buildLines(input.items, products, input.city);

      let discount = 0;
      let codeRef = null;
      if (input.discountCode) {
        const fresh = codeDoc ? await tx.get(db.collection(COL.discounts).doc(codeDoc.id)) : null;
        const check = P.evaluateDiscount(fresh && fresh.exists ? fresh.data() : null, built.productsTotal);
        if (!check.valid) throw new HttpsError("invalid-argument", "Discount code not valid", { reason: "DISCOUNT_INVALID", why: check.reason });
        discount = check.amount;
        codeRef = fresh.ref;
      }

      // order number ODR###### — make sure it isn't taken
      let orderNumber = "";
      for (let i = 0; i < 4 && !orderNumber; i++) {
        const candidate = `ODR${crypto.randomInt(100000, 1000000)}`;
        const taken = await tx.get(db.collection(COL.orders).where("orderNumber", "==", candidate).limit(1));
        if (taken.empty) orderNumber = candidate;
      }
      if (!orderNumber) orderNumber = `ODR${Date.now().toString().slice(-7)}`;

      // take the items out of stock
      const qtyById = new Map();
      built.lines.forEach((l) => qtyById.set(l.docId, (qtyById.get(l.docId) || 0) + l.quantity));
      for (const [id, qty] of qtyById) {
        const data = products.get(id);
        const update = { performance: (Number(data.performance) || 0) + qty };
        if (P.stockOf(data) !== null) update.stock = P.stockOf(data) - qty;
        tx.update(db.collection(COL.products).doc(id), update);
      }
      if (codeRef) {
        const usage = { usedCount: FieldValue.increment(1), lastUsedAt: FieldValue.serverTimestamp() };
        tx.update(codeRef, codeDoc.Reusable ? usage : { ...usage, used: true });
      }

      const shipping = P.deliveryFee(store, built.productsTotal);
      const c = input.customer;
      const a = input.address;
      const fullName = `${c.firstName} ${c.lastName}`.trim();
      const doc = {
        orderNumber,
        date: new Date().toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Toronto" }),
        payment: "Pending",
        paymentMethod: P.METHOD_LABEL[input.paymentMethod],
        paymentMethodKey: input.paymentMethod,
        customer: fullName,
        customerInfo: {
          firstName: c.firstName,
          lastName: c.lastName,
          fullName,
          phone: c.phone,
          email: c.email,
          address: a.street,
          unit: a.unit,
          city: a.town,
          province: "Ontario",
          country: "Canada",
          postalCode: a.postalCode,
          orderNotes: a.notes,
        },
        total: {
          productsTotal: built.productsTotal,
          shipping,
          discount,
          tax: 0,
          totalSaved: built.totalSaved,
          totalAccumulatedPoints: built.points,
          finalTotal: P.round2(built.productsTotal - discount + shipping),
        },
        discountCode: discount ? P.clean(codeDoc.Code, 40) : "",
        discountAmount: discount,
        delivery: built.delivery,
        productsCount: built.lines.reduce((s, l) => s + l.quantity, 0),
        fulfilment: "Unfulfilled",
        status: "Opened",
        priority: false,
        inventoryApplied: true,
        pointsAwarded: false,
        products: built.lines,
        source: "web",
        channel: "web-v2",
        city: input.city,
        lang: input.lang,
        userId: request.auth ? request.auth.uid : null,
        accessToken: token,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.create(orderRef, doc);
      return doc;
    });

    const result = { orderId: orderRef.id, orderNumber: order.orderNumber, token };
    if (input.paymentMethod !== "card") return result;

    // Card: open a Stripe Checkout page with the server's prices
    const origin = safeOrigin(input.returnUrl, input.city);
    try {
      const es = input.lang !== "en";
      const lineItems = order.products.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "cad",
          unit_amount: Math.round(l.price * 100),
          product_data: {
            name: `${l.name}${l.variant ? ` (${l.variant})` : ""}`.slice(0, 250),
            ...(l.image.startsWith("https://") ? { images: [l.image] } : {}),
          },
        },
      }));
      if (order.total.shipping > 0) {
        lineItems.push({
          quantity: 1,
          price_data: { currency: "cad", unit_amount: Math.round(order.total.shipping * 100), product_data: { name: es ? "Entrega a domicilio" : "Home delivery" } },
        });
      }
      let discounts;
      if (order.total.discount > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(order.total.discount * 100),
          currency: "cad",
          duration: "once",
          max_redemptions: 1,
          name: `${es ? "Código" : "Code"} ${order.discountCode}`.slice(0, 40),
        });
        discounts = [{ coupon: coupon.id }];
      }
      const meta = { orderId: orderRef.id, orderNumber: order.orderNumber, city: input.city };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: lineItems,
          ...(discounts ? { discounts } : {}),
          success_url: `${origin}/tienda/pedido/${orderRef.id}?t=${token}&paid=1`,
          cancel_url: `${origin}/tienda/checkout?cancelled=${orderRef.id}`,
          client_reference_id: orderRef.id,
          ...(order.customerInfo.email ? { customer_email: order.customerInfo.email } : {}),
          locale: es ? "es" : "en",
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          metadata: meta,
          payment_intent_data: { metadata: meta },
        },
        { idempotencyKey: `order-${orderRef.id}` },
      );
      await orderRef.update({ stripeSessionId: session.id, updatedAt: FieldValue.serverTimestamp() });
      return { ...result, checkoutUrl: session.url };
    } catch (err) {
      logger.error("Stripe checkout failed", err);
      await restock(orderRef, { status: "Cancelled", payment: "Expired", cancelReason: "stripe_error" });
      throw new HttpsError("unavailable", "Card payment is not available right now", { reason: "CARD_UNAVAILABLE" });
    }
  } catch (err) {
    throw asHttpsError(err);
  }
});

/* ======================================================================== */
/* validateDiscountCode                                                      */
/* ======================================================================== */
exports.validateDiscountCode = onCall(CALL_OPTIONS, async (request) => {
  const code = P.clean(request.data && request.data.code, 40);
  const subtotal = Math.max(0, P.parseMoney(request.data && request.data.subtotal));
  if (!code) return { valid: false, reason: "invalid" };
  const found = P.findCode(await loadCodes(), code);
  const check = P.evaluateDiscount(found, subtotal);
  return check.valid ? { valid: true, code: check.code, amount: check.amount } : { valid: false, reason: check.reason, minSubtotal: check.minSubtotal || 0 };
});

/* ======================================================================== */
/* getOrder / cancelOrder                                                    */
/* ======================================================================== */
const PRIVATE_ORDER_FIELDS = ["accessToken", "adminNote", "stripeSessionId", "stripePaymentIntentId", "inventoryApplied", "pointsAwarded", "cancelReason"];

async function orderForCaller(request) {
  const orderId = P.clean(request.data && request.data.orderId, 128);
  const token = String((request.data && request.data.token) || "");
  if (!orderId || orderId.includes("/")) throw new HttpsError("not-found", "Order not found");
  const snap = await db.collection(COL.orders).doc(orderId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const order = snap.data();
  const tokenOk = order.accessToken && token.length === order.accessToken.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken));
  const ownerOk = request.auth && order.userId && request.auth.uid === order.userId;
  if (!tokenOk && !ownerOk) throw new HttpsError("not-found", "Order not found");
  return { ref: snap.ref, order };
}

exports.getOrder = onCall(CALL_OPTIONS, async (request) => {
  const { ref, order } = await orderForCaller(request);
  const safe = { ...order };
  PRIVATE_ORDER_FIELDS.forEach((k) => delete safe[k]);
  return serialize({ id: ref.id, ...safe });
});

exports.cancelOrder = onCall({ ...CALL_OPTIONS, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { ref, order } = await orderForCaller(request);
  if (order.paymentMethodKey !== "card" || order.payment === "Success" || order.status !== "Opened") return { ok: false };
  // Close the Stripe page first so it can't be paid after we release the stock
  const stripe = stripeClient();
  if (stripe && order.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      if (session.payment_status === "paid") return { ok: false };
      if (session.status === "open") await stripe.checkout.sessions.expire(order.stripeSessionId);
    } catch (err) {
      logger.warn("Could not expire Stripe session", err.message);
      return { ok: false };
    }
  }
  await restock(ref, { status: "Cancelled", payment: "Expired", cancelReason: "customer_left_payment" });
  return { ok: true };
});

/* ======================================================================== */
/* stripeWebhook — events: checkout.session.completed, .async_payment_succeeded,
   .async_payment_failed, .expired                                           */
/* ======================================================================== */
async function markPaid(session) {
  const orderId = session.metadata && session.metadata.orderId;
  if (!orderId) return legacyOrder(session);
  const ref = db.collection(COL.orders).doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().payment === "Success") return;
    tx.update(ref, {
      payment: "Success",
      paidAt: FieldValue.serverTimestamp(),
      stripePaymentIntentId: session.payment_intent || null,
      amountPaid: (session.amount_total || 0) / 100,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function markExpired(session, reason) {
  const orderId = session.metadata && session.metadata.orderId;
  if (!orderId) return;
  const ref = db.collection(COL.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const o = snap.data();
  if (o.payment === "Success" || o.status === "Cancelled") return;
  await restock(ref, { status: "Cancelled", payment: "Expired", cancelReason: reason });
}

/** Payments started on the previous website (order data travelled in the metadata). */
async function legacyOrder(session) {
  const raw = session.metadata && session.metadata.orderDraft;
  if (!raw) return;
  const existing = await db.collection(COL.orders).where("stripeSessionId", "==", session.id).limit(1).get();
  if (!existing.empty) return;
  let draft = {};
  try {
    draft = JSON.parse(raw);
  } catch (err) {
    logger.error("Bad legacy orderDraft", session.id);
  }
  await db.collection(COL.orders).add({
    ...draft,
    payment: "Success",
    paymentMethod: "Debit / Credit Card",
    paymentMethodKey: "card",
    fulfilment: draft.fulfilment || "Unfulfilled",
    status: "Opened",
    amountPaid: (session.amount_total || 0) / 100,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Use POST");
    return;
  }
  const stripe = stripeClient();
  const secret = String(STRIPE_WEBHOOK_SECRET.value() || "").trim();
  const signature = req.headers["stripe-signature"];
  if (!stripe || !secret || !signature) {
    res.status(400).send("Webhook not configured");
    return;
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, secret);
  } catch (err) {
    logger.warn("Bad Stripe signature", err.message);
    res.status(400).send("Bad signature");
    return;
  }
  try {
    const session = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
        if (session.payment_status === "paid") await markPaid(session);
        break;
      case "checkout.session.async_payment_succeeded":
        await markPaid(session);
        break;
      case "checkout.session.async_payment_failed":
        await markExpired(session, "payment_failed");
        break;
      case "checkout.session.expired":
        await markExpired(session, "payment_expired");
        break;
      default:
        break;
    }
    res.status(200).send("ok");
  } catch (err) {
    logger.error("stripeWebhook failed", event.type, err);
    res.status(500).send("Error");
  }
});

/* ======================================================================== */
/* onOrderUpdated — stock and Express Points follow the order's status       */
/* ======================================================================== */
exports.onOrderUpdated = onDocumentUpdated(`${COL.orders}/{orderId}`, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const ref = event.data.after.ref;

  // Cancelled from the admin → put the items back
  if (after.status === "Cancelled" && before.status !== "Cancelled" && after.inventoryApplied) {
    await restock(ref, {});
    return;
  }

  // Re-opened after a cancel → take the items out of stock again
  if (before.status === "Cancelled" && after.status !== "Cancelled" && !after.inventoryApplied) {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists || fresh.data().inventoryApplied) return;
      const write = await stockChanges(tx, fresh.data().products, -1);
      write();
      tx.update(ref, { inventoryApplied: true });
    });
    return;
  }

  // Delivered and paid → give the customer their Express Points (once)
  const points = Number(after.total && after.total.totalAccumulatedPoints) || 0;
  const delivered = after.fulfilment === "Fulfilled" && after.payment === "Success" && after.status !== "Cancelled";
  if (delivered && !after.pointsAwarded && after.userId && points > 0) {
    const batch = db.batch();
    batch.set(db.collection(COL.users).doc(after.userId), { expressPoints: FieldValue.increment(points) }, { merge: true });
    batch.update(ref, { pointsAwarded: true });
    await batch.commit();
  }
  if (after.status === "Cancelled" && after.pointsAwarded && after.userId && points > 0) {
    const batch = db.batch();
    batch.set(db.collection(COL.users).doc(after.userId), { expressPoints: FieldValue.increment(-points) }, { merge: true });
    batch.update(ref, { pointsAwarded: false });
    await batch.commit();
  }
});
