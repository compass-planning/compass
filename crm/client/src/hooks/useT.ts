/**
 * client/src/hooks/useT.ts
 *
 * Single hook for ALL translation needs in Compass CRM.
 * Uses LanguageContext as the single source of truth — no i18next dependency.
 *
 * Usage:
 *   const { t, isFr } = useT();
 *   t("nav.dashboard")   → "Tableau de bord"  (when FR)
 *   t("action.save")     → "Enregistrer"       (when FR)
 *   isFr                 → true / false
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/i18n/translations";
import type { Locale } from "@/i18n/translations";

/**
 * Dot-path lookup into the translations object.
 * e.g. get(obj, "nav.dashboard") → obj.nav.dashboard
 */
function get(obj: Record<string, any>, path: string): string {
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return path;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : path;
}

export function useT() {
  const { locale, isFrench, setLocale } = useLanguage();

  // Pick the right translation object based on current locale
  const dict = translations[locale as Locale] ?? translations.en;

  // t() does a dot-path lookup — t("nav.dashboard") → dict.nav.dashboard
  const t = (key: string): string => get(dict as any, key);

  return { t, isFr: isFrench, locale, setLocale };
}
