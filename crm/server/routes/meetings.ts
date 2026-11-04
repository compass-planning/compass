import { Router } from "express";
import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { meetings } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { speechToText } from "../audio/utils";
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
import { verifyClientOwnership, verifyFpRecordOwnership } from "./middleware";
import { logger } from "../logger";

export const meetingsRouter = Router();

const audioBodyParser = express.json({ limit: "50mb" });

// ── CRUD ──────────────────────────────────────────────────────────────────────

meetingsRouter.get("/api/clients/:clientId/meetings", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  res.json(await storage.getMeetingsByClient(clientId));
});

meetingsRouter.post("/api/clients/:clientId/meetings", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const input = api.meetings.create.input
      .extend({ date: z.coerce.date() })
      .parse(req.body);
    res.status(201).json(await storage.createMeeting({ ...input, clientId }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

// ── Audio upload (legacy path) ────────────────────────────────────────────────

meetingsRouter.post("/api/meetings/:id/audio", isAuthenticated, audioBodyParser, async (req: any, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({ message: "Audio transcription requires OPENAI_API_KEY. Use the in-app recorder instead." });
  }
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const { audio } = req.body;
    if (!audio) return res.status(400).json({ message: "Audio data required" });
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const rawBuffer = Buffer.from(audio, "base64");
    const transcript = await speechToText(rawBuffer);
    let summary = "";
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: "Summarize this client meeting transcript for a financial advisor's notes. Extract key action items and decisions. Be concise.",
        messages: [{ role: "user", content: transcript }],
      });
      summary = (msg.content[0] as any).text || "";
    } catch (aiErr) {
      logger.error("AI summarization failed:", aiErr);
    }
    res.json(await storage.updateMeeting(id, { transcript, summary }));
  } catch (err) {
    logger.error("Audio processing error:", err);
    res.status(500).json({ message: "Failed to process audio" });
  }
});

// ── Recall.ai bot ─────────────────────────────────────────────────────────────

meetingsRouter.post("/api/meetings/:id/send-notetaker", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const staffRecord = await storage.getStaffMember(req.session.staffId);
    if (!staffRecord) return res.status(403).json({ message: "Staff not found" });
    const company = await storage.getCompany(staffRecord.companyId);
    if (!company?.moduleMeetingRecorder) {
      return res.status(403).json({ message: "Meeting Recorder module is not enabled" });
    }
    const meetingUrl = req.body.meetingUrl || meeting.meetingJoinUrl;
    if (!meetingUrl) {
      return res.status(400).json({
        message: "No meeting URL available. Provide a meetingUrl in the request body or ensure the meeting has a join URL.",
      });
    }
    if (meeting.recallBotId && meeting.recordingStatus !== "error") {
      return res.status(409).json({ message: "A notetaker is already active for this meeting" });
    }
    // PIPEDA gate: Recall.ai processes meetings on US servers (us-east-1).
    // Disabled by default until explicit client consent framework is in place.
    if (process.env.RECALL_ENABLED !== "true") {
      return res.status(503).json({
        message: "Recall.ai bot recording is disabled pending PIPEDA consent framework. Use in-app recording instead.",
        code: "RECALL_DISABLED",
      });
    }
    if (!process.env.RECALL_API_KEY) {
      return res.status(503).json({
        message: "Meeting recording service is not configured. Please contact your administrator.",
      });
    }
    const { createRecallBot, mapRecallStatusToRecordingStatus } = await import("../services/recall");
    const bot = await createRecallBot({
      meetingUrl,
      botName: req.body.botName || "FinAdvisor Notetaker",
    });
    const platform = meetingUrl.includes("teams.microsoft.com")
      ? "teams"
      : meetingUrl.includes("zoom.us")
        ? "zoom"
        : meetingUrl.includes("meet.google.com")
          ? "google_meet"
          : "other";
    res.json(
      await storage.updateMeeting(id, {
        recallBotId: bot.id,
        recordingStatus: mapRecallStatusToRecordingStatus(bot.status.code),
        meetingJoinUrl: meetingUrl,
        platform,
      })
    );
  } catch (err: unknown) {
    logger.error("Send notetaker error:", err);
    res.status(500).json({ message: err instanceof Error ? err.message : "Failed to send notetaker" });
  }
});

meetingsRouter.get("/api/meetings/:id/recording-status", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (
      meeting.recallBotId &&
      meeting.recordingStatus !== "done" &&
      meeting.recordingStatus !== "error"
    ) {
      try {
        const { getRecallBotStatus, mapRecallStatusToRecordingStatus } = await import("../services/recall");
        const bot = await getRecallBotStatus(meeting.recallBotId);
        const newStatus = mapRecallStatusToRecordingStatus(bot.status.code);
        if (newStatus !== meeting.recordingStatus) {
          await storage.updateMeeting(id, { recordingStatus: newStatus, recordingUrl: bot.video_url || undefined });
        }
        return res.json({ recordingStatus: newStatus, recordingUrl: bot.video_url || null });
      } catch {
        return res.json({ recordingStatus: meeting.recordingStatus, recordingUrl: meeting.recordingUrl });
      }
    }
    res.json({ recordingStatus: meeting.recordingStatus || "none", recordingUrl: meeting.recordingUrl });
  } catch (err) {
    logger.error("Recording status error:", err);
    res.status(500).json({ message: "Failed to fetch recording status" });
  }
});

