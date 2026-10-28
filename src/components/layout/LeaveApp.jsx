import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const GUARD = "lx_leave_app";

/**
 * The website, the admin and the employee app are three separate apps (index.html,
 * admin.html, equipo.html). A link into another app needs a real page load so the
 * server hands over the right one.
 */
export default function LeaveApp() {
  const { pathname, search, hash } = useLocation();
  const target = pathname + search + hash;
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // Hosting not configured for the other app? Don't reload forever.
    let last = null;
    try {
      last = JSON.parse(sessionStorage.getItem(GUARD) || "null");
    } catch {
      /* ignore */
    }
    if (last && last.to === target && Date.now() - last.at < 4000) {
      queueMicrotask(() => setStuck(true));
      return;
    }
    try {
      sessionStorage.setItem(GUARD, JSON.stringify({ to: target, at: Date.now() }));
    } catch {
      /* ignore */
    }
    window.location.replace(target);
  }, [target]);

  return stuck ? (
    <p style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      This page could not be opened. <a href="/">Go to the home page</a>
    </p>
  ) : null;
}
