"use strict";

// Customers' live-status documents (express_tracking/{token}).
// Mirrors trackingView() in src/lib/dispatch.js — keep the two in sync.

const TRIP_BOOKED = ["confirmed", "deposit_paid", "paid"];
// Stages in which the customer sees the employee on a live map (same as src/lib/dispatch.js)
const MAP_STAGES = { ride: ["assigned", "arrived", "in_progress"], order: ["onTheWay"] };

/** { lat, lng } or null. */
function coordsOf(p) {
  if (!p || p.lat == null || p.lng == null || p.lat === "" || p.lng === "") return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function iso(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000).toISOString();
  return null;
}

function shortName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
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

function rideStage(r) {
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "completed") return "completed";
  if (r.status === "in_progress") return "in_progress";
  if (r.status === "arrived") return "arrived";
  if (r.status === "assigned" && (r.driverUid || (r.driver && r.driver.name))) return "assigned";
  return "searching";
}

/** Same as orderStage() in src/lib/orders.js, plus "preparing" once a courier has it. */
function orderStage(o) {
  if (o.status === "Cancelled") return "cancelled";
  if (o.fulfilment === "Fulfilled" || o.status === "Closed") return "delivered";
  if (o.fulfilment === "Out for delivery") return "onTheWay";
  if (o.fulfilment === "Preparing") return "preparing";
  if (o.paymentMethodKey === "card" && o.payment !== "Success") return "awaitingPayment";
  return o.courierUid ? "preparing" : "received";
}

function bookingStage(b) {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "completed" || b.tripStage === "completed") return "completed";
  if (b.tripStage === "picked_up") return "on_trip";
  if (b.guideUid || b.tripStage === "assigned") return "assigned";
  if (TRIP_BOOKED.includes(b.status)) return "confirmed";
  return "pending";
}

function trackingView(kind, r, id) {
  const base = { kind, city: r.city || "", lang: r.lang || "es" };
  // the employee doing it: only they may share their position on this page
  const staffUid = (kind === "ride" ? r.driverUid : kind === "order" ? r.courierUid : r.guideUid) || null;
  if (kind === "ride") {
    const stage = rideStage(r);
    const later = r.schedule && r.schedule.type === "later";
    return {
      ...base,
      ref: r.ref || "",
      stage,
      staffUid,
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
        from: (r.pickup && r.pickup.address) || "",
        to: (r.dropoff && r.dropoff.address) || "",
        asap: !later,
        when: later ? r.schedule.at || `${r.schedule.date}T${r.schedule.time}` : null,
        pax: Number(r.passengers) || 1,
        bags: Number(r.luggage) || 0,
        vehicle: r.vehicle || "standard",
        payment: r.payment || "cash",
        estimate: r.estimate ? { low: r.estimate.low, high: r.estimate.high } : null,
        fare: r.fare != null && r.fare !== "" ? Number(r.fare) : null,
        pickupAt: coordsOf(r.pickup) || coordsOf(r.pickupGeo),
      },
    };
  }
  if (kind === "order") {
    const stage = orderStage(r);
    const ci = r.customerInfo || {};
    const items = Number(r.productsCount) || (Array.isArray(r.products) ? r.products.reduce((s, l) => s + (Number(l.quantity) || 0), 0) : 0);
    return {
      ...base,
      ref: r.orderNumber || "",
      stage,
      staffUid,
      staff: r.courierUid && stage !== "cancelled" ? publicStaff(r.courier) : null,
      times: {
        created: iso(r.createdAt),
        assigned: iso(r.courierAt),
        pickedUp: iso(r.pickedUpAt),
        completed: iso(r.deliveredAt),
        cancelled: iso(r.cancelledAt),
      },
      detail: {
        orderId: id || "",
        items,
        total: Number(r.total && r.total.finalTotal) || 0,
        payment: r.paymentMethodKey || "",
        paid: r.payment === "Success",
        address: [ci.address, ci.city].filter(Boolean).join(", "),
        addressAt: coordsOf(r.addressGeo),
      },
    };
  }
  const stage = bookingStage(r);
  return {
    ...base,
    ref: r.ref || "",
    stage,
    staffUid,
    staff: stage === "assigned" || stage === "on_trip" || stage === "completed" ? publicStaff(r.guide) : null,
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
      total: Number(r.pricing && r.pricing.total) || 0,
      deposit: Number(r.pricing && r.pricing.deposit) || 0,
    },
  };
}

/** The token that names a record's tracking document (rides/bookings: trackToken, orders: their private link token). */
function tokenOf(kind, r) {
  const t = kind === "order" ? r && r.accessToken : r && r.trackToken;
  return typeof t === "string" && /^[A-Za-z0-9_-]{16,96}$/.test(t) ? t : "";
}

module.exports = { trackingView, tokenOf, shortName, rideStage, orderStage, bookingStage, coordsOf, MAP_STAGES };
