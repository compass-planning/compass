/**
 * server/routes/ai-voice.ts
 *
 * Mounted at /api/ai in server/routes.ts:
 *   app.use("/api/ai", isAuthenticated, aiVoiceRouter);
 *
 * Endpoints:
 *   POST /api/ai/meeting-summary   — summarise meeting transcript
 *   POST /api/ai/voice-field       — parse a single spoken field value
 *   POST /api/ai/voice-fill        — parse speech into multiple structured fields
 */

import { Router, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../auth";
import { speechToText } from "../audio/utils";

const r = Router();
r.use(isAuthenticated);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/ai/meeting-summary ──────────────────────────────────────────────

r.post("/meeting-summary", async (req: any, res: Response) => {
  const { transcript: rawTranscript, audio, clientName } = req.body as {
    transcript?: string; audio?: string; clientId?: number; clientName?: string;
  };

  let transcript = (rawTranscript || "").trim();

  // The browser's Web Speech transcript is often empty or unreliable. If we have
  // recorded audio and little/no transcript, transcribe the audio via Whisper.
  if (audio && transcript.length < 20) {
    try {
      const buf = Buffer.from(audio, "base64");
      const whisperText = (await speechToText(buf, "webm")).trim();
      if (whisperText) transcript = whisperText;
    } catch (e) {
      console.warn("Whisper transcription unavailable, using browser transcript:", (e as Error).message);
    }
  }

  if (!transcript) {
    return res.status(400).json({ message: "Could not capture the meeting. Check the microphone and try again." });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `You are a financial planning assistant for a Canadian advisory CRM. Extract key planning information from an advisor-client meeting transcript.

Return ONLY valid JSON — no markdown, no prose:
{
  "summary": {
    "keyFigures": [{ "label": "Annual Income", "value": "$120,000" }],
    "goals": ["Retire at 62 with $80,000/year income"],
    "actionItems": ["Review RRSP contribution room"],
    "recommendedAreas": ["Retirement Planning", "Tax Planning"],
    "rawSummary": "One-paragraph plain-English summary."
  },
  "records": {
    "assets": [{ "category": "RRSP", "name": "RBC RRSP", "value": "145000", "owner": "primary" }],
    "liabilities": [{ "category": "Mortgage", "name": "Home Mortgage", "value": "320000", "owner": "primary" }],
    "goals": [{ "title": "Retirement at 62", "goalType": "retirement", "targetAmount": "1500000", "targetDate": "2034", "notes": "" }],
    "education": [{ "childName": "Emma", "childDob": "2015-03-01", "currentRespBalance": "12000", "annualContribution": "2500", "targetAmount": "80000", "notes": "" }]
  }
}

Guidelines:
- summary.keyFigures: dollar amounts, ages, rates, balances explicitly mentioned
- summary.goals: client's stated financial, retirement, or life goals
- summary.actionItems: concrete next steps agreed to by advisor or client
- summary.recommendedAreas: choose from — Retirement Planning, Tax Planning, Estate Planning, Insurance, Education Planning, Net Worth, Debt Management, Cash Flow, Investment Planning, Pension Analysis
- summary.rawSummary: 2–4 sentence plain-English overview
- records.assets: only include if specific account names/balances mentioned; value as bare number string
- records.liabilities: only include if specific debts mentioned; value as bare number string
- records.goals: only include explicitly stated goals; targetAmount as bare number string
- records.education: only include if children/RESP mentioned
- Return empty arrays for any section with no relevant data`,
      messages: [{ role: "user", content: `Meeting transcript${clientName ? ` (client: ${clientName})` : ""}:\n\n${transcript}` }],
    });

    const raw = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    // Return transcript back so the hook can display it
    res.json({ transcript, ...parsed });
  } catch (err) {
    console.error("meeting-summary error:", err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
});

// ── POST /api/ai/voice-field ──────────────────────────────────────────────────
// Parses a single spoken value for one form field.

r.post("/voice-field", async (req: any, res: Response) => {
  const { speech, fieldKey, fieldLabel, fieldType, sectionContext } = req.body as {
    speech: string; fieldKey: string; fieldLabel: string;
    fieldType: string; sectionContext: string;
  };
  if (!speech?.trim()) return res.status(400).json({ message: "speech is required" });

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `You are a data-entry assistant for a Canadian financial planning app.
Extract just the field value from natural speech. Return ONLY valid JSON: { "value": "<extracted value>" }
- number fields: bare number string ("80000" not "$80,000")
- date fields: ISO format "YYYY-MM-DD"
- text fields: clean normalised text
Never return prose — only the JSON object.`,
      messages: [{
        role: "user",
        content: `Field: "${fieldLabel}" (key: ${fieldKey}, type: ${fieldType})\nSection: ${sectionContext || "Financial Planning"}\nSpoken input: "${speech}"`,
      }],
    });

    const raw = (message.content[0] as any).text ?? "";
    const { value } = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.json({ value: String(value ?? speech) });
  } catch (err) {
    console.error("voice-field error:", err);
    res.json({ value: req.body.speech }); // graceful fallback
  }
});

// ── POST /api/ai/voice-fill ───────────────────────────────────────────────────
// Parses a free-form spoken description into multiple structured form fields.
// Used by VoiceAddDialog to create full records from a single spoken sentence.

r.post("/voice-fill", async (req: any, res: Response) => {
  const { text, moduleId, fieldSchema } = req.body as {
    text: string;
    moduleId: string;
    fieldSchema: Array<{
      key: string;
      label?: string;
      description?: string;
      enum?: string[];
    }>;
  };

  if (!text?.trim()) return res.status(400).json({ message: "text is required" });
  if (!fieldSchema?.length) return res.status(400).json({ message: "fieldSchema is required" });

  const schemaDesc = fieldSchema
    .map(f => {
      let desc = `  "${f.key}"`;
      if (f.label) desc += ` (${f.label})`;
      if (f.description) desc += `: ${f.description}`;
      if (f.enum?.length) desc += `. Must be one of: ${f.enum.join(", ")}`;
      return desc;
    })
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are a data-entry assistant for a Canadian financial planning CRM.
The user will speak a description of a financial record. Extract the relevant field values.

Module: ${moduleId}

Fields to extract:
${schemaDesc}

Rules:
- Return ONLY valid JSON: { "fields": { "fieldKey": "value", ... } }
- For number fields: bare number string, no currency symbols ("80000" not "$80,000")
- For date fields: ISO "YYYY-MM-DD" format
- For enum fields: return the closest matching enum value exactly
- Omit fields you cannot confidently extract from the speech
- Never return prose outside the JSON`,
      messages: [{
        role: "user",
        content: `User said: "${text}"`,
      }],
    });

    const raw = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const { fields } = JSON.parse(clean);
    res.json({ fields: fields ?? {} });
  } catch (err) {
    console.error("voice-fill error:", err);
    res.status(500).json({ message: "Failed to parse voice input", fields: {} });
  }
});

export default r;
