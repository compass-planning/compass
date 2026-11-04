import Anthropic from "@anthropic-ai/sdk";
import { deidentifyTranscript, buildMeetingPromptContent } from "./meetingDeidentification";
import { storage } from "../storage";
import type { Meeting } from "@shared/schema";
import { logger } from "../logger";

interface MeetingIntelligenceOutput {
  summary: {
    discussed: string;
    decisions: string[];
    client_goals_concerns: string[];
    advisor_recommendations: string[];
  };
  action_items: Array<{
    owner: "advisor" | "client";
    description: string;
    due_date: string | null;
    priority: "high" | "medium" | "low";
    context: string;
  }>;
  follow_up_email: {
    subject: string;
    body: string;
  };
  compliance_notes: {
    kyc_updates: Array<{
      field: string;
      old_value: string | null;
      new_value: string;
      verbatim_quote: string;
    }>;
    suitability_statements: string[];
    advice_given: string[];
    client_instructions: string[];
    concerns_raised: string[];
  };
  plan_triggers: Array<{
    module: string;
    trigger_type: string;
    description: string;
    suggested_action: string;
    verbatim_quote: string;
    priority: "critical" | "high" | "medium";
  }>;
  coaching: {
    private_notes: string;
    scores: {
      needs_discovery: number;
      client_led_conversation: number;
      planning_gaps_surfaced: number;
      follow_through_on_prior_actions: number;
    };
    strengths: string[];
    opportunities: string[];
  };
}

const MEETING_INTELLIGENCE_SYSTEM_PROMPT = `You are an AI assistant for a Canadian financial advisory CRM called FinAdvisor.
You analyse meeting transcripts between financial advisors and clients.
You must output valid JSON matching the schema provided exactly.
All outputs must be professional, concise, and compliant with Canadian financial services regulations (MFDA, IIROC, PIPEDA).
Never fabricate information not present in the transcript.
If information for a field is not present, use null or an empty array as appropriate.

PLAN TRIGGER DETECTION — watch for these patterns:

RESP / Education triggers:
  "expecting a baby", "we're pregnant", "just adopted", "our son starts university", "she got accepted to"

Retirement triggers:
  "thinking of retiring at", "my husband retired last month", "considering early retirement", "my pension starts"

Insurance triggers:
  "we paid off the mortgage", "my wife quit her job", "I got a promotion", "started my own business", "my father just passed away", "diagnosed with"

Estate triggers:
  "mother passed away", "inheritance", "updating my will", "my parents moved in with us"

Tax triggers:
  "sold the cottage", "sold the business", "capital gains", "moved to Alberta" (provincial rate change)

Debt triggers:
  "consolidated our debt", "new mortgage", "line of credit", "student loans"

Portfolio triggers:
  "want to rebalance", "concerned about risk", "moving to conservative", "want more growth"

COACHING SCORES: Score each category 1-10. Score conservatively and provide specific evidence from the transcript for each score in the coaching notes.

Generate a JSON object with exactly these keys:
{
  "summary": {
    "discussed": "2-4 sentence narrative of what was covered",
    "decisions": ["key decision strings"],
    "client_goals_concerns": ["client goal/concern strings"],
    "advisor_recommendations": ["recommendation strings"]
  },
  "action_items": [
    {
      "owner": "advisor | client",
      "description": "string",
      "due_date": "YYYY-MM-DD | null",
      "priority": "high | medium | low",
      "context": "brief quote or context from transcript"
    }
  ],
  "follow_up_email": {
    "subject": "string",
    "body": "full email body, professional tone, no placeholders"
  },
  "compliance_notes": {
    "kyc_updates": [
      {
        "field": "employment | income | family_status | risk_tolerance | net_worth | other",
        "old_value": "string | null",
        "new_value": "string",
        "verbatim_quote": "exact quote from transcript"
      }
    ],
    "suitability_statements": ["client statements relevant to suitability"],
    "advice_given": ["specific recommendations made by advisor"],
    "client_instructions": ["explicit instructions given by client"],
    "concerns_raised": ["concerns or complaints mentioned"]
  },
  "plan_triggers": [
    {
      "module": "retirement | insurance | resp | estate | tax | debt | portfolio",
      "trigger_type": "string",
      "description": "what changed or was mentioned",
      "suggested_action": "what the advisor should update in the plan",
      "verbatim_quote": "exact quote from transcript",
      "priority": "critical | high | medium"
    }
  ],
  "coaching": {
    "private_notes": "2-3 specific observations for advisor only",
    "scores": {
      "needs_discovery": 0,
      "client_led_conversation": 0,
      "planning_gaps_surfaced": 0,
      "follow_through_on_prior_actions": 0
    },
    "strengths": ["strength strings"],
    "opportunities": ["specific improvement suggestions"]
  }
}`;

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function buildDefaultOutput(): MeetingIntelligenceOutput {
  return {
    summary: { discussed: "", decisions: [], client_goals_concerns: [], advisor_recommendations: [] },
    action_items: [],
    follow_up_email: { subject: "", body: "" },
    compliance_notes: { kyc_updates: [], suitability_statements: [], advice_given: [], client_instructions: [], concerns_raised: [] },
    plan_triggers: [],
    coaching: {
      private_notes: "",
      scores: { needs_discovery: 0, client_led_conversation: 0, planning_gaps_surfaced: 0, follow_through_on_prior_actions: 0 },
      strengths: [],
      opportunities: [],
    },
  };
}

