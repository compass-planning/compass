import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";
import type {
  EmailProvider,
  EmailProviderStatus,
  NormalizedFolder,
  NormalizedMessage,
  NormalizedEvent,
  SendMessageParams,
  CreateEventParams,
  UpdateEventParams,
  AttachmentMeta,
  OutgoingAttachment,
  ReplyExtras,
} from "../provider";
import { logger } from "../../logger";

interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

type TokenPersistCallback = (tokens: GmailTokens) => Promise<void>;

export class GmailEmailProvider implements EmailProvider {
  private tokens: GmailTokens;
  private onTokenRefresh?: TokenPersistCallback;

  constructor(
    config: Record<string, unknown>,
    onTokenRefresh?: TokenPersistCallback,
  ) {
    this.tokens = {
      accessToken: config.accessToken as string,
      refreshToken: config.refreshToken as string,
      expiresAt: config.expiresAt as number | undefined,
    };
    this.onTokenRefresh = onTokenRefresh;
  }

  private getOAuth2Client() {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getGmailRedirectUri(),
    );
    oauth2.setCredentials({
      access_token: this.tokens.accessToken,
      refresh_token: this.tokens.refreshToken,
      expiry_date: this.tokens.expiresAt,
    });

    oauth2.on("tokens", (newTokens) => {
      if (newTokens.access_token) {
        this.tokens.accessToken = newTokens.access_token;
      }
      if (newTokens.expiry_date) {
        this.tokens.expiresAt = newTokens.expiry_date;
      }
      if (this.onTokenRefresh) {
        this.onTokenRefresh(this.tokens).catch((err) => {
          logger.error("Failed to persist refreshed Gmail tokens:", err);
        });
      }
    });

