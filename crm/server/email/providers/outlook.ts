import { Client } from "@microsoft/microsoft-graph-client";
import type {
  EmailProvider,
  EmailProviderStatus,
  NormalizedFolder,
  NormalizedMessage,
  NormalizedEvent,
  SendMessageParams,
  CreateEventParams,
  UpdateEventParams,
} from "../provider";
import { logger } from "../../logger";

interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

type TokenPersistCallback = (tokens: OutlookTokens) => Promise<void>;

const WELL_KNOWN_FOLDERS = ["inbox", "sentitems", "drafts", "deleteditems", "junkemail", "archive"];

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/OnlineMeetings.Read",
].join(" ");

export class OutlookEmailProvider implements EmailProvider {
  private tokens: OutlookTokens;
  private onTokenRefresh?: TokenPersistCallback;

  constructor(config: Record<string, unknown>, onTokenRefresh?: TokenPersistCallback) {
    this.tokens = {
      accessToken: config.accessToken as string,
      refreshToken: config.refreshToken as string,
      expiresAt: config.expiresAt as number | undefined,
    };
    this.onTokenRefresh = onTokenRefresh;
  }

  private async ensureFreshToken(): Promise<string> {
    if (this.tokens.expiresAt && this.tokens.expiresAt > Date.now() + 60_000) {
      return this.tokens.accessToken;
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: this.tokens.refreshToken,
      scope: MICROSOFT_SCOPES,
    });

    const res = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Microsoft token refresh failed: ${errText}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
    this.tokens.accessToken = data.access_token;
    if (data.refresh_token) {
      this.tokens.refreshToken = data.refresh_token;
    }
    this.tokens.expiresAt = Date.now() + data.expires_in * 1000;

    if (this.onTokenRefresh) {
      await this.onTokenRefresh(this.tokens).catch((err) => {
        logger.error("Failed to persist refreshed Outlook tokens:", err);
      });
    }

