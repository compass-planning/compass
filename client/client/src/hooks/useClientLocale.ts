/**
 * client/src/hooks/useClientLocale.ts
 *
 * Client-specific locale — drives labels INSIDE the client workspace.
 * Intentionally does NOT use react-i18next to avoid lazy-load context issues.
 * Uses direct object lookups instead.
 */
import { createContext, useContext } from "react";
import en from "../i18n/en";
import fr from "../i18n/fr";

export type ClientLocale = "en" | "fr";

interface ClientLocaleCtx {
  clientLocale:    ClientLocale;
  setClientLocale: (l: ClientLocale) => void;
}

export const ClientLocaleContext = createContext<ClientLocaleCtx>({
  clientLocale:    "en",
  setClientLocale: () => {},
});

/** Safely get a nested value from an object using dot notation */
function getNestedValue(obj: any, key: string): string {
  const parts = key.split(".");
  let val = obj;
  for (const p of parts) {
    if (val == null || typeof val !== "object") return key;
    val = val[p];
  }
  return typeof val === "string" ? val : key;
}

/**
 * Returns `ct(key)` — translates using the CLIENT's locale.
 * Falls back to English if the key isn't found in French.
 */
export function useClientLocale() {
  const { clientLocale, setClientLocale } = useContext(ClientLocaleContext);

  const translations = clientLocale === "fr" ? fr : en;

  const ct = (key: string): string => {
    const result = getNestedValue(translations, key);
    if (result === key && clientLocale === "fr") {
      // Fallback to English if French key is missing
      return getNestedValue(en, key);
    }
    return result;
  };

  return { ct, clientLocale, setClientLocale, isFrenchClient: clientLocale === "fr" };
}
