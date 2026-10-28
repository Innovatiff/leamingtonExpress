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
import { COL } from "@/config/firebase";
import { db } from "./app";

const withId = (d) => ({ id: d.id, ...d.data() });

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
    await updateDoc(doc(db, COL.products, id), { ...publicData, updatedAt: serverTimestamp() });
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
