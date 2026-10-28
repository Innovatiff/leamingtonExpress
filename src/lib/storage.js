// localStorage can throw (private mode, blocked storage) — never let it crash the app.

export function readJSON(key, fallback, store = "local") {
  try {
    const s = store === "session" ? window.sessionStorage : window.localStorage;
    const raw = s.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, store = "local") {
  try {
    const s = store === "session" ? window.sessionStorage : window.localStorage;
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeKey(key, store = "local") {
  try {
    const s = store === "session" ? window.sessionStorage : window.localStorage;
    s.removeItem(key);
  } catch {
    /* ignore */
  }
}
