// Installable apps: service worker + "Install app" support.
import { useSyncExternalStore } from "react";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker not registered", err));
  });
}

// Android / desktop Chrome offer installation through this event (iPhone doesn't —
// there you add the app from Safari's Share menu).
let deferred = null;
const subscribers = new Set();
const notify = () => subscribers.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const subscribe = (fn) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

function platform() {
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return { ios, standalone };
}

/** → { canInstall, ios, standalone, install() } */
export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const { ios, standalone } = platform();
  return {
    canInstall: available && !standalone,
    ios: ios && !standalone,
    standalone,
    install: async () => {
      if (!deferred) return false;
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      deferred = null;
      notify();
      return choice?.outcome === "accepted";
    },
  };
}
