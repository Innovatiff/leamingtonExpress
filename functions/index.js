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
 *  saveStaff / deleteStaff callable · admins create, update or remove employees and their sign-in
 *  onRideWritten          firestore · \
 *  onOrderWritten         firestore ·  } keep each customer's live-status page (express_tracking) up to date,
 *  onBookingWritten       firestore · /   find the pick-up / delivery point on the map, clear the live position
 *  refreshCatalog         scheduled · every 5 min: rebuild the store's compact catalog (express_catalog) when products changed,
 *                                     then copy product photos from other websites to our Storage
 *  publishCatalog         callable  · admins: rebuild it right away (after an import, for example)
 *  copyPhotos             callable  · admins: copy these products' photos from other websites to our Storage now
 *  walmart                callable  · admins: search walmart.ca and check a store's stock through the BlueCart API
 *
 * Secrets (already set for the previous version): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */

const crypto = require("node:crypto");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const P = require("./lib/pricing");
const { parseStaffInput, StaffError } = require("./lib/staff");
const { coordsOf, MAP_STAGES, tokenOf, trackingView } = require("./lib/tracking");
const { geocode, geoQueries } = require("./lib/geo");
const { buildCatalogParts, millis } = require("./lib/catalog");
const { bluecart, creditsLeft, productInfo, searchResults } = require("./lib/bluecart");
const { copyProductPhotos, needsCopy } = require("./lib/photos");

if (!getApps().length) initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const COL = {
  products: "express_products",
  productsPrivate: "express_products_private",
  pricing: "express_pricing",
  catalog: "express_catalog",
  integrations: "express_integrations",
  orders: "express_orders",
  rides: "express_rides",
  bookings: "express_travel_bookings",
  discounts: "express_dicount_codes",
  settings: "express_settings",
  staff: "express_staff",
  tracking: "express_tracking",
  admins: "express_admins",
  users: "users",
};

// The owner account — keep in sync with src/config/firebase.js and firestore.rules.
const OWNER_UIDS = ["FNTtxDJo1RbFw68eVcbkIFGGqza2"];

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
  if (err instanceof StaffError) return new HttpsError(err.code, err.message, err.details);
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
      if (P.stockOf(data) !== null) {
        update.stock = Math.max(0, P.stockOf(data) + direction * qty);
        // sold out ↔ back in stock: the store's catalog picks it up (see refreshCatalog)
        if ((update.stock > 0) !== (P.stockOf(data) > 0)) update.updatedAt = FieldValue.serverTimestamp();
      }
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
// Items Express buys for the customer (private product data): Walmart (the local
// store) and Amazon. Once the order is paid the office buys them and marks the
// order ready at the warehouse; until then it waits (awaitingStock) and couriers
// don't see it. Customers and employees only ever see the Express warehouse.
const SOURCED = ["walmart", "amazon"];

async function suppliersOf(ids) {
  const snaps = ids.length ? await db.getAll(...ids.map((id) => db.collection(COL.productsPrivate).doc(id))) : [];
  return new Map(snaps.map((s) => [s.id, s.exists ? s.get("supplier") : null]));
}
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
    const supplierOf = await suppliersOf(ids);

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
        if (P.stockOf(data) !== null) {
          update.stock = P.stockOf(data) - qty;
          if (update.stock <= 0) update.updatedAt = FieldValue.serverTimestamp(); // just sold out
        }
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
        awaitingStock: built.lines.some((l) => SOURCED.includes(supplierOf.get(l.docId))),
        status: "Opened",
        priority: false,
        inventoryApplied: true,
        pointsAwarded: false,
        courierUid: null,
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
      // The customer's live-status page exists right away (onOrderWritten keeps it current)
      tx.set(db.collection(COL.tracking).doc(token), {
        ...trackingView("order", { ...doc, createdAt: new Date() }, orderRef.id),
        updatedAt: FieldValue.serverTimestamp(),
      });
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

