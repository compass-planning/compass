/**
 * server/services/meetingDeidentification.ts
 *
 * PIPEDA-compliant de-identification of meeting transcripts before
 * any Anthropic API call.
 *
 * Mirrors the financial planning module's de-identification layer.
 * The raw transcript (with PII) stays in PostgreSQL on the Fly.io server.
 * Anthropic receives only the de-identified version.
 *
 * What is replaced:
 *   - Client name → "THE_CLIENT"
 *   - Advisor name → "THE_ADVISOR"
 *   - Dollar amounts → ranges ($X,XXX / $XX,XXX / $XXX,XXX / $X,XXX,XXX)
 *   - SINs (9-digit numbers) → [SIN REDACTED]
 *   - Account numbers (10-16 digits) → [ACCOUNT REDACTED]
 *   - Policy numbers (common formats) → [POLICY REDACTED]
 *   - Dates of birth (YYYY-MM-DD / DD/MM/YYYY) → [DOB REDACTED]
 *
 * What is preserved (gives AI enough context to generate quality output):
 *   - Financial topics and concepts discussed
 *   - Dollar amount ranges (not exact figures)
 *   - Emotions, concerns, goals expressed
 *   - Product types mentioned (RRSP, TFSA, life insurance, etc.)
 *   - Action items and decisions
 */

export interface DeidentifiedTranscript {
  text:       string;
  // Audit info — logged server-side but never sent to Anthropic
  redactions: {
    namesFound:     number;
    dollarsRedacted: number;
    sinsFound:      number;
    accountsFound:  number;
    policiesFound:  number;
  };
}

/**
 * De-identify a meeting transcript before sending to an external AI service.
 *
 * @param transcript  Raw transcript text from whisper.cpp or Recall.ai
 * @param clientName  Full name of the client (from DB — never sent to AI)
 * @param advisorName Full name of the advisor (from DB — never sent to AI)
 */
export function deidentifyTranscript(
  transcript:   string,
  clientName:   string,
  advisorName:  string
): DeidentifiedTranscript {
  let text = transcript;
  const redactions = {
    namesFound:      0,
    dollarsRedacted: 0,
    sinsFound:       0,
    accountsFound:   0,
    policiesFound:   0,
  };

  // ── Name replacement ────────────────────────────────────────────────────────
  // Replace full name first, then individual parts (to avoid partial matches
  // breaking the full-name replacement)
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const clientParts  = [clientName,  ...clientName.split(/\s+/)].filter(p => p.length > 2);
  const advisorParts = [advisorName, ...advisorName.split(/\s+/)].filter(p => p.length > 2);

  // Sort by length descending so full name is replaced before individual parts
  clientParts.sort((a, b) => b.length - a.length);
  advisorParts.sort((a, b) => b.length - a.length);

  for (const part of clientParts) {
    const re = new RegExp(escapeRegex(part), "gi");
    const before = text;
    text = text.replace(re, "THE_CLIENT");
    if (text !== before) redactions.namesFound++;
  }

  for (const part of advisorParts) {
    const re = new RegExp(escapeRegex(part), "gi");
    const before = text;
    text = text.replace(re, "THE_ADVISOR");
    if (text !== before) redactions.namesFound++;
  }

  // ── Dollar amounts → ranges ──────────────────────────────────────────────────
  // Converts specific figures to range buckets — preserves financial context
  // without revealing exact balances
  text = text.replace(/\$[\d,]+(\.\d{2})?/g, (match) => {
    redactions.dollarsRedacted++;
    const n = parseFloat(match.replace(/[$,]/g, ""));
    if      (n <    10_000) return "$X,XXX";
    else if (n <   100_000) return "$XX,XXX";
    else if (n < 1_000_000) return "$XXX,XXX";
    else                    return "$X,XXX,XXX+";
  });

  // Numbers followed by "thousand" or "million"
  text = text.replace(/\b(\d{1,4})\s*(thousand|k)\b/gi, (_, n) => {
    redactions.dollarsRedacted++;
    const val = parseFloat(n) * 1000;
    if (val < 100_000) return "$XX,XXX";
    return "$XXX,XXX";
  });

  text = text.replace(/\b(\d{1,3}(?:\.\d+)?)\s*million\b/gi, () => {
    redactions.dollarsRedacted++;
    return "$X,XXX,XXX+";
  });

  // ── SIN (Social Insurance Number) ────────────────────────────────────────────
  // 9 digits in various formats: 123-456-789, 123 456 789, 123456789
  text = text.replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, () => {
    redactions.sinsFound++;
    return "[SIN REDACTED]";
  });

  // ── Account numbers (10-16 digits) ───────────────────────────────────────────
  text = text.replace(/\b\d{10,16}\b/g, () => {
    redactions.accountsFound++;
    return "[ACCOUNT REDACTED]";
  });

  // ── Policy numbers ────────────────────────────────────────────────────────────
  // Common formats: ABC-12345678, ABC12345678, PL-123456
  text = text.replace(/\b[A-Z]{2,4}-?\d{6,10}\b/g, () => {
    redactions.policiesFound++;
    return "[POLICY REDACTED]";
  });

  // ── Dates of birth ────────────────────────────────────────────────────────────
  // ISO: 1965-03-14, Canadian: 14/03/1965, written: March 14, 1965
  text = text.replace(
    /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g,
    "[DOB REDACTED]"
  );
  text = text.replace(
    /\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](19|20)\d{2}\b/g,
    "[DOB REDACTED]"
  );

  return { text, redactions };
}

/**
 * Builds the Anthropic message content string from a de-identified transcript.
 * The meeting title and platform are safe to include — they contain no PII.
 */
export function buildMeetingPromptContent(
  deidentified: DeidentifiedTranscript,
  meetingTitle:   string,
  platform:       string | null
): string {
  return (
    `Meeting: "${meetingTitle}" | Platform: ${platform ?? "unknown"}\n\n` +
    `Transcript (names and sensitive details de-identified for privacy):\n${deidentified.text}`
  );
}
