import { round2 } from "./format";

export const MAX_QTY_PER_LINE = 20;

export const lineKey = (id, variant) => `${id}::${variant || ""}`;

/**
 * Cart totals. The server (functions/createOrder) recomputes these from the
 * real product prices — this is only for display.
 * Prices already include tax (store setting `taxIncluded`).
 */
export function computeTotals(lines, { deliveryFee = 5, freeDeliveryOver = 0, discount = 0 } = {}) {
  let subtotal = 0;
  let savings = 0;
  let points = 0;
  let count = 0;
  for (const l of lines) {
    if (l.unavailable) continue;
    subtotal += l.price * l.qty;
    savings += (l.compareAt > l.price ? l.compareAt - l.price : 0) * l.qty;
    points += (l.points || 0) * l.qty;
    count += l.qty;
  }
  subtotal = round2(subtotal);
  const freeDelivery = freeDeliveryOver > 0 && subtotal >= freeDeliveryOver;
  const delivery = count === 0 || freeDelivery ? 0 : round2(deliveryFee);
  const discountAmount = round2(Math.min(Math.max(0, discount), subtotal));
  return {
    count,
    subtotal,
    savings: round2(savings),
    points,
    delivery,
    freeDelivery,
    toFreeDelivery: freeDeliveryOver > 0 && !freeDelivery ? round2(freeDeliveryOver - subtotal) : 0,
    discount: discountAmount,
    total: round2(subtotal - discountAmount + delivery),
  };
}
