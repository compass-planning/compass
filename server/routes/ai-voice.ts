/**
 * server/routes/ai-voice.ts
 *
 * Mount in server/index.ts:
 *   import aiVoiceRouter from "./routes/ai-voice.js";
 *   app.use("/api/ai", aiVoiceRouter);
 *
 * Endpoints:
 *   POST /api/ai/transcribe       — Whisper audio → transcript
 *   POST /api/ai/meeting-summary  — transcript → Claude structured summary
 *   POST /api/ai/voice-field      — speech → extracted field value
 */

import type { Response } from "express";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import multer from "multer";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { auditAnthropicCall, auditOpenAiCall, AuditAction, DataCategory } from "../services/pipedaAuditService.js";

const r = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
r.use((req: any, res: any, next: any) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return isAuthenticated(req, res, next);
});

// ── SDK clients ───────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Multer — memory storage, 25 MB cap (Whisper API limit) ───────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/transcribe
// Multipart body: audio (file)
// Returns: { transcript: string }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/transcribe", upload.single("audio"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "audio file is required" });
  }

  try {
    // Wrap the buffer as a File so the OpenAI SDK can stream it correctly
    const mimeType = req.file.mimetype || "audio/webm";
    const ext      = mimeType.includes("webm") ? "webm"
                   : mimeType.includes("mp4")  ? "mp4"
                   : mimeType.includes("wav")  ? "wav"
                   : mimeType.includes("ogg")  ? "ogg"
                   : "webm";

    const audioFile = await toFile(req.file.buffer, `recording.${ext}`, { type: mimeType });

    const result = await openai.audio.transcriptions.create({
      model:    "whisper-1",
      file:     audioFile,
      language: "en",
    });

    await auditOpenAiCall({
      req, action: AuditAction.AI_TRANSCRIPTION,
      clientId:       undefined,
      dataCategories: [DataCategory.MEETING_AUDIO],
      purposeCode:    "transcription",
    });

    res.json({ transcript: result.text });
  } catch (err) {
    await auditOpenAiCall({ req, action: AuditAction.AI_TRANSCRIPTION, dataCategories: [DataCategory.MEETING_AUDIO], purposeCode: "transcription", outcome: "error", errorMessage: String(err) }).catch(() => {});
    console.error("transcribe error:", err);
    res.status(500).json({ message: "Transcription failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/meeting-summary
// Body: { transcript: string, clientId: number }
// Returns structured planning summary (JSON)
// ─────────────────────────────────────────────────────────────────────────────
r.post("/meeting-summary", async (req: AuthRequest, res: Response) => {
  const { transcript, clientId } = req.body as { transcript: string; clientId?: number };

  if (!transcript?.trim()) {
    return res.status(400).json({ message: "transcript is required" });
  }

  try {
    await auditAnthropicCall({
      req, action: AuditAction.AI_MEETING_SUMMARY,
      clientId:       clientId ? +clientId : undefined,
      dataCategories: [DataCategory.TRANSCRIPT, DataCategory.PERSONAL_INFO],
      purposeCode:    "meeting_summary",
    });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a financial planning assistant. Extract and structure key planning information from a meeting transcript between a Canadian financial advisor and their client.

Return ONLY valid JSON — no markdown, no prose — in this exact shape:
{
  "keyFigures": [{ "label": "Annual Income", "value": "$120,000" }],
  "goals": ["Retire at 62 with $80,000/year income"],
  "actionItems": ["Review RRSP contribution room"],
  "recommendedAreas": ["Retirement Planning", "Tax Planning"],
  "rawSummary": "One-paragraph plain-English summary."
}

Guidelines:
- keyFigures: dollar amounts, ages, rates, balances mentioned
- goals: client's stated financial, retirement, or life goals
- actionItems: concrete next steps agreed to by advisor or client
- recommendedAreas: choose only from — Retirement Planning, Tax Planning, Estate Planning, Insurance, Education Planning, Net Worth, Debt Management, Cash Flow, Investment Planning, Pension Analysis
- rawSummary: 2–4 sentences
- Return empty arrays if nothing relevant was mentioned`,
      messages: [{ role: "user", content: `Meeting transcript:\n\n${transcript}` }],
    });

    const raw     = (message.content[0] as any).text ?? "";
    const clean   = raw.replace(/```json|```/g, "").trim();
    const summary = JSON.parse(clean);

    res.json(summary);
  } catch (err) {
    console.error("meeting-summary error:", err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/voice-field
// Body: { speech, fieldKey, fieldLabel, fieldType, sectionContext }
// Returns: { value: string }
// ─────────────────────────────────────────────────────────────────────────────
r.post("/voice-field", async (req: AuthRequest, res: Response) => {
  const { speech, fieldKey, fieldLabel, fieldType, sectionContext } =
    req.body as {
      speech: string;
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      sectionContext: string;
    };

  if (!speech?.trim()) {
    return res.status(400).json({ message: "speech is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `You are a data-entry assistant for a Canadian financial planning app.
Extract just the field value from natural speech. Return ONLY valid JSON: { "value": "<extracted value>" }
- number fields: bare number string ("80000" not "$80,000")
- date fields: ISO format "YYYY-MM-DD"
- text fields: clean normalised text
Never return prose — only the JSON object.`,
      messages: [{
        role:    "user",
        content: `Field: "${fieldLabel}" (key: ${fieldKey}, type: ${fieldType})\nSection: ${sectionContext || "Financial Planning"}\nSpoken input: "${speech}"`,
      }],
    });

    const raw   = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const { value } = JSON.parse(clean);

    res.json({ value: String(value ?? speech) });
  } catch (err) {
    console.error("voice-field error:", err);
    // Graceful fallback — raw speech beats a blank field
    res.json({ value: speech });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/intake-transcript
// Body: { transcript: string }
// Returns structured client profile extracted from an intake conversation
// ─────────────────────────────────────────────────────────────────────────────
r.post("/intake-transcript", async (req: AuthRequest, res: Response) => {
  const { transcript } = req.body as { transcript: string };
  if (!transcript?.trim()) return res.status(400).json({ message: "transcript is required" });

  try {
    await auditAnthropicCall({
      req, action: AuditAction.AI_INTAKE_EXTRACT,
      dataCategories: [DataCategory.TRANSCRIPT, DataCategory.PERSONAL_INFO, DataCategory.INCOME],
      purposeCode:    "intake_extract",
    });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a financial advisor assistant. Extract client profile information from an intake conversation.

Return ONLY valid JSON — no markdown, no prose:
{
  "firstName": "", "lastName": "", "email": "", "phone": "",
  "dateOfBirth": "", "province": "", "occupation": "", "employmentStatus": "",
  "annualIncome": "", "retirementAge": null, "desiredRetirementIncome": "",
  "pensionType": "", "spouseFirstName": "", "spouseLastName": "",
  "spouseDateOfBirth": "", "spouseOccupation": "", "spouseAnnualIncome": "", "notes": ""
}
Rules:
- Empty string for any field not mentioned
- dateOfBirth: ISO "YYYY-MM-DD" or ""
- province: two-letter code (ON, BC, AB, QC) or US state abbreviation
- annualIncome / spouseAnnualIncome / desiredRetirementIncome: numeric string only e.g. "95000"
- retirementAge: integer or null
- employmentStatus: "employed"|"self-employed"|"retired"|"unemployed"|""
- pensionType: "defined-benefit"|"defined-contribution"|"none"|""
- notes: anything relevant that doesn't fit other fields`,
      messages: [{ role: "user", content: `Intake transcript:\n\n${transcript}` }],
    });

    const raw   = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    console.error("intake-transcript error:", err);
    res.status(500).json({ message: "Failed to extract client profile" });
  }
});

export default r;


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/needs-analysis-transcript
// Body: { transcript: string }
// Returns structured insurance needs analysis fields
// ─────────────────────────────────────────────────────────────────────────────
r.post("/needs-analysis-transcript", async (req: AuthRequest, res: Response) => {
  const { transcript } = req.body as { transcript: string };
  if (!transcript?.trim()) return res.status(400).json({ message: "transcript is required" });

  try {
    await auditAnthropicCall({
      req, action: AuditAction.AI_NEEDS_ANALYSIS,
      dataCategories: [DataCategory.TRANSCRIPT, DataCategory.INCOME, DataCategory.INSURANCE, DataCategory.PERSONAL_INFO],
      purposeCode:    "needs_analysis",
    });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a Canadian financial advisor assistant. Extract insurance needs analysis data from a conversation.

Return ONLY valid JSON — no markdown, no prose:
{
  "primaryName": "", "primaryAge": "", "primaryAnnualIncome": "",
  "spouseName": "", "spouseAge": "", "spouseAnnualIncome": "", "familyMembers": "",
  "mortgageBalance": "", "carLoans": "", "linesOfCredit": "",
  "creditCards": "", "finalExpenses": "", "emergencyFund": "",
  "educationFund": "", "legacyFundForChildren": "", "charitableBequest": "",
  "primaryReplacementPct": "", "primaryCppSurvivorBenefit": "", "primaryTargetAge": "",
  "spouseReplacementPct": "", "spouseCppSurvivorBenefit": "", "spouseTargetAge": "",
  "primaryLiquidSavings": "", "primaryRrsps": "",
  "spouseLiquidSavings": "", "spouseRrsps": ""
}
Rules:
- All monetary values: numeric string only e.g. "450000" — no $ or commas
- Age and familyMembers: numeric string e.g. "42"
- Replacement pct: numeric string e.g. "70" (percent, no % sign)
- CPP survivor benefit: monthly dollar amount as numeric string e.g. "700"
- Empty string "" for any field not mentioned — never omit a key
- Infer reasonable defaults only if explicitly calculable from other stated values`,
      messages: [{ role: "user", content: `Needs analysis conversation:\n\n${transcript}` }],
    });

    const raw   = (message.content[0] as any).text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    console.error("needs-analysis-transcript error:", err);
    res.status(500).json({ message: "Failed to extract needs analysis data" });
  }
});
