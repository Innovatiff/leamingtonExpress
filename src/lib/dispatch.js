// Employees, jobs and the steps every service goes through. Shared by the
// website and client app (live status), the employee app and the admin.
// functions/lib/tracking.js mirrors trackingView() for the Cloud Functions —
// keep the two in sync.
import { orderStage } from "./orders.js";

/** What an employee can be allowed to do. */
export const SKILLS = ["rides", "deliveries", "trips"];

/* -------------------------------- Rides --------------------------------- */
// requested → (confirmed by the office) → assigned (driver on the way)
//   → arrived → in_progress (passenger on board) → completed · or cancelled
export const RIDE_WAITING = ["requested", "confirmed"];
export const RIDE_ACTIVE = ["assigned", "arrived", "in_progress"];
/** Steps a driver can take from each status. */
export const RIDE_NEXT = { assigned: ["arrived", "in_progress"], arrived: ["in_progress"], in_progress: ["completed"] };
/** Time field stamped with each status. */
export const RIDE_TIME = {
  confirmed: "confirmedAt",
  assigned: "assignedAt",
  arrived: "arrivedAt",
  in_progress: "pickedUpAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
};

export const rideIsOpen = (r) => RIDE_WAITING.includes(r?.status) && !r?.driverUid;

/* ----------------------------- Deliveries ------------------------------- */
// Store orders keep their fields (fulfilment: Unfulfilled → Preparing → Out for
// delivery → Fulfilled). A courier accepts it (courierUid, order goes to
// "Preparing"), picks it up ("Out for delivery") and delivers it ("Fulfilled").
export const DELIVERY_NEXT = { assigned: ["picked_up"], picked_up: ["delivered"] };

/** Paid (or pay-on-delivery) open orders that no courier has taken yet. */
export function deliveryIsOpen(o) {
  if (!o || o.courierUid || o.status !== "Opened") return false;
  if (!["Unfulfilled", "Preparing", undefined, ""].includes(o.fulfilment)) return false;
  if (o.paymentMethodKey === "card" && o.payment !== "Success") return false;
  return o.payment !== "Expired";
}

/** Where a courier is with an order they took. */
export function deliveryStep(o) {
  if (o?.status === "Cancelled") return "cancelled";
  if (o?.fulfilment === "Fulfilled" || o?.status === "Closed") return "delivered";
  if (o?.fulfilment === "Out for delivery") return "picked_up";
  return "assigned";
}

/* -------------------------------- Trips --------------------------------- */
// Confirmed bookings of the same trip and date travel together (a departure).
// A guide/driver takes the departure, then marks travellers picked up and the
// trip completed: tripStage "" → assigned → picked_up → completed.
export const TRIP_BOOKED = ["confirmed", "deposit_paid", "paid"];
export const TRIP_NEXT = { assigned: ["picked_up"], picked_up: ["completed"] };
export const TRIP_TIME = { assigned: "guideAt", picked_up: "pickedUpAt", completed: "completedAt" };

export const bookingIsOpen = (b) => TRIP_BOOKED.includes(b?.status) && !b?.guideUid && b?.tripStage !== "completed";
export const departureKey = (b) => `${b.tripId}__${b.date}`;

/* ------------------------------- People --------------------------------- */
/** First name + last initial ("Carlos M."), the way customers see their driver. */
export function shortName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
}

/** What gets copied onto a ride/order/booking when an employee takes it. */
export function staffSnapshot(staff) {
  const v = staff?.vehicle || {};
  return {
    uid: staff?.uid || staff?.id || "",
    name: String(staff?.name || "").trim(),
    phone: String(staff?.phone || "").replace(/\D/g, ""),
    photo: staff?.photo || "",
    vehicle: { make: v.make || "", model: v.model || "", color: v.color || "", plate: v.plate || "" },
  };
}

/** "Honda CR-V · Negra" */
export const vehicleText = (v) => [[v?.make, v?.model].filter(Boolean).join(" "), v?.color].filter(Boolean).join(" · ");

/** Random, unguessable id for a customer's live-status link. */
export function newTrackToken(length = 24) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const arr = new Uint32Array(length);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

/* ------------------------------ Live status ----------------------------- */
const iso = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000).toISOString();
  return null;
};

export function rideStage(r) {
  if (r?.status === "cancelled") return "cancelled";
  if (r?.status === "completed") return "completed";
  if (r?.status === "in_progress") return "in_progress";
  if (r?.status === "arrived") return "arrived";
  if (r?.status === "assigned" && (r.driverUid || r.driver?.name)) return "assigned";
  return "searching";
}

