import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./auth";
import { z } from "zod";
import { storage } from "./storage";
import { OutlookEmailProvider } from "./email/providers/outlook";

interface SessionUser {
  id: number;
  email: string;
  type: "staff" | "host";
}

async function getUserFromSession(req: { session?: { staffId?: number; hostUserId?: number; userType?: string } }): Promise<SessionUser | null> {
  if (req.session?.userType === "host" && req.session?.hostUserId) {
    const hostUser = await storage.getHostUser(req.session.hostUserId);
    if (!hostUser || !hostUser.isActive) return null;
    return { id: hostUser.id, email: hostUser.email, type: "host" };
  }
  const staffId = req.session?.staffId;
  if (staffId) {
    const member = await storage.getStaffMember(staffId);
    if (!member) return null;
    return { id: member.id, email: member.email, type: "staff" };
  }
  return null;
}

async function getStaffFromSession(req: { session?: { staffId?: number } }) {
  const staffId = req.session?.staffId;
  if (!staffId) return null;
  return await storage.getStaffMember(staffId) || null;
}

async function getOutlookProviderForUser(user: SessionUser): Promise<OutlookEmailProvider | null> {
  const config = user.type === "host"
    ? await storage.getEmailConfigurationForHost(user.id)
    : await storage.getEmailConfiguration(user.id);

  if (!config || !config.isActive || config.provider !== "outlook") return null;

  const providerConfig = (config.config || {}) as Record<string, unknown>;
  return new OutlookEmailProvider(providerConfig, async (updatedTokens) => {
    await storage.updateEmailConfiguration(config.id, { config: updatedTokens });
  });
}

function parseVttToPlainText(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let currentSpeaker = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "WEBVTT" || trimmed.includes("-->") || /^\d+$/.test(trimmed)) {
      continue;
    }
    const speakerMatch = trimmed.match(/^<v\s+([^>]+)>(.*)/);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      const text = speakerMatch[2].replace(/<\/v>/, "").trim();
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        textLines.push(`\n${speaker}:`);
      }
      if (text) textLines.push(text);
    } else {
      textLines.push(trimmed);
    }
  }

  return textLines.join("\n").trim();
}

