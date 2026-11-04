import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import {
  CalendarNotAvailableError,
  type EmailProvider,
  type EmailProviderStatus,
  type NormalizedFolder,
  type NormalizedMessage,
  type NormalizedEvent,
  type SendMessageParams,
  type CreateEventParams,
  type UpdateEventParams,
} from "../provider";

export interface ImapSmtpConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  email: string;
  password: string;
}

const WELL_KNOWN_MAP: Record<string, string> = {
  INBOX: "inbox",
  Sent: "sentitems",
  "Sent Items": "sentitems",
  "Sent Mail": "sentitems",
  Drafts: "drafts",
  Trash: "deleteditems",
  "Deleted Items": "deleteditems",
  Junk: "junkemail",
  "Junk E-mail": "junkemail",
  Spam: "junkemail",
  Archive: "archive",
};

export class ImapSmtpEmailProvider implements EmailProvider {
  private config: ImapSmtpConfig;

  constructor(config: Record<string, unknown>) {
    this.config = {
      imapHost: config.imapHost as string,
      imapPort: config.imapPort as number,
      imapSecure: config.imapSecure as boolean,
      smtpHost: config.smtpHost as string,
      smtpPort: config.smtpPort as number,
      smtpSecure: config.smtpSecure as boolean,
      email: config.email as string,
      password: config.password as string,
    };
  }