export function orderLiveStage(o) {
  const stage = orderStage(o);
  if (stage === "received" && o?.courierUid) return "preparing";
  return stage;
}

export function bookingStage(b) {
  if (b?.status === "cancelled") return "cancelled";
  if (b?.status === "completed" || b?.tripStage === "completed") return "completed";
  if (b?.tripStage === "picked_up") return "on_trip";
  if (b?.guideUid || b?.tripStage === "assigned") return "assigned";
  if (TRIP_BOOKED.includes(b?.status)) return "confirmed";
  return "pending";
}

function publicStaff(s) {
  if (!s || !(s.name || s.phone)) return null;
  const v = s.vehicle || {};
  return {
    name: shortName(s.name),
    phone: String(s.phone || "").replace(/\D/g, ""),
    photo: s.photo || "",
    vehicle: v.make || v.model || v.plate ? { make: v.make || "", model: v.model || "", color: v.color || "", plate: v.plate || "" } : null,
  };
}

/**
 * The customer's live-status document (express_tracking/{token}): only what the
 * person who asked for the service needs — no internal notes or other people's data.
 */
export function trackingView(kind, r) {
  const base = { kind, city: r.city || "", lang: r.lang || "es", updatedAt: iso(r.updatedAt) || new Date().toISOString() };
  if (kind === "ride") {
    const stage = rideStage(r);
    return {
      ...base,
      ref: r.ref || "",
      stage,
      staff: stage === "searching" || stage === "cancelled" ? null : publicStaff(r.driver),
      times: {
        created: iso(r.createdAt),
        assigned: iso(r.assignedAt),
        arrived: iso(r.arrivedAt),
        pickedUp: iso(r.pickedUpAt),
        completed: iso(r.completedAt),
        cancelled: iso(r.cancelledAt),
      },
      detail: {
        from: r.pickup?.address || "",
        to: r.dropoff?.address || "",
        asap: r.schedule?.type !== "later",
        when: r.schedule?.type === "later" ? r.schedule.at || `${r.schedule.date}T${r.schedule.time}` : null,
        pax: Number(r.passengers) || 1,
        bags: Number(r.luggage) || 0,
        vehicle: r.vehicle || "standard",
        payment: r.payment || "cash",
        estimate: r.estimate ? { low: r.estimate.low, high: r.estimate.high } : null,
        fare: r.fare != null && r.fare !== "" ? Number(r.fare) : null,
      },
    };
  }
  if (kind === "order") {
    const stage = orderLiveStage(r);
    const ci = r.customerInfo || {};
    return {
      ...base,
      ref: r.orderNumber || "",
      stage,
      staff: r.courierUid && stage !== "cancelled" ? publicStaff(r.courier) : null,
      times: {
        created: iso(r.createdAt),
        assigned: iso(r.courierAt),
        pickedUp: iso(r.pickedUpAt),
        completed: iso(r.deliveredAt),
        cancelled: iso(r.cancelledAt),
      },
      detail: {
        orderId: r.id || "",
        items: Number(r.productsCount) || (Array.isArray(r.products) ? r.products.reduce((s, l) => s + (Number(l.quantity) || 0), 0) : 0),
        total: Number(r.total?.finalTotal) || 0,
        payment: r.paymentMethodKey || "",
        paid: r.payment === "Success",
        address: [ci.address, ci.city].filter(Boolean).join(", "),
      },
    };
  }
  // booking
  const stage = bookingStage(r);
  return {
    ...base,
    ref: r.ref || "",
    stage,
    staff: (stage === "assigned" || stage === "on_trip" || stage === "completed") ? publicStaff(r.guide) : null,
    times: {
      created: iso(r.createdAt),
      confirmed: iso(r.confirmedAt),
      assigned: iso(r.guideAt),
      pickedUp: iso(r.pickedUpAt),
      completed: iso(r.completedAt),
      cancelled: iso(r.cancelledAt),
    },
    detail: {
      trip: r.tripTitle || "",
      tripId: r.tripId || "",
      date: r.date || "",
      time: r.departureTime || "",
      people: (Number(r.adults) || 0) + (Number(r.children) || 0),
      total: Number(r.pricing?.total) || 0,
      deposit: Number(r.pricing?.deposit) || 0,
    },
  };
}

/** Is this service still going on (worth showing as "active")? */
export const isLive = (view) => view && !["completed", "delivered", "cancelled"].includes(view.stage);