export function registerOutlookRoutes(app: Express) {

  app.get("/api/outlook/teams-meetings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(403).json({ message: "Account required" });

      const staff = await getStaffFromSession(req);
      if (!staff) return res.status(403).json({ message: "Staff account required" });

      const company = await storage.getCompany(staff.companyId);
      if (!company?.moduleMeetingRecorder) {
        return res.status(403).json({ message: "Meeting Recorder module is not enabled" });
      }

      const provider = await getOutlookProviderForUser(user);
      if (!provider) {
        return res.status(403).json({ message: "Microsoft Outlook email not configured for your account" });
      }

      const client = await provider.getGraphClient();

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const filter = `startDateTime ge ${cutoff.toISOString()}`;

      const result = await client
        .api("/me/onlineMeetings")
        .filter(filter)
        .orderby("startDateTime desc")
        .top(50)
        .select("id,subject,startDateTime,endDateTime,participants,joinWebUrl")
        .get();

      const meetings = (result.value || []).map((m: Record<string, unknown>) => ({
        id: m.id,
        subject: m.subject || "Untitled Meeting",
        startDateTime: m.startDateTime,
        endDateTime: m.endDateTime,
        joinWebUrl: m.joinWebUrl,
        participantCount: Array.isArray((m.participants as Record<string, unknown>)?.attendees)
          ? ((m.participants as Record<string, unknown>).attendees as unknown[]).length
          : 0,
      }));

      res.json(meetings);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Teams meetings list error:", message);
      if (message.includes("Authorization_RequestDenied") || message.includes("Insufficient privileges")) {
        return res.status(403).json({
          message: "Additional Microsoft permissions required for Teams meetings. Please reconnect your Outlook account.",
          permissionError: true,
        });
      }
      res.status(502).json({ message: "Failed to fetch Teams meetings", error: message });
    }
  });

  app.get("/api/outlook/teams-meetings/:meetingId/transcript", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(403).json({ message: "Account required" });

      const staff = await getStaffFromSession(req);
      if (!staff) return res.status(403).json({ message: "Staff account required" });

      const company = await storage.getCompany(staff.companyId);
      if (!company?.moduleMeetingRecorder) {
        return res.status(403).json({ message: "Meeting Recorder module is not enabled" });
      }

      const provider = await getOutlookProviderForUser(user);
      if (!provider) {
        return res.status(403).json({ message: "Microsoft Outlook email not configured for your account" });
      }

      const client = await provider.getGraphClient();
      const meetingId = req.params.meetingId;

      const transcriptsResult = await client
        .api(`/me/onlineMeetings/${meetingId}/transcripts`)
        .get();

      const transcripts = transcriptsResult.value || [];
      if (transcripts.length === 0) {
        return res.status(404).json({
          message: "No transcript available for this meeting. Ensure transcription was enabled during the meeting.",
          noTranscript: true,
        });
      }

      const transcriptId = transcripts[0].id;
      const content = await client
        .api(`/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
        .query({ "$format": "text/vtt" })
        .get();

      const transcriptText = typeof content === "string"
        ? parseVttToPlainText(content)
        : String(content);

      res.json({ transcript: transcriptText, transcriptId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Teams transcript fetch error:", message);
      if (message.includes("404") || message.includes("Not Found")) {
        return res.status(404).json({
          message: "No transcript available for this meeting.",
          noTranscript: true,
        });
      }
      res.status(502).json({ message: "Failed to fetch transcript", error: message });
    }
  });

  app.post("/api/clients/:clientId/meetings/import-teams", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(403).json({ message: "Account required" });

      const staff = await getStaffFromSession(req);
      if (!staff) return res.status(403).json({ message: "Staff account required" });

      const company = await storage.getCompany(staff.companyId);
      if (!company?.moduleMeetingRecorder) {
        return res.status(403).json({ message: "Meeting Recorder module is not enabled" });
      }

      const clientId = Number(req.params.clientId);
      const linkedClient = await storage.getClient(clientId);
      if (!linkedClient || linkedClient.companyId !== staff.companyId) {
        return res.status(404).json({ message: "Client not found in your company" });
      }

      const input = z.object({
        teamsMeetingId: z.string().min(1),
        subject: z.string().min(1),
        startDateTime: z.string().min(1),
      }).parse(req.body);

      const provider = await getOutlookProviderForUser(user);
      if (!provider) {
        return res.status(403).json({ message: "Microsoft Outlook email not configured for your account" });
      }

      const graphClient = await provider.getGraphClient();
      const transcriptsResult = await graphClient
        .api(`/me/onlineMeetings/${input.teamsMeetingId}/transcripts`)
        .get();

      const transcripts = transcriptsResult.value || [];
      if (transcripts.length === 0) {
        return res.status(404).json({
          message: "No transcript available for this meeting. Ensure transcription was enabled during the meeting.",
          noTranscript: true,
        });
      }

      const transcriptId = transcripts[0].id;
      const content = await graphClient
        .api(`/me/onlineMeetings/${input.teamsMeetingId}/transcripts/${transcriptId}/content`)
        .query({ "$format": "text/vtt" })
        .get();

      const transcriptText = typeof content === "string"
        ? parseVttToPlainText(content)
        : String(content);

      const meeting = await storage.createMeeting({
        clientId,
        title: `Teams: ${input.subject}`,
        date: new Date(input.startDateTime),
        transcript: transcriptText,
      });

      let summary = "";
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: "Summarize this client meeting transcript for a financial advisor's notes. Extract key discussion points, decisions made, and action items. Format with clear sections.",
          messages: [{ role: "user", content: transcriptText }],
        });
        summary = (msg.content[0] as any).text || "";
      } catch (aiErr: unknown) {
        const aiMessage = aiErr instanceof Error ? aiErr.message : "Unknown AI error";
        console.error("AI summarization failed for Teams import:", aiMessage);
      }

      let updatedMeeting = meeting;
      if (summary) {
        updatedMeeting = await storage.updateMeeting(meeting.id, { summary });
      }

      await storage.createActivity({
        clientId,
        activityType: "meeting",
        title: `Teams meeting imported: ${input.subject}`,
        description: summary || "Teams meeting transcript imported",
        date: new Date(input.startDateTime),
        duration: null,
        staffId: staff.id,
      });

      res.status(201).json(updatedMeeting);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Teams meeting import error:", message);
      res.status(502).json({ message: "Failed to import Teams meeting", error: message });
    }
  });
}