function validateAndNormalize(raw: Record<string, unknown>): MeetingIntelligenceOutput {
  const defaults = buildDefaultOutput();

  const summary = (raw.summary && typeof raw.summary === "object") ? raw.summary as Record<string, unknown> : {};
  defaults.summary = {
    discussed: typeof summary.discussed === "string" ? summary.discussed : "",
    decisions: Array.isArray(summary.decisions) ? summary.decisions.map(String) : [],
    client_goals_concerns: Array.isArray(summary.client_goals_concerns) ? summary.client_goals_concerns.map(String) : [],
    advisor_recommendations: Array.isArray(summary.advisor_recommendations) ? summary.advisor_recommendations.map(String) : [],
  };

  if (Array.isArray(raw.action_items)) {
    defaults.action_items = raw.action_items.map((item: Record<string, unknown>) => ({
      owner: (item.owner === "client" ? "client" : "advisor") as "advisor" | "client",
      description: typeof item.description === "string" ? item.description : "",
      due_date: typeof item.due_date === "string" ? item.due_date : null,
      priority: (["high", "medium", "low"].includes(item.priority as string) ? item.priority : "medium") as "high" | "medium" | "low",
      context: typeof item.context === "string" ? item.context : "",
    }));
  }

  if (raw.follow_up_email && typeof raw.follow_up_email === "object") {
    const email = raw.follow_up_email as Record<string, unknown>;
    defaults.follow_up_email = {
      subject: typeof email.subject === "string" ? email.subject : "",
      body: typeof email.body === "string" ? email.body : "",
    };
  }

  if (raw.compliance_notes && typeof raw.compliance_notes === "object") {
    const cn = raw.compliance_notes as Record<string, unknown>;
    defaults.compliance_notes = {
      kyc_updates: Array.isArray(cn.kyc_updates) ? cn.kyc_updates.map((k: Record<string, unknown>) => ({
        field: typeof k.field === "string" ? k.field : "other",
        old_value: typeof k.old_value === "string" ? k.old_value : null,
        new_value: typeof k.new_value === "string" ? k.new_value : "",
        verbatim_quote: typeof k.verbatim_quote === "string" ? k.verbatim_quote : "",
      })) : [],
      suitability_statements: Array.isArray(cn.suitability_statements) ? cn.suitability_statements.map(String) : [],
      advice_given: Array.isArray(cn.advice_given) ? cn.advice_given.map(String) : [],
      client_instructions: Array.isArray(cn.client_instructions) ? cn.client_instructions.map(String) : [],
      concerns_raised: Array.isArray(cn.concerns_raised) ? cn.concerns_raised.map(String) : [],
    };
  }

  if (Array.isArray(raw.plan_triggers)) {
    defaults.plan_triggers = raw.plan_triggers.map((t: Record<string, unknown>) => ({
      module: typeof t.module === "string" ? t.module : "retirement",
      trigger_type: typeof t.trigger_type === "string" ? t.trigger_type : "",
      description: typeof t.description === "string" ? t.description : "",
      suggested_action: typeof t.suggested_action === "string" ? t.suggested_action : "",
      verbatim_quote: typeof t.verbatim_quote === "string" ? t.verbatim_quote : "",
      priority: (["critical", "high", "medium"].includes(t.priority as string) ? t.priority : "medium") as "critical" | "high" | "medium",
    }));
  }

  if (raw.coaching && typeof raw.coaching === "object") {
    const c = raw.coaching as Record<string, unknown>;
    const scores = (c.scores && typeof c.scores === "object") ? c.scores as Record<string, unknown> : {};
    defaults.coaching = {
      private_notes: typeof c.private_notes === "string" ? c.private_notes : "",
      scores: {
        needs_discovery: typeof scores.needs_discovery === "number" ? scores.needs_discovery : 0,
        client_led_conversation: typeof scores.client_led_conversation === "number" ? scores.client_led_conversation : 0,
        planning_gaps_surfaced: typeof scores.planning_gaps_surfaced === "number" ? scores.planning_gaps_surfaced : 0,
        follow_through_on_prior_actions: typeof scores.follow_through_on_prior_actions === "number" ? scores.follow_through_on_prior_actions : 0,
      },
      strengths: Array.isArray(c.strengths) ? c.strengths.map(String) : [],
      opportunities: Array.isArray(c.opportunities) ? c.opportunities.map(String) : [],
    };
  }

  return defaults;
}

