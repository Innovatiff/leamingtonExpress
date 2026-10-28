// Production backend: Firestore + Firebase Auth + Cloud Functions.
// The demo backend (src/services/demo) implements the same functions.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { COL, OWNER_UIDS } from "@/config/firebase";
import { newTrackToken } from "@/lib/dispatch";
import { auth, db, functions, startAnalytics } from "./app";

export const MODE = "firebase";
export { startAnalytics };

// Demo-only helpers (see src/services/demo) — not available against the real backend.
export const signInDemoAdmin = null;
export const resetDemo = null;

const withId = (d) => ({ id: d.id, ...d.data() });

/* ---------------------------- Catalog ---------------------------------- */
export function subscribeProducts(onData, onError) {
  return onSnapshot(
    collection(db, COL.products),
    (snap) => onData(snap.docs.map(withId)),
    onError,
  );
}

export function subscribeSettings(cityId, onData, onError) {
  return onSnapshot(
    doc(db, COL.settings, cityId),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  );
}

export async function listTrips(cityId) {
  const snap = await getDocs(query(collection(db, COL.trips), where("cities", "array-contains", cityId)));
  return snap.docs.map(withId);
}

/* ------------------------- Store (Cloud Functions) ---------------------- */
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;

/** → { valid, code, amount, reason } */
export const validateDiscount = (input) => call("validateDiscountCode", input);
/** → { orderId, orderNumber, token, checkoutUrl? } */
export const placeOrder = (input) => call("createOrder", input);
/** → sanitized order */
export const fetchOrder = (input) => call("getOrder", input);
/** Release a card order whose Stripe payment was abandoned. */
export const cancelOrder = (input) => call("cancelOrder", input);

/* ------------------------ Rides / travel / contact ---------------------- */
async function addWithMeta(colName, data, status) {
  const ref = await addDoc(collection(db, colName), {
    ...data,
    status,
    userId: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// Rides and bookings get a private token for the customer's live-status page,
// and an empty driver/guide so employees can find and take them.
export async function createRide(data) {
  const token = newTrackToken();
  const { id } = await addWithMeta(COL.rides, { ...data, trackToken: token, driverUid: null }, "requested");
  return { id, token };
}

export async function createBooking(data) {
  const token = newTrackToken();
  const { id } = await addWithMeta(COL.bookings, { ...data, trackToken: token, guideUid: null }, "pending");
  return { id, token };
}

export const createMessage = (data) => addWithMeta(COL.messages, data, "new");

/* ------------------------------ Live status ----------------------------- */
/** The customer's live view of a ride, order or booking (kept up to date by the Cloud Functions). */
export function subscribeTracking(token, onData, onError) {
  if (!token || token.includes("/")) {
    queueMicrotask(() => onData(null));
    return () => {};
  }
  return onSnapshot(
    doc(db, COL.tracking, token),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  );
}

/** Where the employee is right now (only while they're on the way to the customer). */
export function subscribeLivePosition(token, onData, onError) {
  if (!token || token.includes("/")) {
    queueMicrotask(() => onData(null));
    return () => {};
  }
  return onSnapshot(
    doc(db, COL.tracking, token, "live", "position"),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  );
}

/* -------------------------------- Auth ---------------------------------- */
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp({ email, password, firstName, lastName, phone }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = `${firstName} ${lastName}`.trim();
  await updateProfile(cred.user, { displayName: name });
  // Same shape the previous site used for users/{uid}
  await setDoc(
    doc(db, COL.users, cred.user.uid),
    {
      name,
      email: cred.user.email,
      userInformation: { firstName, lastName, phoneNumber: phone || "", email: cred.user.email },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  const ref = doc(db, COL.users, cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const [firstName = "", ...rest] = String(cred.user.displayName || "").split(" ");
    await setDoc(
      ref,
      {
        name: cred.user.displayName || "",
        email: cred.user.email,
        userInformation: { firstName, lastName: rest.join(" "), phoneNumber: "", email: cred.user.email },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export const signOutUser = () => signOut(auth);
export const sendReset = (email) => sendPasswordResetEmail(auth, email.trim());

/* ------------------------------- Profile -------------------------------- */
export function subscribeProfile(uid, onData, onError) {
  return onSnapshot(doc(db, COL.users, uid), (snap) => onData(snap.exists() ? snap.data() : null), onError);
}

export async function saveProfile(uid, patch) {
  await setDoc(doc(db, COL.users, uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

const MINE = { orders: COL.orders, rides: COL.rides, bookings: COL.bookings };

export async function listMine(kind, uid) {
  const snap = await getDocs(query(collection(db, MINE[kind]), where("userId", "==", uid)));
  return snap.docs.map(withId);
}

export async function checkAdmin(uid) {
  if (!uid) return false;
  if (OWNER_UIDS.includes(uid)) return true;
  try {
    return (await getDoc(doc(db, COL.admins, uid))).exists();
  } catch {
    return false;
  }
}