/* ======================================================================== */
/* Employees — saveStaff / deleteStaff (admins only)                         */
/* ======================================================================== */
async function isAdminUid(uid) {
  if (!uid) return false;
  if (OWNER_UIDS.includes(uid)) return true;
  return (await db.collection(COL.admins).doc(uid).get()).exists;
}

async function requireAdmin(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first");
  if (!(await isAdminUid(uid))) throw new HttpsError("permission-denied", "Only administrators can do this");
  return uid;
}

exports.saveStaff = onCall(CALL_OPTIONS, async (request) => {
  try {
    await requireAdmin(request);
    const { uid, password, doc } = parseStaffInput(request.data);
    const auth = getAuth();
    let target = uid;
    let isNew = false;

    if (!target) {
      // New employee: create their sign-in, or turn an existing account with that email into an employee
      isNew = true;
      let existing = null;
      try {
        existing = await auth.getUserByEmail(doc.email);
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }
      if (existing) {
        target = existing.uid;
        if ((await db.collection(COL.staff).doc(target).get()).exists) {
          throw new HttpsError("already-exists", "This email already belongs to an employee", { reason: "ALREADY_STAFF" });
        }
        // Never change an administrator's password or lock them out from here
        if (!(await isAdminUid(target))) await auth.updateUser(target, { password, displayName: doc.name, disabled: !doc.active });
      } else {
        const created = await auth.createUser({ email: doc.email, password, displayName: doc.name, disabled: !doc.active });
        target = created.uid;
      }
    } else {
      const snap = await db.collection(COL.staff).doc(target).get();
      if (!snap.exists) throw new HttpsError("not-found", "Employee not found", { reason: "NOT_FOUND" });
      if (!(await isAdminUid(target))) {
        const changes = { displayName: doc.name, disabled: !doc.active };
        if (snap.data().email !== doc.email) changes.email = doc.email;
        if (password) changes.password = password;
        try {
          await auth.updateUser(target, changes);
        } catch (err) {
          if (err.code === "auth/email-already-exists") throw new HttpsError("already-exists", "Another account uses this email", { reason: "EMAIL_TAKEN" });
          if (err.code !== "auth/user-not-found") throw err;
        }
        if (!doc.active) await auth.revokeRefreshTokens(target);
      }
    }

    await db
      .collection(COL.staff)
      .doc(target)
      .set(
        {
          ...doc,
          uid: target,
          ...(isNew ? { online: false, createdAt: FieldValue.serverTimestamp() } : {}),
          ...(!doc.active ? { online: false } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return { uid: target };
  } catch (err) {
    if (err && typeof err.code === "string" && err.code.startsWith("auth/")) {
      logger.warn("saveStaff auth error", err.code);
      const reason = err.code === "auth/email-already-exists" ? "EMAIL_TAKEN" : err.code === "auth/invalid-password" ? "PASSWORD_SHORT" : "AUTH_ERROR";
      throw new HttpsError("failed-precondition", "Could not save the employee's sign-in", { reason });
    }
    throw asHttpsError(err);
  }
});

exports.deleteStaff = onCall(CALL_OPTIONS, async (request) => {
  try {
    await requireAdmin(request);
    const uid = P.clean(request.data && request.data.uid, 128);
    if (!uid || uid.includes("/")) throw new HttpsError("invalid-argument", "Bad employee id");
    await db.collection(COL.staff).doc(uid).delete();
    // Their sign-in goes too — unless it is also an admin or a customer account
    if (!(await isAdminUid(uid))) {
      const auth = getAuth();
      const customer = await db.collection(COL.users).doc(uid).get();
      try {
        if (customer.exists) await auth.revokeRefreshTokens(uid);
        else await auth.deleteUser(uid);
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }
    }
    return { ok: true };
  } catch (err) {
    throw asHttpsError(err);
  }
});

/* ======================================================================== */
/* Live status — express_tracking/{token} follows rides, orders and bookings  */
/* ======================================================================== */
const sameView = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Where the customer's map pin comes from when they typed an address (rides with GPS already have it)
const GEO_FIELD = { ride: "pickupGeo", order: "addressGeo" };
function needsGeo(kind, r) {
  const field = GEO_FIELD[kind];
  if (!field || field in r) return false;
  if (kind === "ride") return !coordsOf(r.pickup) && ["requested", "confirmed", "assigned", "arrived"].includes(r.status);
  return r.status === "Opened" && r.fulfilment !== "Fulfilled";
}

async function findOnMap(kind, r) {
  try {
    for (const [i, query] of geoQueries(kind, r).entries()) {
      if (i) await new Promise((done) => setTimeout(done, 1100)); // the geocoder allows one search per second
      const hit = await geocode(query, { city: r.city });
      if (hit) return hit;
    }
  } catch (err) {
    logger.warn("Address lookup failed", err.message);
  }
  return { failed: true };
}

const livePosition = (token) => db.collection(COL.tracking).doc(token).collection("live").doc("position");

async function syncTracking(kind, event) {
  const before = event.data.before.exists ? event.data.before.data() : null;
  let after = event.data.after.exists ? event.data.after.data() : null;
  const id = event.params.id;

  if (after) {
    const fill = {};
    // Older versions of the website didn't add these: fill them in so employees can find the job
    if (kind === "ride" && !("driverUid" in after)) fill.driverUid = null;
    if (kind === "booking" && !("guideUid" in after)) fill.guideUid = null;
    if (kind === "order" && !("courierUid" in after) && after.status === "Opened") fill.courierUid = null;
    if (kind !== "order" && !tokenOf(kind, after)) fill.trackToken = crypto.randomBytes(18).toString("base64url");
    if (Object.keys(fill).length) {
      await event.data.after.ref.update(fill);
      after = { ...after, ...fill };
    }
  }

  await publishView(kind, before, after, id);

  // Then put the pick-up point or the door on the map. It's looked up after the
  // live status is saved, so a slow lookup never holds it up; the update runs
  // this function again, which adds the point to the live status.
  if (after && needsGeo(kind, after)) await event.data.after.ref.update({ [GEO_FIELD[kind]]: await findOnMap(kind, after) });
}

async function publishView(kind, before, after, id) {
  const oldToken = before ? tokenOf(kind, before) : "";
  const newToken = after ? tokenOf(kind, after) : "";
  const oldView = oldToken ? trackingView(kind, before, id) : null;
  const view = newToken ? trackingView(kind, after, id) : null;

  // The employee's position disappears as soon as they're no longer on the way (or someone else has the job)
  const onMap = (v) => Boolean(v && (MAP_STAGES[kind] || []).includes(v.stage));
  if (onMap(oldView) && (!onMap(view) || oldToken !== newToken || view.staffUid !== oldView.staffUid)) {
    await livePosition(oldToken).delete();
  }

  if (oldToken && oldToken !== newToken) await db.collection(COL.tracking).doc(oldToken).delete();
  if (!view) return;
  if (oldView && oldToken === newToken && sameView(oldView, view)) return;
  await db.collection(COL.tracking).doc(newToken).set({ ...view, updatedAt: FieldValue.serverTimestamp() });
}

exports.onRideWritten = onDocumentWritten(`${COL.rides}/{id}`, (event) => syncTracking("ride", event));
exports.onOrderWritten = onDocumentWritten(`${COL.orders}/{id}`, (event) => syncTracking("order", event));
exports.onBookingWritten = onDocumentWritten(`${COL.bookings}/{id}`, (event) => syncTracking("booking", event));


/* ======================================================================== */
/* Catalog — the store reads a few compact documents, not every product      */
/* ======================================================================== */
const CATALOG_MAX_AGE = 6 * 60 * 60 * 1000; // rebuilt at least this often (best sellers order, …)

/** The products whose photos are still on other websites (on sale first) are returned in `photos`. */
async function publishCatalog() {
  const snap = await db.collection(COL.products).get();
  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { parts, count, newest } = buildCatalogParts(products);
  const version = Date.now();
  const existing = await db.collection(COL.catalog).listDocuments();
  const batch = db.batch(); // all at once, so the store never sees half a catalog
  parts.forEach((json, index) => batch.set(db.collection(COL.catalog).doc(`part-${index}`), { version, index, json }));
  batch.set(db.collection(COL.catalog).doc("meta"), { version, parts: parts.length, count, total: snap.size, newest, builtAt: FieldValue.serverTimestamp() });
  existing.filter((ref) => ref.id.startsWith("part-") && Number(ref.id.slice(5)) >= parts.length).forEach((ref) => batch.delete(ref));
  await batch.commit();
  logger.info("Catalog published", { count, parts: parts.length });
  const bucket = photoBucketName();
  const photos = products.filter((p) => needsCopy(p, bucket)).sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));
  return { count, parts: parts.length, photos: photos.map((p) => p.id) };
}

exports.refreshCatalog = onSchedule({ schedule: "every 5 minutes", timeoutSeconds: 300, memory: "512MiB", retryCount: 0 }, async () => {
  const meta = (await db.collection(COL.catalog).doc("meta").get()).data();
  const latest = await db.collection(COL.products).orderBy("updatedAt", "desc").limit(1).get();
  const newest = latest.empty ? 0 : millis(latest.docs[0].get("updatedAt"));
  const total = (await db.collection(COL.products).count().get()).data().count;
  const fresh = meta && meta.newest >= newest && meta.total === total && Date.now() - millis(meta.builtAt) < CATALOG_MAX_AGE;
  if (fresh) return;
  const { photos } = await publishCatalog();
  // then photos from other websites are copied (the next run publishes the new links)
  if (photos.length) await copyWaitingPhotos(photos, Date.now() + PHOTO_TIME);
});

exports.publishCatalog = onCall({ ...CALL_OPTIONS, timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  try {
    await requireAdmin(request);
    const { count, parts } = await publishCatalog();
    return { count, parts };
  } catch (err) {
    throw asHttpsError(err);
  }
});

/* ======================================================================== */
/* Product photos — copies of photos from other websites in our own Storage */
/* ======================================================================== */
const PHOTO_TIME = 200 * 1000; // for photos in each catalog refresh (it runs every 5 minutes)

/** The project's Storage bucket (Firebase console → Storage); new projects name it <project>.firebasestorage.app */
function photoBucketName() {
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    return cfg.storageBucket || (cfg.projectId ? `${cfg.projectId}.firebasestorage.app` : "");
  } catch {
    return "";
  }
}

