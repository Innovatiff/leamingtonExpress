// Status vocabularies shared by the admin pages. The tone always travels with
// a text label, so a status never relies on color alone.
import { toDate } from "@/lib/format";
import { recordDate } from "../lib";

export const FULFILMENT = ["Unfulfilled", "Preparing", "Out for delivery", "Fulfilled"];

export const fulfilmentTone = (f) => ({ Unfulfilled: "amber", Preparing: "blue", "Out for delivery": "violet", Fulfilled: "green" })[f || "Unfulfilled"] || "neutral";

export const PAYMENT_STATES = ["Pending", "Success", "Refunded"];
export const paymentTone = (p) => (p === "Success" ? "green" : p === "Pending" || !p ? "amber" : p === "Refunded" ? "neutral" : "red");
export const paymentLabel = (p) => (p === "Success" ? "Paid" : p === "Expired" ? "Not paid" : p || "Pending");

export const RIDE_STATUS = [
  { key: "requested", label: "Requested", tone: "amber" },
  { key: "confirmed", label: "Confirmed", tone: "blue" },
  { key: "assigned", label: "Driver on the way", tone: "violet" },
  { key: "arrived", label: "Driver arrived", tone: "violet" },
  { key: "in_progress", label: "Passenger on board", tone: "violet" },
  { key: "completed", label: "Completed", tone: "green" },
  { key: "cancelled", label: "Cancelled", tone: "neutral" },
];

export const BOOKING_STATUS = [
  { key: "pending", label: "New request", tone: "amber" },
  { key: "confirmed", label: "Confirmed · awaiting deposit", tone: "blue" },
  { key: "deposit_paid", label: "Deposit paid", tone: "violet" },
  { key: "paid", label: "Paid in full", tone: "green" },
  { key: "completed", label: "Travelled", tone: "green" },
  { key: "cancelled", label: "Cancelled", tone: "neutral" },
];

export const statusInfo = (list, key) => list.find((s) => s.key === key) || { key, label: key || "—", tone: "neutral" };

/** When the ride should happen (scheduled time, or when it was requested for ASAP rides). */
export function rideWhen(r) {
  if (r?.schedule?.type === "later") {
    const at = toDate(r.schedule.at);
    if (at) return at;
    const [y, m, d] = String(r.schedule.date || "").split("-").map(Number);
    const [hh, mm] = String(r.schedule.time || "").split(":").map(Number);
    if (y && m && d) return new Date(y, m - 1, d, hh || 0, mm || 0);
  }
  return recordDate(r);
}

export const RIDE_PAYMENT = { cash: "Cash", card: "Card in vehicle", etransfer: "E-transfer" };
export const BOOKING_PAYMENT = { etransfer: "Interac e-Transfer", cash: "Cash", card: "Card (payment link)" };
