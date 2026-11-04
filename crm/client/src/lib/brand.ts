/**
 * Compass brand configuration — one place for names and cross-product URLs.
 *
 * Compass CRM is part of the Compass family alongside Compass Planning (Solo and
 * Advisor editions). The two products are separate deployments, so the shared
 * landing page links across to Compass Planning by URL.
 *
 * Override at build time with VITE_PLANNING_URL (see .env.example).
 */
export const BRAND = {
  family: "Compass",
  crm: "Compass CRM",
  planning: "Compass Planning",
  company: "Westoak Innovations",
} as const;

/** Public site of Compass Planning (Solo + Advisor). */
export const PLANNING_URL: string =
  (import.meta.env.VITE_PLANNING_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://compassplanning.app";
