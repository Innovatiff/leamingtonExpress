// Admin-only Firestore access. Loaded only inside the /admin bundle.
// Security is enforced by firestore.rules (express_admins / owner UID).
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COL } from "@/config/firebase";
import { staffSnapshot } from "@/lib/dispatch";
import { db, functions } from "./app";

const withId = (d) => ({ id: d.id, ...d.data() });
const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;

export function subscribeCollection(name, onData, onError) {
  return onSnapshot(collection(db, COL[name]), (snap) => onData(snap.docs.map(withId)), onError);
}

export async function updateRecord(name, id, patch) {
  await updateDoc(doc(db, COL[name], id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteRecord(name, id) {
  await deleteDoc(doc(db, COL[name], id));
}

/* ------------------------------- Products ------------------------------- */
export async function saveProduct(id, publicData, privateData) {
  let productId = id;
  if (id) {
    // When the editor sends private data, drop any copy left in the public doc
    // (pricing is replaced as a whole, so its old cost/profit go with it).
    const cleanup = privateData ? { sourceName: deleteField(), sourceLink: deleteField(), stockLocation: deleteField() } : {};
    await updateDoc(doc(db, COL.products, id), { ...publicData, ...cleanup, updatedAt: serverTimestamp() });
  } else {
    const ref = await addDoc(collection(db, COL.products), {
      ...publicData,
      performance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    productId = ref.id;
  }
  if (privateData) {
    await setDoc(
      doc(db, COL.productsPrivate, productId),
      { ...privateData, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  return productId;
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, COL.products, id));
  await deleteDoc(doc(db, COL.productsPrivate, id)).catch(() => {});
}

const PRIVATE_FIELDS = ["sourceName", "sourceLink", "stockLocation"];

/** Does this public product doc still hold cost / supplier data? */
export function hasExposedPrivateData(raw) {
  return (
    raw?.pricing?.cost !== undefined ||
    raw?.pricing?.profitRange !== undefined ||
    PRIVATE_FIELDS.some((f) => raw?.[f] !== undefined)
  );
}

/**
 * One-time clean-up: copy cost/supplier fields into express_products_private
 * (admins only) and delete them from the public product documents.
 */
export async function migratePrivateFields(rawProducts) {
  const todo = rawProducts.filter(hasExposedPrivateData);
  for (let i = 0; i < todo.length; i += 200) {
    const batch = writeBatch(db);
    for (const p of todo.slice(i, i + 200)) {
      const priv = {
        cost: Number(p.pricing?.cost) || 0,
        sourceName: p.sourceName || "",
        sourceLink: p.sourceLink || "",
        stockLocation: p.stockLocation || "",
        migratedAt: serverTimestamp(),
      };
      batch.set(doc(db, COL.productsPrivate, p.id), priv, { merge: true });
      batch.update(doc(db, COL.products, p.id), {
        "pricing.cost": deleteField(),
        "pricing.profitRange": deleteField(),
        sourceName: deleteField(),
        sourceLink: deleteField(),
        stockLocation: deleteField(),
      });
    }
    await batch.commit();
  }
  return todo.length;
}

/* ------------------------------- Pricing -------------------------------- */
export async function savePricing(data) {
  await setDoc(doc(db, COL.pricing, "default"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** New selling prices for many products: [{ id, pricing: { price, currentPrice }, cost }] */
export async function applyPrices(changes, onProgress) {
  for (let i = 0; i < changes.length; i += 200) {
    const batch = writeBatch(db);
    for (const c of changes.slice(i, i + 200)) {
      batch.update(doc(db, COL.products, c.id), { pricing: c.pricing, updatedAt: serverTimestamp() });
      batch.set(doc(db, COL.productsPrivate, c.id), { cost: c.cost, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    onProgress?.(Math.min(changes.length, i + 200));
  }
}

/**
 * Many products at once (the import): [{ id (existing product, or null for a new
 * one), publicData, privateData }]. → ids, in the same order.
 */
export async function importProducts(rows, onProgress) {
  const ids = [];
  for (let i = 0; i < rows.length; i += 200) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + 200)) {
      const ref = row.id ? doc(db, COL.products, row.id) : doc(collection(db, COL.products));
      if (row.id) batch.set(ref, { ...row.publicData, updatedAt: serverTimestamp() }, { merge: true });
      else batch.set(ref, { ...row.publicData, performance: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.set(doc(db, COL.productsPrivate, ref.id), { ...row.privateData, updatedAt: serverTimestamp() }, { merge: true });
      ids.push(ref.id);
    }
    await batch.commit();
    onProgress?.(Math.min(rows.length, i + 200));
  }
  return ids;
}

/** Put many products on sale (status "active") or hide them ("hidden"). */
export async function setProductsStatus(ids, status) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, COL.products, id), { status, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
}

/** Update the store's copy of the catalog now (it also updates by itself within minutes). */
export const publishCatalog = () => call("publishCatalog", {});

/* -------------------------------- Trips --------------------------------- */
export async function saveTrip(id, data) {
  await setDoc(doc(db, COL.trips, id), { ...data, updatedAt: serverTimestamp() });
}

export async function seedTrips(trips) {
  const batch = writeBatch(db);
  trips.forEach((t) => batch.set(doc(db, COL.trips, t.id), { ...t, updatedAt: serverTimestamp() }));
  await batch.commit();
}

/* ---------------------------- Discount codes ---------------------------- */
export async function saveDiscount(id, data) {
  if (id) await setDoc(doc(db, COL.discounts, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  else await addDoc(collection(db, COL.discounts), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

/* ------------------------------- Settings ------------------------------- */
export async function saveSettings(cityId, data) {
  await setDoc(doc(db, COL.settings, cityId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/* ------------------------------ Employees ------------------------------- */
// Accounts are created on the server (Cloud Function) so the admin stays signed in.

/** Create or update an employee (and their sign-in). → { uid } */
export const saveStaff = (input) => call("saveStaff", input);

/** Remove an employee: their sign-in is deleted; past jobs keep their name. */
export const deleteStaff = (uid) => call("deleteStaff", { uid });

/* -------------------------------- Dispatch ------------------------------ */
/** Give a ride to an employee (or take it back when `staff` is null). */
export async function assignRide(id, staff) {
  await updateDoc(
    doc(db, COL.rides, id),
    staff
      ? { driverUid: staff.uid, driver: staffSnapshot(staff), status: "assigned", assignedAt: serverTimestamp(), updatedAt: serverTimestamp() }
      : { driverUid: null, driver: null, status: "confirmed", assignedAt: null, arrivedAt: null, updatedAt: serverTimestamp() },
  );
}

export async function assignDelivery(id, staff, fulfilment) {
  await updateDoc(
    doc(db, COL.orders, id),
    staff
      ? {
          courierUid: staff.uid,
          courier: staffSnapshot(staff),
          courierAt: serverTimestamp(),
          ...(fulfilment === "Unfulfilled" || !fulfilment ? { fulfilment: "Preparing" } : {}),
          updatedAt: serverTimestamp(),
        }
      : { courierUid: null, courier: null, courierAt: null, updatedAt: serverTimestamp() },
  );
}

/** Every booking of a departure travels with the same guide. */
export async function assignDeparture(ids, staff) {
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(
      doc(db, COL.bookings, id),
      staff
        ? { guideUid: staff.uid, guide: staffSnapshot(staff), tripStage: "assigned", guideAt: serverTimestamp(), updatedAt: serverTimestamp() }
        : { guideUid: null, guide: null, tripStage: "", guideAt: null, updatedAt: serverTimestamp() },
    );
  }
  await batch.commit();
}

