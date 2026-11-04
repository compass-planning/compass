/**
 * server/services/pipedaReportingService-language-patch.ts
 *
 * PATCH INSTRUCTIONS — do not import this file.
 *
 * Apply these changes to server/services/pipedaReportingService.ts
 * to support French-language report generation.
 *
 * ── CHANGE 1 ─────────────────────────────────────────────────────────────────
 * Add `language` to the function signature of generateRetirementNarrative
 * (and any other public generate* functions):
 *
 *   BEFORE:
 *     export async function generateRetirementNarrative(
 *       payload: DeidentifiedSimulationPayload,
 *       reportType: string = "retirement"
 *     ): Promise<string>
 *
 *   AFTER:
 *     export async function generateRetirementNarrative(
 *       payload: DeidentifiedSimulationPayload,
 *       reportType: string = "retirement",
 *       language: "en" | "fr" = "en"
 *     ): Promise<string>
 *
 * ── CHANGE 2 ─────────────────────────────────────────────────────────────────
 * Inside the function, prepend a language instruction to the system prompt:
 *
 *   const languageInstruction = language === "fr"
 *     ? [
 *         "Répondez entièrement en français canadien (registre formel).",
 *         "Utilisez les termes financiers canadiens-français appropriés :",
 *         "  - REER (pas RRSP), FERR (pas RRIF), CELI (pas TFSA)",
 *         "  - RPC (pas CPP), PSV (pas OAS)",
 *         "  - « planification de la retraite » pas « retirement planning »",
 *         "N'utilisez AUCUN mot anglais sauf les noms propres.",
 *       ].join("\n")
 *     : "Respond entirely in English.";
 *
 *   // Prepend to existing system prompt string:
 *   const fullSystemPrompt = languageInstruction + "\n\n" + EXISTING_SYSTEM_PROMPT;
 *
 * ── CHANGE 3 ─────────────────────────────────────────────────────────────────
 * In the planning report route (server/planning/routes.ts or server/routes/reports.ts),
 * thread the language parameter from the request:
 *
 *   const language = (req.query.language as string) === "fr" ? "fr" : "en";
 *   // OR from the authenticated user's preferredLanguage:
 *   const language = (req.user as any)?.preferredLanguage === "fr" ? "fr" : "en";
 *
 *   const narrative = await generateRetirementNarrative(payload, "retirement", language);
 *
 * ── CHANGE 4 ─────────────────────────────────────────────────────────────────
 * In server/planning/reports/comprehensive.ts (and styles.ts), add French
 * label maps so HTML report section headers switch language:
 *
 *   const LABELS = {
 *     en: {
 *       executiveSummary: "Executive Summary",
 *       retirementProjection: "Retirement Projection",
 *       incomeStrategy: "Income Strategy",
 *       protectionAnalysis: "Protection Analysis",
 *       taxPlanning: "Tax Planning",
 *       estatePlanning: "Estate Planning",
 *       assumptions: "Assumptions & Methodology",
 *       disclaimer: "Disclaimer",
 *     },
 *     fr: {
 *       executiveSummary: "Sommaire exécutif",
 *       retirementProjection: "Projection de retraite",
 *       incomeStrategy: "Stratégie de revenu",
 *       protectionAnalysis: "Analyse de protection",
 *       taxPlanning: "Planification fiscale",
 *       estatePlanning: "Planification successorale",
 *       assumptions: "Hypothèses et méthodologie",
 *       disclaimer: "Avertissement",
 *     },
 *   } as const;
 *
 *   // Use as: LABELS[language].executiveSummary
 */

export {};
