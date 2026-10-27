"use strict";

import { auth, db } from "../src/myaccount";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/*************************
 * DOM HELPERS
 *************************/
const $ = (sel, root = document) => root.querySelector(sel);

const setText = (sel, value, fallback = "not added") => {
  const el = $(sel);
  if (!el) return;
  const v =
    value === undefined || value === null || value === "" ? fallback : value;
  el.textContent = String(v);
};

const safe = (v, fallback = "not added") =>
  v === undefined || v === null || v === "" ? fallback : v;

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/*************************
 * UI FILLER
 *************************/
function fillAccountUI(account) {
  // account is your Firestore "users/{uid}" document
  console.log("📦 USER ACCOUNT DATA (for UI):", account);

  // Hide auth modals wrapper when signed in
  const accountUserModal = $(".account__user");
  if (accountUserModal) accountUserModal.classList.add("hidden");

  const userInfo = account.userInformation || {};
  const address = account.address || {};

  // Name handling
  // Prefer userInformation.firstName/lastName, otherwise split account.name
  const fallbackSplit = splitName(account.name || "");
  const firstName = safe(
    userInfo.firstName,
    safe(fallbackSplit.firstName, "not added"),
  );
  const lastName = safe(
    userInfo.lastName,
    safe(fallbackSplit.lastName, "not added"),
  );

  // HERO
  setText(".account__hero--box-message-name", firstName, "not added");
  setText(".account__hero--box-points-count", account.expressPoints ?? 0, 0);

  // PERSONAL INFORMATION BOX (in the exact order of your HTML)
  // First Name
  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(1) p",
    firstName,
    "not added",
  );

  // Last Name
  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(2) p",
    lastName,
    "not added",
  );

  // Email Address
  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(3) p",
    userInfo.email ?? account.email,
    "not added",
  );

  // Phone Number
  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(4) p",
    userInfo.phoneNumber ?? account.phoneNumber,
    "not added",
  );

  // User role
  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(5) p",
    userInfo.role,
    "Customer",
  );

  // Express participate
  // You can store boolean like true/false. We show Yes/No.
  const participate =
    userInfo.expressParticipate === true
      ? "Yes"
      : userInfo.expressParticipate === false
        ? "No"
        : "not added";

  setText(
    ".account__box .account__box--details .account__box--details-box:nth-child(6) p",
    participate,
    "not added",
  );

  // ADDRESS BOX (second .account__box on the page)
  // City/Province
  setText(
    ".account__box:nth-of-type(2) .account__box--details .account__box--details-box:nth-child(1) p",
    address.cityProvince,
    "not added",
  );

  // Home Address
  setText(
    ".account__box:nth-of-type(2) .account__box--details .account__box--details-box:nth-child(2) p",
    address.homeAddress,
    "not added",
  );

  // Postal Code
  setText(
    ".account__box:nth-of-type(2) .account__box--details .account__box--details-box:nth-child(3) p",
    address.postalCode,
    "not added",
  );
}

/*************************
 * AUTH + LIVE DATA
 *************************/
let unsubscribeUserDoc = null;

onAuthStateChanged(auth, (user) => {
  console.log("🔐 onAuthStateChanged:", user ? user.uid : "NO USER");

  // Stop previous listener if any
  if (typeof unsubscribeUserDoc === "function") {
    unsubscribeUserDoc();
    unsubscribeUserDoc = null;
  }

  const accountUserModal = $(".account__user");

  if (!user) {
    // Not logged in -> show auth modals wrapper
    if (accountUserModal) accountUserModal.classList.remove("hidden");
    console.log("❌ No user signed in");
    return;
  }

  // Logged in -> listen to their Firestore doc live
  console.log("✅ AUTH USER:", user);

  const userRef = doc(db, "users", user.uid);

  unsubscribeUserDoc = onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) {
        console.warn("⚠️ No Firestore user document found for:", user.uid);
        // Still hide auth modals if user is signed in
        if (accountUserModal) accountUserModal.classList.add("hidden");
        return;
      }

      const data = snap.data();

      // Optional: if you want email available even if not stored in doc
      data.email = data.email ?? user.email ?? null;

      fillAccountUI(data);
    },
    (err) => {
      console.error("❌ onSnapshot user doc error:", err);
    },
  );
});
