import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";
import common from "./messages/common";
import store from "./messages/store";
import ride from "./messages/ride";
import travel from "./messages/travel";
import account from "./messages/account";
import info from "./messages/info";

export const LANGS = ["es", "en"];

const MODULES = [common, store, ride, travel, account, info];
const MESSAGES = { es: {}, en: {} };
for (const mod of MODULES) {
  for (const lang of LANGS) Object.assign(MESSAGES[lang], mod[lang]);
}

function lookup(lang, key) {
  let node = MESSAGES[lang];
  for (const part of key.split(".")) {
    if (node == null) return undefined;
    node = node[part];
  }
  return node;
}

export function translate(lang, key, vars) {
  let value = lookup(lang, key);
  if (value === undefined) value = lookup("es", key);
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (typeof value === "function") return value(vars || {});
  if (typeof value === "string" && vars) {
    return value.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  }
  return value;
}

/** Pick the right language from a bilingual value: { es: "...", en: "..." }. */
export function pick(value, lang) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value[lang] || value.es || value.en || "";
}

const I18nContext = createContext(null);
const STORAGE_KEY = "lx_lang";

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = readJSON(STORAGE_KEY, null);
    return LANGS.includes(stored) ? stored : "es";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    writeJSON(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "es" ? "en" : "es"),
      t: (key, vars) => translate(lang, key, vars),
      tx: (v) => pick(v, lang),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