function photoBucket() {
  const name = photoBucketName();
  if (!name) throw new HttpsError("failed-precondition", "Firebase Storage is not turned on", { reason: "NO_STORAGE" });
  return getStorage().bucket(name);
}

const photoError = (err) =>
  err?.code === "NO_STORAGE" ? new HttpsError("failed-precondition", "Turn on Firebase Storage first (Firebase console → Storage)", { reason: "NO_STORAGE" }) : asHttpsError(err);

/** Copy the photos of these products, two products at a time, until `until` */
async function copyWaitingPhotos(ids, until) {
  const queue = [...ids];
  let products = 0;
  let stop = null;
  try {
    const bucket = photoBucket();
    const worker = async () => {
      while (queue.length && !stop && Date.now() < until) {
        const id = queue.shift();
        try {
          await copyProductPhotos(db.collection(COL.products).doc(id), bucket, { logger });
          products += 1;
        } catch (err) {
          if (err.code === "NO_STORAGE") stop = err;
          else logger.warn("Product photos not copied", { id, error: err.message });
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } catch (err) {
    stop = err;
  }
  if (stop) logger.warn("Product photos can't be copied: turn on Firebase Storage (Firebase console → Storage → Get started)", { error: stop.message });
  logger.info("Product photos copied", { products, left: queue.length });
}

/** Admins: copy these products' photos now → { items: [{ id, copied, removed, failed }] } (a few products per call) */
exports.copyPhotos = onCall({ ...CALL_OPTIONS, timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  try {
    await requireAdmin(request);
    const asked = Array.isArray(request.data?.ids) ? request.data.ids : [];
    const ids = [...new Set(asked.filter((x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x)))].slice(0, 6);
    if (!ids.length) throw new HttpsError("invalid-argument", "Which products?");
    const bucket = photoBucket();
    const items = [];
    for (const id of ids) items.push({ id, ...(await copyProductPhotos(db.collection(COL.products).doc(id), bucket, { logger })) });
    return { items };
  } catch (err) {
    throw photoError(err);
  }
});

/* ======================================================================== */
/* Walmart.ca through the BlueCart API — admins search and check store stock  */
/* ======================================================================== */
const PER_CALL = 9; // product checks per call (each one is a paid BlueCart request)

/** BlueCart errors → messages the admin can act on */
function bluecartError(err) {
  if (err instanceof HttpsError) return err;
  if (err.status === undefined) return asHttpsError(err);
  const reason = [401, 403].includes(err.status) ? "BAD_KEY" : [402, 429].includes(err.status) ? "NO_CREDITS" : "BLUECART";
  return new HttpsError("unavailable", `BlueCart: ${err.message}`, { reason, status: err.status, message: err.message });
}

exports.walmart = onCall({ ...CALL_OPTIONS, timeoutSeconds: 540, memory: "512MiB" }, async (request) => {
  try {
    await requireAdmin(request);
    const cfg = (await db.collection(COL.integrations).doc("bluecart").get()).data() || {};
    const apiKey = P.clean(cfg.apiKey, 200);
    if (!apiKey) throw new HttpsError("failed-precondition", "Add your BlueCart API key first", { reason: "NO_KEY" });
    const data = request.data || {};

    if (data.action === "search") {
      const term = P.clean(data.term, 120);
      if (term.length < 2) throw new HttpsError("invalid-argument", "Write what to look for", { reason: "NO_TERM" });
      const page = Math.min(100, Math.max(1, Math.floor(Number(data.page) || 1)));
      const body = await bluecart(apiKey, { type: "search", search_term: term, page: String(page) });
      return { ...searchResults(body), credits: creditsLeft(body) };
    }

    if (data.action === "products") {
      const storeId = P.clean(String(cfg.storeId || ""), 20);
      if (!/^\d+$/.test(storeId)) throw new HttpsError("failed-precondition", "Add your Walmart store number first", { reason: "NO_STORE" });
      const asked = (Array.isArray(data.itemIds) ? data.itemIds : []).map((x) => P.clean(String(x), 40));
      const ids = [...new Set(asked.filter((x) => /^[A-Za-z0-9]+$/.test(x)))].slice(0, PER_CALL);
      const items = [];
      let credits = null;
      let stop = null;
      // three at a time; a bad key or no credits left stops the rest
      for (let i = 0; i < ids.length && !stop; i += 3) {
        const done = await Promise.all(
          ids.slice(i, i + 3).map(async (itemId) => {
            try {
              const body = await bluecart(apiKey, { type: "product", item_id: itemId, store_id: storeId });
              credits = creditsLeft(body) ?? credits;
              return { itemId, ok: true, product: productInfo(body) };
            } catch (err) {
              if ([401, 402, 403, 429].includes(err.status)) stop = err;
              return { itemId, ok: false, error: err.message };
            }
          }),
        );
        items.push(...done);
      }
      if (stop && !items.some((x) => x.ok)) throw bluecartError(stop);
      return { items, credits };
    }

    throw new HttpsError("invalid-argument", "Unknown action");
  } catch (err) {
    throw bluecartError(err);
  }
});
