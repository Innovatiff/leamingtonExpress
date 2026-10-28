// Employee app backend (drivers, couriers and trip guides). It uses its own
// Firebase app instance, so an employee's sign-in on a phone stays separate
// from a customer session in the store on the same phone.
// What an employee may read or change is enforced by firestore.rules.
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { COL, firebaseConfig } from "@/config/firebase";
import { bookingIsOpen, deliveryIsOpen, RIDE_TIME, RIDE_WAITING, staffSnapshot, TRIP_BOOKED, TRIP_TIME } from "@/lib/dispatch";

export const MODE = "firebase";
/** Demo-only (see src/services/demo/team.js). */
export const demoStaffList = null;

const app = getApps().find((a) => a.name === "team") || initializeApp(firebaseConfig, "team");
const db = getFirestore(app);
const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

const withId = (d) => ({ id: d.id, ...d.data() });

/** Thrown when another employee took the job first (or it was cancelled). */
export class JobTakenError extends Error {
  constructor() {
    super("This job was already taken");
    this.code = "job/taken";
  }
}

// Once someone else takes a job, the rules stop letting other employees read
// it — for the one who was a second too late that means "already taken".
async function taking(fn) {
  try {
    await fn();
  } catch (err) {
    if (err?.code === "permission-denied") throw new JobTakenError();
    throw err;
  }
}

/* -------------------------------- Auth ---------------------------------- */
export const onTeamAuth = (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email || "" } : null));
export const teamSignIn = (email, password) => signInWithEmailAndPassword(auth, String(email).trim(), password);
export const teamSignOut = () => signOut(auth);
export const teamSendReset = (email) => sendPasswordResetEmail(auth, String(email).trim());

/* ------------------------------ My profile ------------------------------ */
export function subscribeStaff(uid, onData, onError) {
  return onSnapshot(doc(db, COL.staff, uid), (snap) => onData(snap.exists() ? { id: snap.id, uid: snap.id, ...snap.data() } : null), onError);
}

/** Available / not available for new jobs (the office sees it too). */
export const setOnline = (uid, online) => updateDoc(doc(db, COL.staff, uid), { online, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });

/** "Still here" while the app is open, so the office knows who is really online. */
export const heartbeat = (uid) => updateDoc(doc(db, COL.staff, uid), { lastSeenAt: serverTimestamp() });

/* --------------------------------- Jobs --------------------------------- */
const JOB_COL = { rides: COL.rides, deliveries: COL.orders, trips: COL.bookings };
const OWNER_FIELD = { rides: "driverUid", deliveries: "courierUid", trips: "guideUid" };

/** Jobs nobody has taken yet, for one skill. */
export function subscribeOpenJobs(skill, onData, onError) {
  const col = collection(db, JOB_COL[skill]);
  const q =
    skill === "rides"
      ? query(col, where("driverUid", "==", null), where("status", "in", RIDE_WAITING))
      : skill === "deliveries"
        ? query(col, where("courierUid", "==", null), where("status", "==", "Opened"))
        : query(col, where("guideUid", "==", null), where("status", "in", TRIP_BOOKED));
  return onSnapshot(q, (snap) => onData(snap.docs.map(withId)), onError);
}

/** Every job this employee has taken (active and finished). */
export function subscribeMyJobs(skill, uid, onData, onError) {
  const q = query(collection(db, JOB_COL[skill]), where(OWNER_FIELD[skill], "==", uid));
  return onSnapshot(q, (snap) => onData(snap.docs.map(withId)), onError);
}

/* Rides ------------------------------------------------------------------- */
export async function acceptRide(id, staff) {
  const ref = doc(db, COL.rides, id);
  await taking(() =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const r = snap.exists() ? snap.data() : null;
      if (!r || r.driverUid || !RIDE_WAITING.includes(r.status)) throw new JobTakenError();
      tx.update(ref, { driverUid: staff.uid, driver: staffSnapshot(staff), status: "assigned", assignedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }),
  );
}

export const rideStep = (id, status) =>
  updateDoc(doc(db, COL.rides, id), { status, [RIDE_TIME[status]]: serverTimestamp(), updatedAt: serverTimestamp() });

/** Give the ride back (before the passenger is on board) so someone else can take it. */
export const releaseRide = (id) =>
  updateDoc(doc(db, COL.rides, id), { driverUid: null, driver: null, status: "requested", assignedAt: null, arrivedAt: null, updatedAt: serverTimestamp() });

/* Deliveries -------------------------------------------------------------- */
export async function acceptDelivery(id, staff) {
  const ref = doc(db, COL.orders, id);
  await taking(() =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const o = snap.exists() ? snap.data() : null;
      if (!o || !deliveryIsOpen(o)) throw new JobTakenError();
      tx.update(ref, { courierUid: staff.uid, courier: staffSnapshot(staff), courierAt: serverTimestamp(), fulfilment: "Preparing", updatedAt: serverTimestamp() });
    }),
  );
}

/** "picked_up" (left with the order) or "delivered" (handed to the customer). */
export function deliveryStepTo(id, step, { cashCollected = false } = {}) {
  const ref = doc(db, COL.orders, id);
  if (step === "picked_up") return updateDoc(ref, { fulfilment: "Out for delivery", pickedUpAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return updateDoc(ref, {
    fulfilment: "Fulfilled",
    deliveredAt: serverTimestamp(),
    ...(cashCollected ? { payment: "Success", paidAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export const releaseDelivery = (id) =>
  updateDoc(doc(db, COL.orders, id), { courierUid: null, courier: null, courierAt: null, updatedAt: serverTimestamp() });

/* Trips (a departure = every confirmed booking of a trip on a date) -------- */
export async function acceptDeparture(ids, staff) {
  const refs = ids.map((id) => doc(db, COL.bookings, id));
  await taking(() =>
    runTransaction(db, async (tx) => {
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      const open = snaps.filter((snap) => snap.exists() && bookingIsOpen(snap.data()));
      if (!open.length) throw new JobTakenError();
      const guide = staffSnapshot(staff);
      open.forEach((snap) =>
        tx.update(snap.ref, { guideUid: staff.uid, guide, tripStage: "assigned", guideAt: serverTimestamp(), updatedAt: serverTimestamp() }),
      );
    }),
  );
}

export async function departureStep(ids, step) {
  await runTransaction(db, async (tx) => {
    const refs = ids.map((id) => doc(db, COL.bookings, id));
    await Promise.all(refs.map((ref) => tx.get(ref)));
    refs.forEach((ref) =>
      tx.update(ref, {
        tripStage: step,
        [TRIP_TIME[step]]: serverTimestamp(),
        ...(step === "completed" ? { status: "completed" } : {}),
        updatedAt: serverTimestamp(),
      }),
    );
  });
}

export async function releaseDeparture(ids) {
  await runTransaction(db, async (tx) => {
    const refs = ids.map((id) => doc(db, COL.bookings, id));
    await Promise.all(refs.map((ref) => tx.get(ref)));
    refs.forEach((ref) => tx.update(ref, { guideUid: null, guide: null, tripStage: "", guideAt: null, updatedAt: serverTimestamp() }));
  });
}
