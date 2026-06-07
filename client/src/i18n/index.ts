/**
 * client/src/i18n/index.ts
 *
 * i18next setup for Compass Planning bilingual support (EN / FR-CA).
 * French is forced for advisors whose province is QC.
 * All other provinces default to English but can toggle manually.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import fr from "./fr";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

/** Determine locale from advisor province. QC → forced French. */
export function localeFromProvince(province?: string | null): Locale {
  return province?.toUpperCase() === "QC" ? "fr" : "en";
}

/** Is this province a forced-French jurisdiction? */
export function isFrenchForced(province?: string | null): boolean {
  return province?.toUpperCase() === "QC";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng:           "en",            // default — overridden by LocaleProvider on login
    fallbackLng:   "en",
    interpolation: { escapeValue: false },
    // Prevent i18next from auto-detecting browser language
    // We control locale explicitly via advisor province
    detection:     undefined,
  });

export default i18n;
