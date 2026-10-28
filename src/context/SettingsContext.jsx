import { createContext, useContext, useEffect, useState } from "react";
import * as backend from "@backend";
import { DEFAULT_SETTINGS } from "@/config/cities";
import { CITY } from "@/config/site";
import { deepMerge } from "@/lib/merge";

const BASE = deepMerge(DEFAULT_SETTINGS, CITY.defaults);
const SettingsContext = createContext(BASE);

/** City settings = defaults ← city defaults ← Firestore express_settings/{city}. */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(BASE);

  useEffect(
    () =>
      backend.subscribeSettings(
        CITY.id,
        (remote) => setSettings(remote ? deepMerge(BASE, remote) : BASE),
        () => setSettings(BASE),
      ),
    [],
  );

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
