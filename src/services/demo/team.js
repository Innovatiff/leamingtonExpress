// Demo employee-app backend — same functions as src/services/firebase/team.js,
// stored in this browser. Sign in with any demo employee's email (no password needed).
import { bookingIsOpen, deliveryIsOpen, RIDE_TIME, RIDE_WAITING, staffSnapshot, TRIP_BOOKED, TRIP_TIME } from "@/lib/dispatch";
import { readJSON, writeJSON } from "@/lib/storage";
import * as dbx from "./db";

export const MODE = "demo";

export class JobTakenError extends Error {
  constructor() {
    super("This job was already taken");
    this.code = "job/taken";
  }
}

/* -------------------------------- Auth ---------------------------------- */
// Separate from the store's demo sign-in, like the real app.
const AUTH_KEY = "lx_demo_team_auth";
const listeners = new Set();
const emitAuth = () => listeners.forEach((cb) => cb(readJSON(AUTH_KEY, null)));

export function onTeamAuth(cb) {
  listeners.add(cb);
  queueMicrotask(() => cb(readJSON(AUTH_KEY, null)));
  return () => listeners.delete(cb);
}

export async function teamSignIn(email) {
  await dbx.delay(400);
  const staff = dbx.all("staff").find((s) => s.email === String(email).trim().toLowerCase());
  if (!staff) throw Object.assign(new Error("No employee with that email"), { code: "auth/invalid-credential" });
  writeJSON(AUTH_KEY, { uid: staff.id, email: staff.email });
  emitAuth();
}

export async function teamSignOut() {
  writeJSON(AUTH_KEY, null);
  emitAuth();
}

export const teamSendReset = async () => dbx.delay(300);

/** Demo-only: the sample employees to pick from on the sign-in screen. */
export const demoStaffList = () => dbx.all("staff").filter((s) => s.active !== false);

/* ------------------------------ My profile ------------------------------ */
export function subscribeStaff(uid, onData) {
  return dbx.subscribe("staff", (list) => {
    const s = list.find((x) => x.id === uid);
    onData(s ? { ...s, uid: s.id } : null);
  });
}

export async function setOnline(uid, online) {
  dbx.patch("staff", uid, { online, lastSeenAt: dbx.nowTs() });
}

export async function heartbeat(uid) {
  if (dbx.get("staff", uid)) dbx.patch("staff", uid, { lastSeenAt: dbx.nowTs() });
}

/* --------------------------------- Jobs --------------------------------- */
const JOB_COL = { rides: "rides", deliveries: "orders", trips: "bookings" };
const OWNER_FIELD = { rides: "driverUid", deliveries: "courierUid", trips: "guideUid" };

export function subscribeOpenJobs(skill, onData) {
  return dbx.subscribe(JOB_COL[skill], (list) =>
    onData(
      list.filter((r) =>
        skill === "rides"
          ? r.driverUid === null && RIDE_WAITING.includes(r.status)
          : skill === "deliveries"
            ? r.courierUid === null && r.status === "Opened"
            : r.guideUid === null && TRIP_BOOKED.includes(r.status),
      ),
    ),
  );
}

export function subscribeMyJobs(skill, uid, onData) {
  return dbx.subscribe(JOB_COL[skill], (list) => onData(list.filter((r) => r[OWNER_FIELD[skill]] === uid)));
}

const now = () => dbx.nowTs();

/* Rides ------------------------------------------------------------------- */
export async function acceptRide(id, staff) {
  await dbx.delay(350);
  const r = dbx.get("rides", id);
  if (!r || r.driverUid || !RIDE_WAITING.includes(r.status)) throw new JobTakenError();
  dbx.patch("rides", id, { driverUid: staff.uid, driver: staffSnapshot(staff), status: "assigned", assignedAt: now() });
}

export async function rideStep(id, status) {
  await dbx.delay(250);
  dbx.patch("rides", id, { status, [RIDE_TIME[status]]: now() });
}

export async function releaseRide(id) {
  await dbx.delay(250);
  dbx.patch("rides", id, { driverUid: null, driver: null, status: "requested", assignedAt: null, arrivedAt: null });
}

/* Deliveries -------------------------------------------------------------- */
export async function acceptDelivery(id, staff) {
  await dbx.delay(350);
  const o = dbx.get("orders", id);
  if (!o || !deliveryIsOpen(o)) throw new JobTakenError();
  dbx.patch("orders", id, { courierUid: staff.uid, courier: staffSnapshot(staff), courierAt: now(), fulfilment: "Preparing" });
}

export async function deliveryStepTo(id, step, { cashCollected = false } = {}) {
  await dbx.delay(250);
  if (step === "picked_up") dbx.patch("orders", id, { fulfilment: "Out for delivery", pickedUpAt: now() });
  else dbx.patch("orders", id, { fulfilment: "Fulfilled", deliveredAt: now(), ...(cashCollected ? { payment: "Success", paidAt: now() } : {}) });
}

export async function releaseDelivery(id) {
  await dbx.delay(250);
  dbx.patch("orders", id, { courierUid: null, courier: null, courierAt: null });
}

/* Trips ------------------------------------------------------------------- */
export async function acceptDeparture(ids, staff) {
  await dbx.delay(350);
  const open = ids.map((id) => dbx.get("bookings", id)).filter((b) => b && bookingIsOpen(b));
  if (!open.length) throw new JobTakenError();
  const guide = staffSnapshot(staff);
  open.forEach((b) => dbx.patch("bookings", b.id, { guideUid: staff.uid, guide, tripStage: "assigned", guideAt: now() }));
}

export async function departureStep(ids, step) {
  await dbx.delay(250);
  ids.forEach((id) => dbx.patch("bookings", id, { tripStage: step, [TRIP_TIME[step]]: now(), ...(step === "completed" ? { status: "completed" } : {}) }));
}

export async function releaseDeparture(ids) {
  await dbx.delay(250);
  ids.forEach((id) => dbx.patch("bookings", id, { guideUid: null, guide: null, tripStage: "", guideAt: null }));
}

/* Live map ---------------------------------------------------------------- */
const finite = (v, max) => (Number.isFinite(v) && v >= 0 && v <= max ? v : null);

export async function sharePosition(tokens, p) {
  const data = { lat: p.lat, lng: p.lng, heading: finite(p.heading, 360), speed: finite(p.speed, 100), accuracy: finite(p.accuracy, 100000), at: now() };
  tokens.forEach((token) => dbx.put("live", { id: token, ...data }));
}

export async function clearPosition(tokens) {
  tokens.forEach((token) => dbx.remove("live", token));
}
