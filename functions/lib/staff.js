"use strict";

// Employees (express_staff/{uid}) — input checks for the saveStaff function.

class StaffError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const SKILLS = ["rides", "deliveries", "trips"];
const clean = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Validate what the admin typed → { uid, password, doc }. */
function parseStaffInput(data) {
  const d = data && typeof data === "object" ? data : {};
  const uid = clean(d.uid, 128);
  if (uid && uid.includes("/")) throw new StaffError("invalid-argument", "Bad employee id", { reason: "BAD_ID" });
  const name = clean(d.name, 80);
  if (name.length < 2) throw new StaffError("invalid-argument", "Name is required", { reason: "NAME_REQUIRED" });
  const email = clean(d.email, 120).toLowerCase();
  if (!isEmail(email)) throw new StaffError("invalid-argument", "A valid email is required", { reason: "EMAIL_INVALID" });
  const phone = String(d.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) throw new StaffError("invalid-argument", "A 10-digit phone is required", { reason: "PHONE_INVALID" });
  const password = d.password == null ? "" : String(d.password);
  if (!uid && password.length < 8) throw new StaffError("invalid-argument", "Choose a password with at least 8 characters", { reason: "PASSWORD_SHORT" });
  if (uid && password && password.length < 8) throw new StaffError("invalid-argument", "Choose a password with at least 8 characters", { reason: "PASSWORD_SHORT" });

  const can = {};
  for (const skill of SKILLS) can[skill] = Boolean(d.can && d.can[skill]);
  const v = d.vehicle && typeof d.vehicle === "object" ? d.vehicle : {};
  const seats = Math.max(0, Math.min(60, Math.round(Number(v.seats) || 0)));
  const photo = clean(d.photo, 500);
  const cities = Array.isArray(d.cities) ? [...new Set(d.cities.map((c) => clean(c, 40)).filter(Boolean))].slice(0, 10) : [];

  return {
    uid,
    password,
    doc: {
      name,
      email,
      phone,
      photo: /^https:\/\//.test(photo) ? photo : "",
      active: d.active !== false,
      can,
      vehicle: { make: clean(v.make, 40), model: clean(v.model, 60), color: clean(v.color, 30), plate: clean(v.plate, 16).toUpperCase(), seats },
      cities: cities.length ? cities : ["leamington"],
      notes: clean(d.notes, 500),
    },
  };
}

module.exports = { parseStaffInput, StaffError, SKILLS };
