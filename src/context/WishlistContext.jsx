import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";

const WishlistContext = createContext(null);
const KEY = "lx_wishlist";

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(() => {
    const v = readJSON(KEY, []);
    return Array.isArray(v) ? v : [];
  });

  useEffect(() => writeJSON(KEY, ids), [ids]);

  /** Returns true when the product was added, false when removed. */
  const toggle = useCallback(
    (id) => {
      const exists = ids.includes(id);
      setIds(exists ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 100));
      return !exists;
    },
    [ids],
  );

  const value = useMemo(() => ({ ids, has: (id) => ids.includes(id), toggle, count: ids.length }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}

/* Recently viewed products (product page → "Vistos recientemente") */
const RECENT_KEY = "lx_recent";
export function rememberViewed(id) {
  const list = readJSON(RECENT_KEY, []);
  writeJSON(RECENT_KEY, [id, ...list.filter((x) => x !== id)].slice(0, 16));
}
export const recentlyViewed = () => readJSON(RECENT_KEY, []);
