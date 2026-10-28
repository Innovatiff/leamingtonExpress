import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as backend from "@backend";
import { CITY } from "@/config/site";
import { computeTotals, lineKey, MAX_QTY_PER_LINE } from "@/lib/cart";
import { readJSON, removeKey, writeJSON } from "@/lib/storage";
import { useCatalog } from "./CatalogContext";
import { useSettings } from "./SettingsContext";

const CartContext = createContext(null);
const KEY = `lx_cart_${CITY.id}`;
const PROMO_KEY = `lx_promo_${CITY.id}`;
const LEGACY_KEY = "express_guest_cart_v1"; // cart saved by the previous site

function loadItems() {
  const items = readJSON(KEY, null);
  if (Array.isArray(items)) return items;
  // Bring over a cart from the old site (same browser, same domain)
  const legacy = readJSON(LEGACY_KEY, []);
  removeKey(LEGACY_KEY);
  return (Array.isArray(legacy) ? legacy : [])
    .filter((x) => x?.docId)
    .map((x) => ({
      id: String(x.docId),
      variant: x.variant && x.variant !== "not added" && x.variant !== "Default" ? String(x.variant) : "",
      qty: Math.max(1, Math.min(MAX_QTY_PER_LINE, Number(x.quantity || x.qty) || 1)),
      addedAt: Date.now(),
      snap: { name: x.name || "", price: Number(x.price) || 0, image: x.image || "" },
    }));
}

export function CartProvider({ children }) {
  const { byId, status } = useCatalog();
  const settings = useSettings();
  const [items, setItems] = useState(loadItems);
  const [promo, setPromo] = useState(() => readJSON(PROMO_KEY, null, "session"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => writeJSON(KEY, items), [items]);
  useEffect(() => writeJSON(PROMO_KEY, promo, "session"), [promo]);

  const lines = useMemo(
    () =>
      items.map((it) => {
        const p = byId.get(it.id);
        const key = lineKey(it.id, it.variant);
        if (!p) {
          return {
            key,
            id: it.id,
            variant: it.variant,
            qty: it.qty,
            name: it.snap?.name || "",
            image: it.snap?.image || "",
            price: it.snap?.price || 0,
            compareAt: 0,
            points: 0,
            maxQty: MAX_QTY_PER_LINE,
            product: null,
            pending: status === "loading",
            unavailable: status === "ready",
          };
        }
        const maxQty = p.stock == null ? MAX_QTY_PER_LINE : Math.min(MAX_QTY_PER_LINE, p.stock);
        return {
          key,
          id: it.id,
          variant: it.variant,
          qty: it.qty,
          name: p.name,
          image: p.image,
          price: p.price,
          compareAt: p.compareAt,
          points: p.points,
          maxQty,
          product: p,
          unavailable: !p.inStock,
          overStock: p.stock != null && it.qty > p.stock,
        };
      }),
    [items, byId, status],
  );

  const totals = useMemo(
    () =>
      computeTotals(lines, {
        deliveryFee: Number(settings.store.deliveryFee) || 0,
        freeDeliveryOver: Number(settings.store.freeDeliveryOver) || 0,
        discount: promo?.amount || 0,
      }),
    [lines, settings.store.deliveryFee, settings.store.freeDeliveryOver, promo],
  );

  /** Add to cart; returns how many units were actually added (stock-limited). */
  const add = useCallback(
    (product, { variant = "", qty = 1 } = {}) => {
      const max = product.stock == null ? MAX_QTY_PER_LINE : Math.min(MAX_QTY_PER_LINE, product.stock);
      const idx = items.findIndex((x) => x.id === product.id && (x.variant || "") === (variant || ""));
      const current = idx >= 0 ? items[idx].qty : 0;
      const newQty = Math.min(max, current + qty);
      const added = newQty - current;
      if (added <= 0) return 0;
      setItems(
        idx >= 0
          ? items.map((x, i) => (i === idx ? { ...x, qty: newQty } : x))
          : [
              ...items,
              {
                id: product.id,
                variant: variant || "",
                qty: newQty,
                addedAt: Date.now(),
                snap: { name: product.name, price: product.price, image: product.image },
              },
            ],
      );
      return added;
    },
    [items],
  );

  const setQty = useCallback((key, qty) => {
    setItems((list) =>
      list.map((x) => (lineKey(x.id, x.variant) === key ? { ...x, qty: Math.max(1, Math.min(MAX_QTY_PER_LINE, qty)) } : x)),
    );
  }, []);

  const remove = useCallback((key) => setItems((list) => list.filter((x) => lineKey(x.id, x.variant) !== key)), []);

  const clear = useCallback(() => {
    setItems([]);
    setPromo(null);
  }, []);

  const applyPromo = useCallback(async (code) => {
    const res = await backend.validateDiscount({ code: code.trim(), subtotal: totals.subtotal, city: CITY.id });
    if (res?.valid) setPromo({ code: res.code, amount: res.amount });
    return res;
  }, [totals.subtotal]);

  // Keep the stored promo amount within the current subtotal
  useEffect(() => {
    if (promo && totals.subtotal === 0 && items.length === 0) setPromo(null);
  }, [promo, totals.subtotal, items.length]);

  const value = useMemo(
    () => ({
      items,
      lines,
      totals,
      count: totals.count,
      add,
      setQty,
      remove,
      clear,
      promo,
      applyPromo,
      removePromo: () => setPromo(null),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [items, lines, totals, add, setQty, remove, clear, promo, applyPromo, drawerOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
