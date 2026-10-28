import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as backend from "@backend";
import { CITY } from "@/config/site";
import { categoryLabel, departmentLabel, isListed, normalizeProduct } from "@/lib/products";
import { buildVocabulary } from "@/lib/search";
import { normalize } from "@/lib/text";

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    return backend.subscribeProducts(
      (docs) => setRaw(docs),
      (err) => {
        console.error("Products failed to load", err);
        setError(err);
      },
    );
  }, [attempt]);

  const value = useMemo(() => {
    const products = (raw || []).map((d) => normalizeProduct(d, d.id)).filter((p) => isListed(p, CITY.id));
    const byId = new Map(products.map((p) => [p.id, p]));

    // department → categories tree (with counts)
    const deptMap = new Map();
    for (const p of products) {
      const dKey = normalize(p.department) || "other";
      if (!deptMap.has(dKey)) deptMap.set(dKey, { key: dKey, value: p.department || "Other", count: 0, categories: new Map() });
      const dept = deptMap.get(dKey);
      dept.count += 1;
      const cKey = normalize(p.category);
      if (!dept.categories.has(cKey)) dept.categories.set(cKey, { key: cKey, value: p.category, count: 0, image: p.image });
      dept.categories.get(cKey).count += 1;
    }
    const departments = [...deptMap.values()]
      .map((d) => ({ ...d, categories: [...d.categories.values()].sort((a, b) => b.count - a.count) }))
      .sort((a, b) => b.count - a.count);
    const categories = departments.flatMap((d) => d.categories).sort((a, b) => b.count - a.count);

    const brandCounts = new Map();
    for (const p of products) if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    const brands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    const vocab = buildVocabulary(products, { category: (c) => categoryLabel(c, "es") });
    const vocabEn = buildVocabulary(products, { category: (c) => categoryLabel(c, "en") });

    return {
      status: error ? "error" : raw ? "ready" : "loading",
      error,
      retry: () => setAttempt((n) => n + 1),
      products,
      byId,
      departments,
      categories,
      brands,
      vocab: { es: vocab, en: vocabEn },
      label: { category: categoryLabel, department: departmentLabel },
    };
  }, [raw, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}