    return oauth2;
  }

  private getGmail() {
    return google.gmail({ version: "v1", auth: this.getOAuth2Client() });
  }

  private getCalendar() {
    return google.calendar({ version: "v3", auth: this.getOAuth2Client() });
  }

  async getStatus(staffEmail: string): Promise<EmailProviderStatus> {
    try {
      const gmail = this.getGmail();
      const profile = await gmail.users.getProfile({ userId: "me" });
      const connectedEmail = (profile.data.emailAddress || "").toLowerCase();
      return {
        connected: true,
        email: connectedEmail,
        displayName: connectedEmail,
        provider: "gmail",
      };
    } catch {
      return {
        connected: false,
        staffEmail: staffEmail.toLowerCase(),
        provider: "gmail",
        reason: "service_error",
      };
    }
  }

  async listFolders(): Promise<NormalizedFolder[]> {
    const gmail = this.getGmail();
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = res.data.labels || [];

    const wellKnownMap: Record<string, string> = {
      INBOX: "inbox",
      SENT: "sentitems",
      DRAFT: "drafts",
      TRASH: "deleteditems",
      SPAM: "junkemail",
    };

    const detailPromises = labels.map(async (label) => {
      try {
        const detail = await gmail.users.labels.get({
          userId: "me",
          id: label.id!,
        });
        return detail.data;
      } catch {
        return label;
      }
    });

    const detailedLabels = await Promise.all(detailPromises);

    return detailedLabels.map((label) => ({
      id: label.id || "",
      displayName: label.name || "",
      parentFolderId: null,
      childFolderCount: 0,
      totalItemCount: label.messagesTotal || 0,
      unreadItemCount: label.messagesUnread || 0,
      wellKnownName: wellKnownMap[label.id || ""],
    }));
  }

  async listMessages(folderId: string): Promise<NormalizedMessage[]> {
    const gmail = this.getGmail();
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: [folderId],
      maxResults: 50,
    });

    const messageIds = res.data.messages || [];
    if (messageIds.length === 0) return [];

    const messagePromises = messageIds.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
        });
        return this.normalizeMessage(detail.data, folderId);
      } catch {
        return null;
      }
    });

    const messages = await Promise.all(messagePromises);
    return messages.filter((m): m is NormalizedMessage => m !== null);
  }

  async getMessage(messageId: string): Promise<NormalizedMessage> {
    const gmail = this.getGmail();
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    return this.normalizeMessage(res.data);
  }

  /** Builds an RFC 5322 message with MailComposer (encodes headers, blocks header injection). */
  private async buildRaw(opts: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    attachments?: OutgoingAttachment[];
    inReplyTo?: string;
    references?: string;
  }): Promise<string> {
    const clean = (list?: string[]) => (list || []).map((a) => a.replace(/[\r\n,<>"]/g, "").trim()).filter(Boolean);
    const composer = new MailComposer({
      to: clean(opts.to),
      cc: clean(opts.cc),
      bcc: clean(opts.bcc),
      subject: opts.subject.replace(/[\r\n]+/g, " "),
      html: opts.html,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
      attachments: (opts.attachments || []).map((a) => ({
        filename: a.name,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    const node = composer.compile();
    // Gmail's API reads recipients from the headers, so Bcc must stay in the raw message (Gmail strips it on delivery).
    node.keepBcc = true;
    const buf: Buffer = await new Promise((resolve, reject) =>
      node.build((err: Error | null, msg: Buffer) => (err ? reject(err) : resolve(msg))),
    );
    return buf.toString("base64url");
  }

  async sendMessage(params: SendMessageParams): Promise<void> {
    const gmail = this.getGmail();
    const raw = await this.buildRaw({
      to: params.toRecipients,
      cc: params.ccRecipients,
      bcc: params.bccRecipients,
      subject: params.subject,
      html: params.body,
      attachments: params.attachments,
    });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  }

  async replyToMessage(messageId: string, comment: string, extras?: ReplyExtras): Promise<void> {
    const gmail = this.getGmail();
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "Reply-To", "Subject", "Message-ID", "References"],
    });
    const headers = original.data.payload?.headers || [];
    const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value || "";
    const replyTo = this.parseEmailAddress(h("Reply-To") || h("From")).address;
    const subjectHeader = h("Subject");
    const subject = /^re:/i.test(subjectHeader) ? subjectHeader : `Re: ${subjectHeader}`;
    const msgId = h("Message-ID");
    const refs = [h("References"), msgId].filter(Boolean).join(" ");
    const raw = await this.buildRaw({
      to: [replyTo],
      cc: extras?.ccRecipients,
      bcc: extras?.bccRecipients,
      subject,
      html: comment,
      attachments: extras?.attachments,
      inReplyTo: msgId || undefined,
      references: refs || undefined,
    });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: original.data.threadId || undefined },
    });
  }

  private collectAttachmentParts(part: Record<string, unknown> | undefined, out: AttachmentMeta[]): void {
    if (!part) return;
    const body = part.body as { attachmentId?: string; size?: number } | undefined;
    const filename = part.filename as string | undefined;
    if (filename && body?.attachmentId) {
      const headers = (part.headers as Array<{ name?: string; value?: string }> | undefined) || [];
      const disp = headers.find((x) => x.name?.toLowerCase() === "content-disposition")?.value || "";
      out.push({
        id: body.attachmentId,
        name: filename,
        contentType: (part.mimeType as string) || "application/octet-stream",
        size: body.size || 0,
        isInline: /^inline/i.test(disp),
      });
    }
    for (const child of (part.parts as Array<Record<string, unknown>> | undefined) || []) {
      this.collectAttachmentParts(child, out);
    }
  }

  async listAttachments(messageId: string): Promise<AttachmentMeta[]> {
    const gmail = this.getGmail();
    const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
    const out: AttachmentMeta[] = [];
    this.collectAttachmentParts(res.data.payload as Record<string, unknown>, out);
    return out;
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<{ meta: AttachmentMeta; content: Buffer }> {
    const gmail = this.getGmail();
    const meta = (await this.listAttachments(messageId)).find((a) => a.id === attachmentId);
    if (!meta) throw new Error("Attachment not found");
    const res = await gmail.users.messages.attachments.get({ userId: "me", messageId, id: attachmentId });
    return { meta, content: Buffer.from(res.data.data || "", "base64url") };
  }

  async markAsRead(messageId: string): Promise<void> {
    const gmail = this.getGmail();
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    const gmail = this.getGmail();
    await gmail.users.messages.trash({ userId: "me", id: messageId });
  }

  async moveMessage(messageId: string, destinationId: string): Promise<void> {
    const gmail = this.getGmail();
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "minimal",
    });
    const currentLabels = msg.data.labelIds || [];
    const systemLabels = [
      "UNREAD",
      "STARRED",
      "IMPORTANT",
      "CATEGORY_PERSONAL",
      "CATEGORY_SOCIAL",
      "CATEGORY_PROMOTIONS",
      "CATEGORY_UPDATES",
      "CATEGORY_FORUMS",
    ];
    const folderLabels = currentLabels.filter(
      (l) => !systemLabels.includes(l) && l !== destinationId,
    );

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds: [destinationId],
        removeLabelIds: folderLabels,
      },
    });
  }

  async listEvents(
    start: string,
    end: string,
    timeZone: string,
  ): Promise<NormalizedEvent[]> {
    const calendar = this.getCalendar();
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: start,
      timeMax: end,
      timeZone,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    return (res.data.items || []).map((e) => this.normalizeEvent(e));
  }

  async getEvent(eventId: string): Promise<NormalizedEvent> {
    const calendar = this.getCalendar();
    const res = await calendar.events.get({ calendarId: "primary", eventId });
    return this.normalizeEvent(res.data);
  }

  async createEvent(params: CreateEventParams): Promise<NormalizedEvent> {
    const calendar = this.getCalendar();
    const event: Record<string, unknown> = {
      summary: params.subject,
      start: params.isAllDay
        ? { date: params.start.split("T")[0], timeZone: params.timeZone }
        : { dateTime: params.start, timeZone: params.timeZone },
      end: params.isAllDay
        ? { date: params.end.split("T")[0], timeZone: params.timeZone }
        : { dateTime: params.end, timeZone: params.timeZone },
    };

    if (params.location) event.location = params.location;
    if (params.body) event.description = params.body;
    if (params.attendees?.length) {
      event.attendees = params.attendees.map((email) => ({ email }));
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
    return this.normalizeEvent(res.data);
  }

  async updateEvent(
    eventId: string,
    params: UpdateEventParams,
  ): Promise<NormalizedEvent> {
    const calendar = this.getCalendar();
    const update: Record<string, unknown> = {};

    if (params.subject) update.summary = params.subject;
    if (params.start)
      update.start = {
        dateTime: params.start,
        timeZone: params.timeZone || "UTC",
      };
    if (params.end)
      update.end = { dateTime: params.end, timeZone: params.timeZone || "UTC" };
    if (params.location) update.location = params.location;
    if (params.body) update.description = params.body;

    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: update,
    });
    return this.normalizeEvent(res.data);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const calendar = this.getCalendar();
    await calendar.events.delete({ calendarId: "primary", eventId });
  }

  private getHeader(
    headers: Array<{ name?: string | null; value?: string | null }> | undefined,
    name: string,
  ): string {
    return (
      headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value || ""
    );
  }

  private parseEmailAddress(raw: string): { name: string; address: string } {
    const match = raw.match(/^(.+?)\s*<(.+)>$/);
    if (match)
      return { name: match[1].trim().replace(/^"|"$/g, ""), address: match[2] };
    return { name: "", address: raw.trim() };
  }

  private parseEmailAddresses(
    raw: string,
  ): { name: string; address: string }[] {
    if (!raw) return [];
    return raw.split(",").map((part) => this.parseEmailAddress(part.trim()));
  }

  private getBodyContent(
    payload: Record<string, unknown> | undefined,
  ): { content: string; contentType: string } | undefined {
    if (!payload) return undefined;

    const mimeType = payload.mimeType as string | undefined;
    const body = payload.body as { data?: string; size?: number } | undefined;
    const parts = payload.parts as Array<Record<string, unknown>> | undefined;

    if (body?.data) {
      const decoded = Buffer.from(body.data, "base64url").toString("utf-8");
      return {
        content: decoded,
        contentType: mimeType === "text/html" ? "html" : "text",
      };
    }

    if (parts) {
      const htmlPart = parts.find(
        (p) => (p.mimeType as string) === "text/html",
      );
      if (htmlPart) {
        const partBody = htmlPart.body as { data?: string } | undefined;
        if (partBody?.data) {
          return {
            content: Buffer.from(partBody.data, "base64url").toString("utf-8"),
            contentType: "html",
          };
        }
      }
      const textPart = parts.find(
        (p) => (p.mimeType as string) === "text/plain",
      );
      if (textPart) {
        const partBody = textPart.body as { data?: string } | undefined;
        if (partBody?.data) {
          return {
            content: Buffer.from(partBody.data, "base64url").toString("utf-8"),
            contentType: "text",
          };
        }
      }
      for (const part of parts) {
        const nested = this.getBodyContent(part);
        if (nested) return nested;
      }
    }

    return undefined;
  }

  private normalizeMessage(
    msg: Record<string, unknown>,
    parentFolderId?: string,
  ): NormalizedMessage {
    const payload = msg.payload as Record<string, unknown> | undefined;
    const headers = payload?.headers as
      | Array<{ name?: string | null; value?: string | null }>
      | undefined;
    const labelIds = msg.labelIds as string[] | undefined;

    const from = this.parseEmailAddress(this.getHeader(headers, "From"));
    const to = this.parseEmailAddresses(this.getHeader(headers, "To"));
    const cc = this.parseEmailAddresses(this.getHeader(headers, "Cc"));
    const bcc = this.parseEmailAddresses(this.getHeader(headers, "Bcc"));
    const dateStr = this.getHeader(headers, "Date");
    const isUnread = labelIds?.includes("UNREAD") ?? false;
    const isDraft = labelIds?.includes("DRAFT") ?? false;

    return {
      id: msg.id as string,
      subject: this.getHeader(headers, "Subject") || "(No Subject)",
      from,
      toRecipients: to,
      ccRecipients: cc.length > 0 ? cc : undefined,
      bccRecipients: bcc.length > 0 ? bcc : undefined,
      receivedDateTime: dateStr ? new Date(dateStr).toISOString() : undefined,
      sentDateTime: dateStr ? new Date(dateStr).toISOString() : undefined,
      bodyPreview: (msg.snippet as string) || "",
      body: this.getBodyContent(payload),
      isRead: !isUnread,
      hasAttachments: payload?.parts
        ? (payload.parts as Array<Record<string, unknown>>).some(
            (p) =>
              (p.filename as string | undefined) &&
              (p.filename as string).length > 0,
          )
        : false,
      importance: "normal",
      isDraft,
      parentFolderId: parentFolderId || labelIds?.[0],
    };
  }

  private normalizeEvent(event: Record<string, unknown>): NormalizedEvent {
    const start = event.start as
      | { dateTime?: string; date?: string; timeZone?: string }
      | undefined;
    const end = event.end as
      | { dateTime?: string; date?: string; timeZone?: string }
      | undefined;
    const organizer = event.organizer as
      | { displayName?: string; email?: string }
      | undefined;
    const attendees = event.attendees as
      | Array<{ displayName?: string; email?: string; responseStatus?: string }>
      | undefined;

    return {
      id: event.id as string,
      subject: (event.summary as string) || "",
      start: {
        dateTime: start?.dateTime || start?.date || "",
        timeZone: start?.timeZone || "UTC",
      },
      end: {
        dateTime: end?.dateTime || end?.date || "",
        timeZone: end?.timeZone || "UTC",
      },
      location: event.location
        ? { displayName: event.location as string }
        : undefined,
      bodyPreview: (event.description as string) || undefined,
      body: event.description
        ? { content: event.description as string, contentType: "text" }
        : undefined,
      organizer: organizer
        ? { name: organizer.displayName || "", address: organizer.email || "" }
        : undefined,
      isAllDay: !start?.dateTime,
      showAs:
        (event.transparency as string) === "transparent" ? "free" : "busy",
      importance: "normal",
      attendees: attendees
        ? attendees.map((a) => ({
            name: a.displayName || "",
            address: a.email || "",
            type: a.responseStatus || "needsAction",
          }))
        : undefined,
      onlineMeetingUrl: (event.hangoutLink as string) || undefined,
    };
  }
}

export function getGmailRedirectUri(): string {
  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain) {
    return `https://${customDomain}/api/crm/email/auth/gmail/callback`;
  }
  // Local development fallback — CUSTOM_DOMAIN must be set in all deployed environments
  return `http://localhost:8080/api/crm/email/auth/gmail/callback`;
}

export function getGmailAuthUrl(state: string): string {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGmailRedirectUri(),
  );

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

export async function exchangeGmailCode(code: string): Promise<GmailTokens> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGmailRedirectUri(),
  );

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to obtain Gmail tokens");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date || undefined,
  };
}

/** Revokes a Google OAuth token (refresh or access). Best-effort; callers ignore failures. */
export async function revokeGoogleToken(token?: string): Promise<void> {
  if (!token) return;
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });
}