// ── AI outputs ────────────────────────────────────────────────────────────────

meetingsRouter.get("/api/meetings/:id/outputs", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const outputs = await storage.getMeetingOutputs(id);
    if (!outputs) return res.status(404).json({ message: "No AI outputs found for this meeting" });
    res.json(outputs);
  } catch (err) {
    logger.error("Meeting outputs error:", err);
    res.status(500).json({ message: "Failed to fetch meeting outputs" });
  }
});

meetingsRouter.get("/api/meetings/:id/transcript", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const transcript = await storage.getMeetingTranscript(id);
    if (!transcript) return res.status(404).json({ message: "No transcript found" });
    res.json(transcript);
  } catch (err) {
    logger.error("Meeting transcript error:", err);
    res.status(500).json({ message: "Failed to fetch transcript" });
  }
});

meetingsRouter.post("/api/meetings/:id/outputs/review-compliance", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, id))) return;
    const outputs = await storage.getMeetingOutputs(id);
    if (!outputs) return res.status(404).json({ message: "No outputs to review" });
    res.json(
      await storage.updateMeetingOutputs(outputs.id, {
        complianceReviewed: true,
        complianceReviewedBy: req.session.staffId,
        complianceReviewedAt: new Date(),
      })
    );
  } catch (err) {
    logger.error("Compliance review error:", err);
    res.status(500).json({ message: "Failed to review compliance" });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

meetingsRouter.get("/api/meetings/:meetingId/tasks", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.meetingId);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    res.json(await storage.getMeetingTasks(meetingId));
  } catch (err) {
    logger.error("Meeting tasks error:", err);
    res.status(500).json({ message: "Failed to fetch meeting tasks" });
  }
});

meetingsRouter.patch("/api/meetings/:meetingId/tasks/:taskId", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.meetingId);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    const taskId = Number(req.params.taskId);
    const task = await storage.getMeetingTask(taskId);
    if (!task || task.meetingId !== meetingId) {
      return res.status(404).json({ message: "Task not found" });
    }
    const { status } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (status === "complete") updates.completedAt = new Date();
    res.json(await storage.updateMeetingTask(taskId, updates));
  } catch (err) {
    logger.error("Meeting task update error:", err);
    res.status(500).json({ message: "Failed to update meeting task" });
  }
});

// ── Consent ───────────────────────────────────────────────────────────────────

meetingsRouter.get("/api/meetings/:id/consent", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    res.json((await storage.getMeetingConsent(meetingId)) || null);
  } catch (err) {
    logger.error("Get consent error:", err);
    res.status(500).json({ message: "Failed to fetch consent" });
  }
});

meetingsRouter.post("/api/meetings/:id/consent", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    const { consentMethod, notes } = req.body;
    const meeting = await storage.getMeeting(meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const staffId = req.session.staffId as number;
    res.status(201).json(
      await storage.createMeetingConsent({
        meetingId,
        clientId: meeting.clientId,
        consentMethod: consentMethod || "verbal",
        verbalCertifiedBy: consentMethod === "verbal" ? staffId : undefined,
        ipAddress: req.ip || undefined,
        notes,
      })
    );
  } catch (err) {
    logger.error("Create consent error:", err);
    res.status(500).json({ message: "Failed to record consent" });
  }
});

// ── In-app recording chunks ───────────────────────────────────────────────────

meetingsRouter.post("/api/meetings/:id/chunks", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    const consent = await storage.getMeetingConsent(meetingId);
    if (!consent || consent.consentRevokedAt) {
      return res.status(403).json({ message: "Recording consent is required" });
    }
    const { chunkIndex, audioData, sizeBytes } = req.body;
    if (typeof chunkIndex !== "number" || !audioData) {
      return res.status(400).json({ message: "Missing chunkIndex or audioData" });
    }
    const chunk = await storage.createRecordingChunk({
      meetingId,
      chunkIndex,
      audioData,
      sizeBytes: sizeBytes || 0,
    });
    if (chunkIndex === 0) {
      await storage.updateMeeting(meetingId, { recordingStatus: "recording" });
    }
    res.status(201).json({ id: chunk.id, chunkIndex: chunk.chunkIndex });
  } catch (err) {
    logger.error("Chunk upload error:", err);
    res.status(500).json({ message: "Failed to upload chunk" });
  }
});

