/* functions/index.js */
"use strict";

"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

exports.createCheckoutSession = onRequest(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST." });
        return;
      }

      try {
        const body = req.body || {};
        const items = Array.isArray(body.items) ? body.items : [];
        const orderDraft = body.orderDraft || null;
        const successUrl = String(body.successUrl || "");
        const cancelUrl = String(body.cancelUrl || "");

        if (!items.length) {
          res.status(400).json({ error: "Missing items array." });
          return;
        }

        if (!orderDraft || typeof orderDraft !== "object") {
          res.status(400).json({ error: "Missing orderDraft." });
          return;
        }

        if (!successUrl || !cancelUrl) {
          res.status(400).json({ error: "Missing successUrl/cancelUrl." });
          return;
        }

        let stripeKey = String(STRIPE_SECRET_KEY.value() || "").trim();

        if (
          !stripeKey ||
          !stripeKey.startsWith("sk_") ||
          /\s/.test(stripeKey)
        ) {
          throw new Error("STRIPE_SECRET_KEY is invalid.");
        }

        const Stripe = require("stripe");
        const stripe = new Stripe(stripeKey);

        const lineItems = items.map((i) => {
          const name = String(i?.name || "Product");
          const image = String(i?.image || "");
          const price = Number(i?.price || 0);
          const quantity = Math.max(1, Math.floor(Number(i?.quantity || 1)));

          if (!Number.isFinite(price) || price <= 0) {
            throw new Error(`Invalid price for item "${name}".`);
          }

          const productData = { name };
          if (image) productData.images = [image];

          return {
            price_data: {
              currency: "cad",
              product_data: productData,
              unit_amount: Math.round(price * 100),
            },
            quantity,
          };
        });

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            orderDraft: JSON.stringify(orderDraft),
          },
        });

        res.status(200).json({ id: session.id, url: session.url });
      } catch (err) {
        logger.error("createCheckoutSession failed:", err);
        res.status(500).json({
          error: err?.message || "Internal Server Error",
        });
      }
    });
  },
);

exports.stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    try {
      const stripeKey = String(STRIPE_SECRET_KEY.value() || "").trim();
      const webhookSecret = String(STRIPE_WEBHOOK_SECRET.value() || "").trim();

      const Stripe = require("stripe");
      const stripe = new Stripe(stripeKey);

      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).send("Missing stripe-signature header.");
        return;
      }

      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const paid = session.payment_status === "paid";
        if (!paid) {
          res.status(200).send("Event received, payment not paid.");
          return;
        }

        const metadata = session.metadata || {};
        const orderDraftRaw = metadata.orderDraft || "";

        if (!orderDraftRaw) {
          throw new Error("Missing orderDraft in session metadata.");
        }

        const orderDraft = JSON.parse(orderDraftRaw);

        const existingSnap = await db
          .collection("express_orders")
          .where("stripeSessionId", "==", session.id)
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          res.status(200).send("Order already exists.");
          return;
        }

        const finalOrder = {
          ...orderDraft,
          payment: "Success",
          paymentMethod: "Debit / Credit Card",
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("express_orders").add(finalOrder);
      }

      res.status(200).send("Webhook received.");
    } catch (err) {
      logger.error("stripeWebhook failed:", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  },
);
