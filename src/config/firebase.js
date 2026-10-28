// Public Firebase web config. These values are safe to ship in the browser —
// access is controlled by firestore.rules and the Cloud Functions.
export const firebaseConfig = {
  apiKey: "AIzaSyBgrPM2Pe3jP6N6pfqAqHROY0mXSEPJBRA",
  authDomain: "express-corp.firebaseapp.com",
  projectId: "express-corp",
  storageBucket: "express-corp.firebasestorage.app",
  messagingSenderId: "499821040541",
  appId: "1:499821040541:web:e3347ca4ff4c4dc84e1574",
  measurementId: "G-48WR4267YF",
};

export const FUNCTIONS_REGION = "us-central1";

// The owner account (same UID the old inventory page allowed). More admins can
// be added by creating a document with their UID in `express_admins`.
// Keep in sync with firestore.rules and functions/index.js.
export const OWNER_UIDS = ["FNTtxDJo1RbFw68eVcbkIFGGqza2"];

// Firestore collection names shared by every city. Documents carry a `city`
// field so one Firebase project can serve Leamington, Windsor, London, ...
export const COL = {
  products: "express_products",
  productsPrivate: "express_products_private",
  orders: "express_orders",
  rides: "express_rides",
  bookings: "express_travel_bookings",
  trips: "express_trips",
  discounts: "express_dicount_codes", // existing collection name (sic)
  settings: "express_settings",
  messages: "express_messages",
  admins: "express_admins",
  staff: "express_staff", // employees (drivers, couriers, trip guides)
  tracking: "express_tracking", // customers' live-status pages, written by the Cloud Functions
  users: "users",
};
