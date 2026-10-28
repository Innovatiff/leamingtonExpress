// Order fields keep the shape the previous site/admin used
// (payment: "Pending"|"Success", fulfilment: "Unfulfilled"|..., status: "Opened"|"Closed"),
// plus the new stages "Preparing" and "Out for delivery".

export const FULFILMENT_STAGES = ["Unfulfilled", "Preparing", "Out for delivery", "Fulfilled"];

/** Customer-facing status key (see i18n order.status.*). */
export function orderStage(o) {
  if (!o) return "received";
  if (o.status === "Cancelled") return "cancelled";
  if (o.fulfilment === "Fulfilled" || o.status === "Closed") return "delivered";
  if (o.fulfilment === "Out for delivery") return "onTheWay";
  if (o.fulfilment === "Preparing") return "preparing";
  if (paymentKey(o) !== "cash" && o.payment !== "Success") return "awaitingPayment"; // paid first
  return "received";
}

export const STAGE_ORDER = ["received", "preparing", "onTheWay", "delivered"];

export function paymentKey(o) {
  if (o?.paymentMethodKey) return o.paymentMethodKey;
  const m = String(o?.paymentMethod || "").toLowerCase();
  if (m.includes("transfer")) return "etransfer";
  if (m.includes("card") || m.includes("tarjeta") || m.includes("debit")) return "card";
  return "cash";
}

export const orderTotal = (o) => Number(o?.total?.finalTotal ?? o?.total ?? 0) || 0;
export const orderItems = (o) => (Array.isArray(o?.products) ? o.products : Array.isArray(o?.items) ? o.items : []);
