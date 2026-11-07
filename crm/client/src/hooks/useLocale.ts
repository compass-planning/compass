/**
 * client/src/hooks/useLocale.ts
 *
 * Planning-suite locale hook. Backed by the CRM LanguageContext so every
 * planning tab follows the same EN/FR switch as the rest of the CRM.
 */
import { useLanguage } from "@/contexts/LanguageContext";

export function useLocale() {
  const { t, locale, setLocale, isFrench, isForced } = useLanguage();
  return { t, locale, setLocale, isFrench, isForced };
}
