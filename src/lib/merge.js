const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

/** Deep merge plain objects (arrays and other values are replaced). */
export function deepMerge(base, ...overrides) {
  let out = { ...base };
  for (const o of overrides) {
    if (!isPlainObject(o)) continue;
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
    }
  }
  return out;
}