  private async getImapClient(): Promise<ImapFlow> {
    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: { user: this.config.email, pass: this.config.password },
      logger: false,
    });
    await client.connect();
    return client;
  }

  private getSmtpTransport() {
    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: { user: this.config.email, pass: this.config.password },
    });
  }

  async getStatus(staffEmail: string): Promise<EmailProviderStatus> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getImapClient();
      await client.logout();
      return {
        connected: true,
        email: this.config.email,
        displayName: this.config.email,
        provider: "imap_smtp",
      };
    } catch {
      return {
        connected: false,
        staffEmail: staffEmail.toLowerCase(),
        provider: "imap_smtp",
        reason: "service_error",
      };
    }
  }

  async listFolders(): Promise<NormalizedFolder[]> {
    const client = await this.getImapClient();
    try {
      const mailboxes = await client.list();
      const folders: NormalizedFolder[] = [];

      for (const mailbox of mailboxes) {
        let status = { messages: 0, unseen: 0 };
        try {
          status = await client.status(mailbox.path, {
            messages: true,
            unseen: true,
          });
        } catch {
          // skip
        }

        const displayName = mailbox.name || mailbox.path;
        const wellKnownName =
          WELL_KNOWN_MAP[displayName] ||
          (mailbox.specialUse
            ? this.mapSpecialUse(mailbox.specialUse)
            : undefined);

        folders.push({
          id: mailbox.path,
          displayName,
          parentFolderId: mailbox.parentPath || null,
          childFolderCount: 0,
          totalItemCount: status.messages || 0,
          unreadItemCount: status.unseen || 0,
          wellKnownName,
        });
      }

      return folders;
    } finally {
      await client.logout();
    }
  }

  async listMessages(folderId: string): Promise<NormalizedMessage[]> {
    const client = await this.getImapClient();
    try {
      const lock = await client.getMailboxLock(folderId);
      try {
        const messages: NormalizedMessage[] = [];
        const totalMessages = client.mailbox?.exists || 0;
        if (totalMessages === 0) return [];

        const startSeq = Math.max(1, totalMessages - 49);
        const range = `${startSeq}:${totalMessages}`;

        for await (const msg of client.fetch(
          range,
          {
            envelope: true,
            flags: true,
            bodyStructure: true,
            uid: true,
          },
          { uid: false },
        )) {
          messages.push(this.normalizeEnvelope(msg, folderId));
        }

        return messages.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getMessage(messageId: string): Promise<NormalizedMessage> {
    const { folder, uid } = this.parseMessageId(messageId);
    const client = await this.getImapClient();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const source = await client.fetchOne(
          uid,
          { source: true, envelope: true, flags: true },
          { uid: true },
        );
        const parsed = await simpleParser(source.source);

        const from = parsed.from?.value?.[0];
        const toRecipients = parsed.to
          ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(
              (t) => t.value || [],
            )
          : [];
        const ccRecipients = parsed.cc
          ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap(
              (c) => c.value || [],
            )
          : [];

        return {
          id: messageId,
          subject: parsed.subject || "",
          from: { name: from?.name || "", address: from?.address || "" },
          toRecipients: toRecipients.map((r) => ({
            name: r.name || "",
            address: r.address || "",
          })),
          ccRecipients:
            ccRecipients.length > 0
              ? ccRecipients.map((r) => ({
                  name: r.name || "",
                  address: r.address || "",
                }))
              : undefined,
          receivedDateTime: parsed.date?.toISOString(),
          sentDateTime: parsed.date?.toISOString(),
          bodyPreview: parsed.text?.substring(0, 200) || "",
          body: parsed.html
            ? { content: parsed.html as string, contentType: "html" }
            : { content: parsed.text || "", contentType: "text" },
          isRead: source.flags?.has("\\Seen") || false,
          hasAttachments: (parsed.attachments?.length || 0) > 0,
          importance: "normal",
          parentFolderId: folder,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async sendMessage(params: SendMessageParams): Promise<void> {
    const transport = this.getSmtpTransport();
    await transport.sendMail({
      from: this.config.email,
      to: params.toRecipients.join(", "),
      cc: params.ccRecipients?.join(", "),
      subject: params.subject,
      html: params.body,
    });
  }

  async replyToMessage(messageId: string, comment: string): Promise<void> {
    const original = await this.getMessage(messageId);
    const transport = this.getSmtpTransport();
    const subject = original.subject.startsWith("Re:")
      ? original.subject
      : `Re: ${original.subject}`;

    await transport.sendMail({
      from: this.config.email,
      to: original.from.address,
      subject,
      html: comment,
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    const { folder, uid } = this.parseMessageId(messageId);
    const client = await this.getImapClient();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const { folder, uid } = this.parseMessageId(messageId);
    const client = await this.getImapClient();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd(uid, ["\\Deleted"], { uid: true });
        await client.messageDelete(uid, { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async moveMessage(messageId: string, destinationId: string): Promise<void> {
    const { folder, uid } = this.parseMessageId(messageId);
    const client = await this.getImapClient();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove(uid, destinationId, { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  calendarAvailable = false;

  async listEvents(
    _start: string,
    _end: string,
    _timeZone: string,
  ): Promise<NormalizedEvent[]> {
    return [];
  }

  async getEvent(_eventId: string): Promise<NormalizedEvent> {
    throw new CalendarNotAvailableError();
  }

  async createEvent(_params: CreateEventParams): Promise<NormalizedEvent> {
    throw new CalendarNotAvailableError();
  }

  async updateEvent(
    _eventId: string,
    _params: UpdateEventParams,
  ): Promise<NormalizedEvent> {
    throw new CalendarNotAvailableError();
  }

  async deleteEvent(_eventId: string): Promise<void> {
    throw new CalendarNotAvailableError();
  }

  private parseMessageId(messageId: string): { folder: string; uid: number } {
    const sepIndex = messageId.lastIndexOf(":");
    if (sepIndex === -1) throw new Error("Invalid message ID format");
    return {
      folder: messageId.substring(0, sepIndex),
      uid: parseInt(messageId.substring(sepIndex + 1), 10),
    };
  }

  private normalizeEnvelope(
    msg: Record<string, unknown>,
    folderId: string,
  ): NormalizedMessage {
    const envelope = msg.envelope as {
      subject?: string;
      from?: Array<{ name?: string; address?: string }>;
      to?: Array<{ name?: string; address?: string }>;
      cc?: Array<{ name?: string; address?: string }>;
      date?: Date;
      messageId?: string;
    };
    const flags = msg.flags as Set<string> | undefined;
    const uid = msg.uid as number;

    const from = envelope?.from?.[0];

    return {
      id: `${folderId}:${uid}`,
      subject: envelope?.subject || "",
      from: { name: from?.name || "", address: from?.address || "" },
      toRecipients: (envelope?.to || []).map((r) => ({
        name: r.name || "",
        address: r.address || "",
      })),
      ccRecipients: envelope?.cc?.length
        ? envelope.cc.map((r) => ({
            name: r.name || "",
            address: r.address || "",
          }))
        : undefined,
      receivedDateTime: envelope?.date
        ? new Date(envelope.date).toISOString()
        : undefined,
      sentDateTime: envelope?.date
        ? new Date(envelope.date).toISOString()
        : undefined,
      bodyPreview: "",
      isRead: flags?.has("\\Seen") || false,
      hasAttachments: false,
      importance: "normal",
      parentFolderId: folderId,
    };
  }

  private mapSpecialUse(specialUse: string): string | undefined {
    const map: Record<string, string> = {
      "\\Sent": "sentitems",
      "\\Drafts": "drafts",
      "\\Trash": "deleteditems",
      "\\Junk": "junkemail",
      "\\Archive": "archive",
      "\\All": "archive",
    };
    return map[specialUse];
  }
}

export async function testImapConnection(
  config: ImapSmtpConfig,
): Promise<{ success: boolean; error?: string }> {
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: { user: config.email, pass: config.password },
      logger: false,
    });
    await client.connect();
    await client.logout();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("AUTHENTICATIONFAILED") ||
      message.includes("Invalid credentials") ||
      message.includes("LOGIN failed")
    ) {
      return {
        success: false,
        error: "Invalid email or password. Please check your credentials.",
      };
    }
    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return {
        success: false,
        error: `Server not found: ${config.imapHost}. Please check the IMAP server address.`,
      };
    }
    if (message.includes("ECONNREFUSED")) {
      return {
        success: false,
        error: `Connection refused on port ${config.imapPort}. Please check the port and security settings.`,
      };
    }
    if (
      message.includes("DEPTH_ZERO_SELF_SIGNED_CERT") ||
      message.includes("certificate")
    ) {
      return {
        success: false,
        error:
          "SSL/TLS certificate error. The server may require different security settings.",
      };
    }
    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        success: false,
        error:
          "Connection timed out. Please check the server address and port.",
      };
    }
    return { success: false, error: `Connection failed: ${message}` };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.email, pass: config.password },
    });
    await transport.verify();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return {
        success: false,
        error: `SMTP server not found: ${config.smtpHost}. Please check the SMTP server address.`,
      };
    }
    if (message.includes("ECONNREFUSED")) {
      return {
        success: false,
        error: `SMTP connection refused on port ${config.smtpPort}. Please check the port and security settings.`,
      };
    }
    return {
      success: false,
      error: `SMTP connection failed: ${message}. IMAP connection was successful.`,
    };
  }

  return { success: true };
}