export async function processTranscriptWithAI(
  transcript: string,
  meeting: Meeting,
  advisorEmailStyle?: string
): Promise<MeetingIntelligenceOutput> {
  let systemPrompt = MEETING_INTELLIGENCE_SYSTEM_PROMPT;
  if (advisorEmailStyle) {
    systemPrompt += `\n\nThe follow-up email should match this style: ${advisorEmailStyle}`;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: (() => {
        // ── PIPEDA: de-identify before sending to Anthropic ──────────────────
        // Client name, advisor name, exact dollar amounts, SINs, and account
        // numbers are replaced with placeholders. The raw transcript stays
        // in PostgreSQL on the Fly.io server — Anthropic never sees PII.
        const clientName  = (meeting as any).clientName  ?? "";
        const advisorName = (meeting as any).advisorName ?? "";
        const deidentified = deidentifyTranscript(transcript, clientName, advisorName);
        logger.info({ redactions: deidentified.redactions }, "[meeting-intelligence] Transcript de-identified");
        return buildMeetingPromptContent(deidentified, meeting.title ?? "Meeting", meeting.platform ?? null);
      })(),
      },
    ],
  });

  const rawContent = (message.content[0] as any).text || "{}";
  const cleaned = stripMarkdownFences(rawContent);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    logger.error("Meeting intelligence: JSON parse failed, attempting repair", parseErr);
    try {
      const repairMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: "Fix the following broken JSON so it is valid. Return ONLY the corrected JSON, nothing else.",
        messages: [{ role: "user", content: cleaned }],
      });
      const repaired = stripMarkdownFences((repairMsg.content[0] as any).text || "{}");
      parsed = JSON.parse(repaired);
    } catch (repairErr) {
      logger.error("Meeting intelligence: JSON repair also failed", repairErr);
      parsed = {};
    }
  }

  return validateAndNormalize(parsed);
}

function flattenSummary(summary: MeetingIntelligenceOutput["summary"]): string {
  const parts: string[] = [];
  if (summary.discussed) parts.push(summary.discussed);
  if (summary.decisions.length > 0) parts.push("Decisions: " + summary.decisions.join("; "));
  if (summary.client_goals_concerns.length > 0) parts.push("Client Goals: " + summary.client_goals_concerns.join("; "));
  if (summary.advisor_recommendations.length > 0) parts.push("Recommendations: " + summary.advisor_recommendations.join("; "));
  return parts.join("\n\n");
}

export async function processMeetingIntelligence(meetingId: number): Promise<void> {
  const meeting = await storage.getMeeting(meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  const transcriptRecord = await storage.getMeetingTranscript(meetingId);
  if (!transcriptRecord) {
    throw new Error(`No transcript found for meeting ${meetingId}`);
  }

  const aiOutput = await processTranscriptWithAI(transcriptRecord.fullText, meeting);

  const summaryText = flattenSummary(aiOutput.summary);

  await storage.updateMeeting(meetingId, {
    summary: summaryText,
    transcript: transcriptRecord.fullText,
    recordingStatus: "done",
  });

  await storage.createMeetingOutputs({
    meetingId,
    summary: summaryText,
    keyDecisions: aiOutput.summary.decisions.map((d) => ({ decision: d, context: "" })),
    clientGoals: aiOutput.summary.client_goals_concerns.map((g) => ({ goal: g, urgency: "medium" })),
    followUpEmailDraft: aiOutput.follow_up_email.body
      ? `Subject: ${aiOutput.follow_up_email.subject}\n\n${aiOutput.follow_up_email.body}`
      : aiOutput.follow_up_email.body || "",
    complianceNotes: aiOutput.compliance_notes,
    planTriggers: aiOutput.plan_triggers,
    coachingNotes: aiOutput.coaching.private_notes,
    coachingScore: aiOutput.coaching.scores,
    complianceReviewed: false,
    emailSent: false,
  });

  for (const item of aiOutput.action_items) {
    await storage.createMeetingTask({
      meetingId,
      clientId: meeting.clientId,
      owner: item.owner === "client" ? "client" : "advisor",
      description: item.description,
      dueDate: item.due_date || undefined,
      priority: item.priority || "medium",
      status: "open",
    });
  }

  const simulatableModules = ["retirement", "insurance", "education", "debt", "resp", "estate", "tax", "portfolio"];
  const validTriggers = aiOutput.plan_triggers.filter((t) => simulatableModules.includes(t.module));

  if (validTriggers.length > 0) {
    const plans = await storage.getPlansByClient(meeting.clientId);
    const activePlan = plans.length > 0 ? plans[plans.length - 1] : null;
    if (activePlan) {
      for (const trigger of validTriggers) {
        try {
          await storage.createPlanStaleFlag({
            planId: activePlan.id,
            module: trigger.module,
            triggeredBy: `Meeting "${meeting.title}": ${trigger.description}`,
          });
        } catch (flagErr) {
          logger.info(`Skipping plan trigger for module: ${trigger.module}`, flagErr);
        }
      }
    }
  }
}