meetingsRouter.post("/api/meetings/:id/recording/complete", isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, meetings, meetingId))) return;
    await storage.updateMeeting(meetingId, { recordingStatus: "processing" });
    const consent = await storage.getMeetingConsent(meetingId);
    if (!consent || consent.consentRevokedAt) {
      return res.status(403).json({ message: "Recording consent is required before processing" });
    }
    const chunks = await storage.getRecordingChunks(meetingId);
    if (chunks.length === 0) {
      return res.status(400).json({ message: "No recording chunks found" });
    }

    let fullText = "";
    let segments: Array<{ speaker: string; start: number; end: number; text: string }> = [];

    if (process.env.OPENAI_API_KEY) {
      // Use Whisper when OpenAI key is available — dynamic import avoids startup crash
      const { default: OpenAI, toFile } = await import("openai");
      const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const binaryChunks = chunks.map(c => Buffer.from(c.audioData, "base64"));
      const audioBuffer = Buffer.concat(binaryChunks);
      const audioFile = await toFile(audioBuffer, "recording.webm", { type: "audio/webm" });
      const whisperResponse = await openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      segments = (whisperResponse.segments || []).map(
        (seg: { start: number; end: number; text: string }, idx: number) => ({
          speaker: idx % 2 === 0 ? "Speaker 1" : "Speaker 2",
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        })
      );
      fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    } else {
      // No Whisper — mark as done so AI intelligence can still run if transcript was set via Web Speech API
      const existing = await storage.getMeetingTranscript(meetingId);
      const meeting = await storage.getMeeting(meetingId);
      fullText = existing?.fullText || meeting?.transcript || "";
      if (!fullText) {
        await storage.updateMeeting(meetingId, { recordingStatus: "done" });
        await storage.deleteRecordingChunks(meetingId);
        return res.json({ message: "Audio saved (transcription requires OPENAI_API_KEY)", wordCount: 0 });
      }
    }

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const existingTranscript = await storage.getMeetingTranscript(meetingId);
    if (!existingTranscript && fullText) {
      await storage.createMeetingTranscript({
        meetingId,
        segments,
        fullText,
        language: "en-CA",
        wordCount,
      });
    }
    if (fullText) {
      await storage.updateMeeting(meetingId, { transcript: fullText, recordingStatus: "processing" });
    }
    await storage.deleteRecordingChunks(meetingId);
    try {
      const { processMeetingIntelligence } = await import("../services/meeting-intelligence");
      await processMeetingIntelligence(meetingId);
    } catch (aiErr) {
      logger.error(`AI processing failed for meeting ${meetingId}:`, aiErr);
      await storage.updateMeeting(meetingId, { recordingStatus: "error" });
    }
    res.json({ message: "Recording processed", wordCount });
  } catch (err) {
    logger.error("Recording complete error:", err);
    await storage.updateMeeting(Number(req.params.id), { recordingStatus: "error" }).catch(() => {});
    res.status(500).json({ message: "Failed to process recording" });
  }
});

// ── Recall webhook ────────────────────────────────────────────────────────────

meetingsRouter.post("/api/webhooks/recall", express.json(), async (req, res) => {
  try {
    const webhookSecret = process.env.RECALL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedToken = req.headers["x-recall-webhook-secret"] || req.query.secret;
      if (providedToken !== webhookSecret) {
        return res.status(401).json({ message: "Invalid webhook secret" });
      }
    }
    const { event, data } = req.body;
    if (!data?.bot_id) return res.status(400).json({ message: "Missing bot_id" });
    const meeting = await storage.getMeetingByRecallBotId(data.bot_id);
    if (!meeting) {
      logger.info(`Recall webhook: no meeting found for bot ${data.bot_id}`);
      return res.status(200).json({ message: "ok" });
    }
    const { mapRecallStatusToRecordingStatus } = await import("../services/recall");
    if (event === "bot.status_change") {
      const newStatus = mapRecallStatusToRecordingStatus(data.status?.code || "");
      await storage.updateMeeting(meeting.id, { recordingStatus: newStatus });
      if (data.status?.code === "done" || data.status?.code === "analysis_done") {
        const existingTranscript = await storage.getMeetingTranscript(meeting.id);
        if (existingTranscript) {
          return res.status(200).json({ message: "ok (duplicate)" });
        }
        try {
          const {
            getRecallBotTranscript,
            getRecallRecordingUrl,
            formatRecallTranscript,
          } = await import("../services/recall");
          const [rawTranscript, recordingUrl] = await Promise.all([
            getRecallBotTranscript(data.bot_id),
            getRecallRecordingUrl(data.bot_id),
          ]);
          const { structured, fullText } = formatRecallTranscript(rawTranscript);
          const wordCount = fullText.split(/\s+/).filter(Boolean).length;
          await storage.createMeetingTranscript({
            meetingId: meeting.id,
            segments: structured,
            fullText,
            language: "en-CA",
            wordCount,
          });
          await storage.updateMeeting(meeting.id, {
            recordingUrl: recordingUrl || undefined,
            recordingStatus: "processing",
          });
          const { processMeetingIntelligence } = await import("../services/meeting-intelligence");
          await processMeetingIntelligence(meeting.id);
        } catch (processErr) {
          logger.error(`Recall webhook: failed to process meeting ${meeting.id}:`, processErr);
          await storage.updateMeeting(meeting.id, { recordingStatus: "error" });
        }
      }
    }
    res.status(200).json({ message: "ok" });
  } catch (err) {
    logger.error("Recall webhook error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});
