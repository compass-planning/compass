/**
 * client/src/hooks/useClientLocale.ts
 *
 * Provides a `ct(key)` helper that resolves dot-notation i18n keys
 * like "netWorth.addAsset" against the translations object.
 *
 * The context approach was replaced with prop-based translations,
 * but MultiEntryTabs still uses ct() directly. This hook bridges
 * the gap without requiring a full refactor of that file.
 */

import { translations } from "../i18n/translations";

export type { ClientLocale } from "../i18n/translations";

type TranslationLeaf = Record<string, string>;
type TranslationBranch = Record<string, TranslationLeaf | string>;

// Keys used in MultiEntryTabs that differ from the translations shape.
// Maps ct() key → actual translation value.
const FALLBACKS: Record<string, string> = {
  "netWorth.netWorth":       "Net Worth",
  "netWorth.asset":          "Asset",
  "netWorth.liability":      "Liability",
  "netWorth.addFirst":       "Add your first",
};

/**
 * Resolve a dot-notation key like "netWorth.addAsset" from the EN translations.
 * Falls back to FALLBACKS, then to the key itself if not found.
 */
function resolve(key: string): string {
  if (FALLBACKS[key] !== undefined) return FALLBACKS[key];

  const parts = key.split(".");
  const locale = (translations as Record<string, TranslationBranch>)["en"];
  if (!locale) return key;

  if (parts.length === 1) {
    const val = locale[parts[0]];
    return typeof val === "string" ? val : key;
  }

  const [section, ...rest] = parts;
  const field = rest.join(".");
  const branch = locale[section];
  if (!branch || typeof branch === "string") return key;

  const val = (branch as TranslationLeaf)[field];
  return typeof val === "string" ? val : key;
}

export function useClientLocale() {
  const ct = (key: string): string => resolve(key);
  return { ct };
}
