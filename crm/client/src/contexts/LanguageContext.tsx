/**
 * client/src/contexts/LanguageContext.tsx
 *
 * Single source of truth for EN/FR language state.
 * - Reads locale from localStorage on mount
 * - Syncs to i18next so any legacy useTranslation() calls also switch
 * - Persists preference to server (non-blocking)
 * - QC province auto-defaults to French
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { translations, type Locale } from "../i18n/translations";
import type { T } from "../i18n/translations";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  locale: Locale;
  t: T;
  setLocale: (l: Locale) => void;
  isFrench: boolean;
  isForced: boolean;
  frT: T;
  enT: T;
}

// ── Context ───────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  locale:    "en",
  t:         translations.en,
  setLocale: () => {},
  isFrench:  false,
  isForced:  false,
  frT:       translations.fr,
  enT:       translations.en,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem("be_locale");
    if (raw === "fr") return "fr";
  } catch { /* ignore */ }
  return "en";
}

function syncI18next(locale: Locale) {
  // Sync i18next instance if it's available (lazy import avoids circular deps)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const i18n = require("../i18n").default;
    if (i18n && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  } catch { /* i18next not available */ }
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface LanguageProviderProps {
  children: ReactNode;
  userProvince?: string | null;
  savedLocale?: string | null;
}

export function LanguageProvider({
  children,
  userProvince,
  savedLocale,
}: LanguageProviderProps) {
  const forced = userProvince?.toUpperCase() === "QC";

  const [locale, setLocaleState] = useState<Locale>(() => {
    if (forced) return "fr";
    if (savedLocale === "fr") return "fr";
    const stored = readStoredLocale();
    return stored;
  });

  // Sync i18next on mount
  useEffect(() => {
    syncI18next(locale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);

    // Sync i18next
    syncI18next(l);

    // Persist to localStorage
    try { localStorage.setItem("be_locale", l); } catch { /* ignore */ }

    // Persist to server — non-blocking
    fetch("/api/crm/settings/language", {
      method:      "PATCH",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ preferredLanguage: l }),
    }).catch(() => {});
  }, []);

  const value: LanguageContextValue = {
    locale,
    t:        translations[locale] ?? translations.en,
    setLocale,
    isFrench: locale === "fr",
    isForced: forced,
    frT:      translations.fr,
    enT:      translations.en,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export type { Locale };