    return this.tokens.accessToken;
  }

  async getGraphClient(): Promise<Client> {
    const accessToken = await this.ensureFreshToken();
    return Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => accessToken,
      },
    });
  }

  private async getClient(): Promise<Client> {
    return this.getGraphClient();
  }

  async getStatus(staffEmail: string): Promise<EmailProviderStatus> {
    try {
      const client = await this.getClient();
      const profile = await client.api("/me").select("displayName,mail,userPrincipalName").get();
      const _connectedEmail = (profile.mail || profile.userPrincipalName || "").toLowerCase();

      return {
        connected: true,
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
        provider: "outlook",
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      return {
        connected: false,
        staffEmail: staffEmail.toLowerCase(),
        provider: "outlook",
        reason: message.includes("token refresh failed") ? "not_configured" : "service_error",
      };
    }
  }

  async listFolders(): Promise<NormalizedFolder[]> {
    const client = await this.getClient();

    const wellKnownPromises = WELL_KNOWN_FOLDERS.map((name) =>
      client
        .api(`/me/mailFolders/${name}`)
        .select("id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount")
        .get()
        .then((f: Record<string, unknown>) => this.normalizeFolder(f, name))
        .catch(() => null)
    );

    const allFoldersPromise = client
      .api("/me/mailFolders")
      .top(100)
      .select("id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount")
      .get();

    const [wellKnownResults, allFoldersResult] = await Promise.all([
      Promise.all(wellKnownPromises),
      allFoldersPromise,
    ]);

    const wellKnown = wellKnownResults.filter(Boolean) as NormalizedFolder[];
    const wellKnownIds = new Set(wellKnown.map((f) => f.id));

    const allFolders: Record<string, unknown>[] = allFoldersResult.value || [];
    const customFolders = allFolders
      .filter((f) => !wellKnownIds.has(f.id as string))
      .map((f) => this.normalizeFolder(f));

    const childFolderPromises: Promise<NormalizedFolder[]>[] = [];
    for (const folder of customFolders) {
      if (folder.childFolderCount > 0) {
        childFolderPromises.push(
          client
            .api(`/me/mailFolders/${folder.id}/childFolders`)
            .top(50)
            .select("id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount")
            .get()
            .then((r: { value?: Record<string, unknown>[] }) =>
              (r.value || []).map((f) => this.normalizeFolder(f))
            )
            .catch(() => [] as NormalizedFolder[])
        );
      }
    }

    const childResults = await Promise.all(childFolderPromises);
    return [...wellKnown, ...customFolders, ...childResults.flat()];
  }

  async listMessages(folderId: string): Promise<NormalizedMessage[]> {
    const client = await this.getClient();
    const messages = await client
      .api(`/me/mailFolders/${folderId}/messages`)
      .top(50)
      .orderby("receivedDateTime DESC")
      .select(
        "id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,hasAttachments,importance,body,isDraft,parentFolderId"
      )
      .get();
    return ((messages.value || []) as Record<string, unknown>[]).map((m) => this.normalizeMessage(m));
  }

  async getMessage(messageId: string): Promise<NormalizedMessage> {
    const client = await this.getClient();
    const message = await client
      .api(`/me/messages/${messageId}`)
      .select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments,importance")
      .get();
    return this.normalizeMessage(message);
  }

  async sendMessage(params: SendMessageParams): Promise<void> {
    const client = await this.getClient();
    const message = {
      subject: params.subject,
      body: { contentType: "HTML", content: params.body },
      toRecipients: params.toRecipients.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: (params.ccRecipients || []).map((email) => ({
        emailAddress: { address: email },
      })),
    };
    await client.api("/me/sendMail").post({ message, saveToSentItems: true });
  }

  async replyToMessage(messageId: string, comment: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/messages/${messageId}/reply`).post({ comment });
  }

  async markAsRead(messageId: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/messages/${messageId}`).patch({ isRead: true });
  }

  async deleteMessage(messageId: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/messages/${messageId}`).delete();
  }

  async moveMessage(messageId: string, destinationId: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/messages/${messageId}/move`).post({ destinationId });
  }

  async listEvents(start: string, end: string, timeZone: string): Promise<NormalizedEvent[]> {
    const client = await this.getClient();
    const events = await client
      .api("/me/calendarview")
      .query({ startDateTime: start, endDateTime: end })
      .header("Prefer", `outlook.timezone="${timeZone}"`)
      .top(100)
      .orderby("start/dateTime")
      .select(
        "id,subject,start,end,location,bodyPreview,organizer,isAllDay,showAs,importance,attendees,body,onlineMeeting,onlineMeetingUrl"
      )
      .get();
    return ((events.value || []) as Record<string, unknown>[]).map((e) => this.normalizeEvent(e));
  }

  async getEvent(eventId: string): Promise<NormalizedEvent> {
    const client = await this.getClient();
    const event = await client.api(`/me/events/${eventId}`).get();
    return this.normalizeEvent(event);
  }

  async createEvent(params: CreateEventParams): Promise<NormalizedEvent> {
    const client = await this.getClient();
    const event: Record<string, unknown> = {
      subject: params.subject,
      start: { dateTime: params.start, timeZone: params.timeZone },
      end: { dateTime: params.end, timeZone: params.timeZone },
      isAllDay: params.isAllDay || false,
    };
    if (params.isOnlineMeeting) {
      event.isOnlineMeeting = true;
      event.onlineMeetingProvider = "teamsForBusiness";
    }
    if (params.location) event.location = { displayName: params.location };
    if (params.body) event.body = { contentType: "HTML", content: params.body };
    if (params.attendees?.length) {
      event.attendees = params.attendees.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      }));
    }
    const created = await client.api("/me/events").post(event);
    return this.normalizeEvent(created);
  }

  async updateEvent(eventId: string, params: UpdateEventParams): Promise<NormalizedEvent> {
    const client = await this.getClient();
    const update: Record<string, unknown> = {};
    if (params.subject) update.subject = params.subject;
    if (params.start) update.start = { dateTime: params.start, timeZone: params.timeZone || "UTC" };
    if (params.end) update.end = { dateTime: params.end, timeZone: params.timeZone || "UTC" };
    if (params.location) update.location = { displayName: params.location };
    if (params.body) update.body = { contentType: "HTML", content: params.body };
    const updated = await client.api(`/me/events/${eventId}`).patch(update);
    return this.normalizeEvent(updated);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const client = await this.getClient();
    await client.api(`/me/events/${eventId}`).delete();
  }

  private normalizeFolder(f: Record<string, unknown>, wellKnownName?: string): NormalizedFolder {
    return {
      id: f.id as string,
      displayName: f.displayName as string,
      parentFolderId: (f.parentFolderId as string) || null,
      childFolderCount: (f.childFolderCount as number) || 0,
      totalItemCount: (f.totalItemCount as number) || 0,
      unreadItemCount: (f.unreadItemCount as number) || 0,
      wellKnownName,
    };
  }

  private normalizeMessage(m: Record<string, unknown>): NormalizedMessage {
    const from = m.from as { emailAddress?: { name?: string; address?: string } } | undefined;
    const toRecipients = m.toRecipients as { emailAddress?: { name?: string; address?: string } }[] | undefined;
    const ccRecipients = m.ccRecipients as { emailAddress?: { name?: string; address?: string } }[] | undefined;
    const body = m.body as { content?: string; contentType?: string } | undefined;

    return {
      id: m.id as string,
      subject: (m.subject as string) || "",
      from: {
        name: from?.emailAddress?.name || "",
        address: from?.emailAddress?.address || "",
      },
      toRecipients: (toRecipients || []).map((r) => ({
        name: r.emailAddress?.name || "",
        address: r.emailAddress?.address || "",
      })),
      ccRecipients: ccRecipients
        ? ccRecipients.map((r) => ({
            name: r.emailAddress?.name || "",
            address: r.emailAddress?.address || "",
          }))
        : undefined,
      receivedDateTime: m.receivedDateTime as string | undefined,
      sentDateTime: m.sentDateTime as string | undefined,
      bodyPreview: (m.bodyPreview as string) || "",
      body: body
        ? { content: body.content || "", contentType: body.contentType || "text" }
        : undefined,
      isRead: (m.isRead as boolean) || false,
      hasAttachments: (m.hasAttachments as boolean) || false,
      importance: (m.importance as string) || "normal",
      isDraft: m.isDraft as boolean | undefined,
      parentFolderId: m.parentFolderId as string | undefined,
    };
  }

  private normalizeEvent(e: Record<string, unknown>): NormalizedEvent {
    const start = e.start as { dateTime?: string; timeZone?: string } | undefined;
    const end = e.end as { dateTime?: string; timeZone?: string } | undefined;
    const location = e.location as { displayName?: string } | undefined;
    const organizer = e.organizer as { emailAddress?: { name?: string; address?: string } } | undefined;
    const attendees = e.attendees as { emailAddress?: { name?: string; address?: string }; type?: string }[] | undefined;
    const body = e.body as { content?: string; contentType?: string } | undefined;

    return {
      id: e.id as string,
      subject: (e.subject as string) || "",
      start: {
        dateTime: start?.dateTime || "",
        timeZone: start?.timeZone || "UTC",
      },
      end: {
        dateTime: end?.dateTime || "",
        timeZone: end?.timeZone || "UTC",
      },
      location: location?.displayName ? { displayName: location.displayName } : undefined,
      bodyPreview: e.bodyPreview as string | undefined,
      body: body
        ? { content: body.content || "", contentType: body.contentType || "text" }
        : undefined,
      organizer: organizer?.emailAddress
        ? { name: organizer.emailAddress.name || "", address: organizer.emailAddress.address || "" }
        : undefined,
      isAllDay: (e.isAllDay as boolean) || false,
      showAs: (e.showAs as string) || "busy",
      importance: (e.importance as string) || "normal",
      attendees: attendees
        ? attendees.map((a) => ({
            name: a.emailAddress?.name || "",
            address: a.emailAddress?.address || "",
            type: a.type || "required",
          }))
        : undefined,
      onlineMeetingUrl: (e.onlineMeetingUrl as string) || undefined,
    };
  }
}

export function getMicrosoftRedirectUri(): string {
  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain) {
    return `https://${customDomain}/api/crm/email/auth/microsoft/callback`;
  }
  // Local development fallback — CUSTOM_DOMAIN must be set in all deployed environments
  return `http://localhost:8080/api/crm/email/auth/microsoft/callback`;
}

export function getMicrosoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is required for Microsoft OAuth");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getMicrosoftRedirectUri(),
    scope: MICROSOFT_SCOPES,
    state,
    response_mode: "query",
    prompt: "consent",
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: getMicrosoftRedirectUri(),
    scope: MICROSOFT_SCOPES,
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft token exchange failed: ${errText}`);
  }

  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Failed to obtain Microsoft tokens");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
