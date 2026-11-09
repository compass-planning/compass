import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { createEmailProvider } from "./factory";
import {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
} from "./providers/outlook";
import { getGmailAuthUrl, exchangeGmailCode, revokeGoogleToken } from "./providers/gmail";
import { testImapConnection, type ImapSmtpConfig } from "./providers/imap-smtp";
import { lookupKnownServer, getAllKnownDomains } from "./known-servers";
import { z } from "zod";
import {
  CalendarNotAvailableError,
  type EmailProvider,
  type OutgoingAttachment,
  type NormalizedMessage,
} from "./provider";
import { logEmailAudit, type EmailAuditAction } from "./audit";

interface SessionUser {
  id: number;
  email: string;
  type: "staff" | "host";
  emailSetupSkipped: boolean;
  companyId: number | null;
}

async function getStaffFromSession(req: { session?: { staffId?: number } }) {
  const staffId = req.session?.staffId;
  if (!staffId) return null;
  return (await storage.getStaffMember(staffId)) || null;
}

async function getUserFromSession(req: {
  session?: { staffId?: number; hostUserId?: number; userType?: string };
}): Promise<SessionUser | null> {
  if (req.session?.userType === "host" && req.session?.hostUserId) {
    const hostUser = await storage.getHostUser(req.session.hostUserId);
    if (!hostUser || !hostUser.isActive) return null;
    return {
      id: hostUser.id,
      email: hostUser.email,
      type: "host",
      emailSetupSkipped: hostUser.emailSetupSkipped,
      companyId: null,
    };
  }
  const staffId = req.session?.staffId;
  if (staffId) {
    const member = await storage.getStaffMember(staffId);
    if (!member) return null;
    return {
      id: member.id,
      email: member.email,
      type: "staff",
      emailSetupSkipped: member.emailSetupSkipped ?? false,
      companyId: member.companyId ?? null,
    };
  }
  return null;
}

async function getEmailConfigForUser(user: SessionUser) {
  if (user.type === "host") {
    return await storage.getEmailConfigurationForHost(user.id);
  }
  return await storage.getEmailConfiguration(user.id);
}

async function getProviderForUser(
  user: SessionUser,
): Promise<{ provider: EmailProvider; userEmail: string; providerType: string } | null> {
  const config = await getEmailConfigForUser(user);
  if (!config || !config.isActive) return null;
  const provider = createEmailProvider(config);
  return { provider, userEmail: user.email, providerType: config.provider };
}

// ── Shared helpers for compose / forward / attachments ──────────────────────────
const MAX_ATTACHMENT_BYTES_TOTAL = 25 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const emailList = z.array(z.string().trim().email()).max(100);
const attachmentInput = z.object({
  name: z.string().min(1).max(255),
  contentType: z.string().max(150).default("application/octet-stream"),
  contentBase64: z.string().min(1),
});
const bodyFormat = z.enum(["text", "html"]).default("html");

function decodeAttachments(list: z.infer<typeof attachmentInput>[] | undefined): OutgoingAttachment[] {
  const out = (list || []).map((a) => ({
    // strip path separators and control characters from names
    name: a.name.replace(/[\\/\u0000-\u001f]/g, "_").trim() || "attachment",
    contentType: /^[\w.+-]+\/[\w.+-]+$/.test(a.contentType) ? a.contentType : "application/octet-stream",
    content: Buffer.from(a.contentBase64, "base64"),
  }));
  const total = out.reduce((n, a) => n + a.content.length, 0);
  if (total > MAX_ATTACHMENT_BYTES_TOTAL) {
    throw new z.ZodError([{ code: "custom", path: ["attachments"], message: "Attachments are larger than 25 MB in total" }]);
  }
  return out;
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain-text compose bodies are escaped and converted to HTML so users can't inject markup by accident. */
function toHtml(body: string, format: "text" | "html"): string {
  return format === "html" ? body : `<div style="white-space:pre-wrap;font-family:inherit">${escapeHtml(body)}</div>`;
}

function auditFrom(req: Record<string, unknown>) {
  const user = req.emailUser as SessionUser | undefined;
  const providerType = req.emailProviderType as string | undefined;
  const ip = ((req as { ip?: string }).ip) || null;
  return (action: EmailAuditAction, targetId?: string | null, detail?: Record<string, unknown>) => {
    if (!user) return;
    void logEmailAudit({
      companyId: user.companyId,
      actorType: user.type,
      actorId: user.id,
      action,
      provider: providerType ?? null,
      targetId: targetId ?? null,
      detail,
      ip,
    });
  };
}

function formatAddr(a?: { name?: string; address?: string }): string {
  if (!a) return "";
  return a.name ? `${escapeHtml(a.name)} &lt;${escapeHtml(a.address || "")}&gt;` : escapeHtml(a.address || "");
}

function buildForwardHtml(orig: NormalizedMessage, comment: string): string {
  const list = (r?: { name?: string; address?: string }[]) => (r || []).map(formatAddr).join(", ");
  const when = orig.sentDateTime || orig.receivedDateTime;
  const header = [
    `<b>From:</b> ${formatAddr(orig.from)}`,
    when ? `<b>Date:</b> ${escapeHtml(new Date(when).toUTCString())}` : "",
    `<b>Subject:</b> ${escapeHtml(orig.subject || "")}`,
    `<b>To:</b> ${list(orig.toRecipients)}`,
    orig.ccRecipients?.length ? `<b>Cc:</b> ${list(orig.ccRecipients)}` : "",
  ].filter(Boolean).join("<br>");
  const origBody = orig.body
    ? orig.body.contentType === "html"
      ? orig.body.content
      : `<div style="white-space:pre-wrap">${escapeHtml(orig.body.content)}</div>`
    : "";
  return `${comment}<br><br><div style="border-left:2px solid #ccc;padding-left:10px;margin-left:2px"><div>---------- Forwarded message ----------<br>${header}</div><br>${origBody}</div>`;
}

const INLINE_SAFE = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp))$/i;

export function registerEmailRoutes(app: Express) {
  app.get(
    "/api/email/auth/microsoft",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (
          !process.env.MICROSOFT_CLIENT_ID ||
          !process.env.MICROSOFT_CLIENT_SECRET
        ) {
          return res
            .status(500)
            .json({
              message:
                "Microsoft OAuth is not configured. MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required.",
            });
        }
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const state = crypto.randomBytes(32).toString("hex");
        (req.session as Record<string, unknown>).microsoftOAuthState = state;

        const url = getMicrosoftAuthUrl(state);
        res.redirect(url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(500)
          .json({ message: `Failed to initiate Microsoft auth: ${message}` });
      }
    },
  );

  app.get(
    "/api/email/auth/microsoft/callback",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        const redirectBase = user?.type === "host" ? "/crm/host/inbox" : "/crm/email";
        if (!user)
          return res.redirect(`${redirectBase}?error=not_authenticated`);

        const code = req.query.code as string | undefined;
        const returnedState = req.query.state as string | undefined;
        const savedState = (req.session as Record<string, unknown>)
          .microsoftOAuthState as string | undefined;

        if (!code) {
          const providerError = req.query.error as string | undefined;
          if (providerError) {
            const desc = String(req.query.error_description || providerError).slice(0, 180);
            console.error("[email] OAuth provider returned an error:", providerError, desc);
            return res.redirect(`${redirectBase}?error=oauth_denied&detail=${encodeURIComponent(desc)}`);
          }
          return res.redirect(`${redirectBase}?error=no_code`);
        }

        if (!returnedState || returnedState !== savedState) {
          return res.redirect(`${redirectBase}?error=invalid_state`);
        }

        delete (req.session as Record<string, unknown>).microsoftOAuthState;

        const tokens = await exchangeMicrosoftCode(code);

        const existingConfig = await getEmailConfigForUser(user);
        if (existingConfig) {
          await storage.updateEmailConfiguration(existingConfig.id, {
            provider: "outlook",
            config: tokens,
            isActive: true,
          });
        } else {
          const configData: Record<string, unknown> = {
            provider: "outlook",
            config: tokens,
            isActive: true,
          };
          if (user.type === "host") configData.hostUserId = user.id;
          else configData.staffId = user.id;
          await storage.createEmailConfiguration(
            configData as Parameters<
              typeof storage.createEmailConfiguration
            >[0],
          );
        }

        res.redirect(redirectBase);
      } catch (err: unknown) {
        console.error(
          "Microsoft OAuth callback error:",
          err instanceof Error ? err.message : err,
        );
        const isHost =
          (req.session as Record<string, unknown>).userType === "host";
        res.redirect(
          `${isHost ? "/crm/host/inbox" : "/crm/email"}?error=microsoft_auth_failed`,
        );
      }
    },
  );

  app.get(
    "/api/email/status",
    isAuthenticated,
    async (
      req: {
        session?: { staffId?: number; hostUserId?: number; userType?: string };
      },
      res,
    ) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const config = await getEmailConfigForUser(user);

        if (!config || !config.isActive) {
          return res.json({
            connected: false,
            staffEmail: user.email,
            reason: "no_provider" as const,
          });
        }

        let provider: EmailProvider;
        try {
          provider = createEmailProvider(config);
        } catch (e) {
          console.error("[email] could not open stored email configuration:", e instanceof Error ? e.message : e);
          return res.json({
            connected: false,
            staffEmail: user.email,
            reason: "no_provider" as const,
          });
        }
        const status = await provider.getStatus(user.email);
        res.json(status);
      } catch (e) {
        console.error("[email] status check failed:", e instanceof Error ? e.message : e);
        res.json({ connected: false, reason: "service_error" as const });
      }
    },
  );

  app.get(
    "/api/email/auth/gmail",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (
          !process.env.GOOGLE_CLIENT_ID ||
          !process.env.GOOGLE_CLIENT_SECRET
        ) {
          return res
            .status(500)
            .json({
              message:
                "Google OAuth is not configured. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.",
            });
        }
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const state = crypto.randomBytes(32).toString("hex");
        (req.session as Record<string, unknown>).gmailOAuthState = state;

        const url = getGmailAuthUrl(state);
        res.redirect(url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(500)
          .json({ message: `Failed to initiate Gmail auth: ${message}` });
      }
    },
  );

  app.get(
    "/api/email/auth/gmail/callback",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        const redirectBase = user?.type === "host" ? "/crm/host/inbox" : "/crm/email";
        if (!user)
          return res.redirect(`${redirectBase}?error=not_authenticated`);

        const code = req.query.code as string | undefined;
        const returnedState = req.query.state as string | undefined;
        const savedState = (req.session as Record<string, unknown>)
          .gmailOAuthState as string | undefined;

        if (!code) {
          const providerError = req.query.error as string | undefined;
          if (providerError) {
            const desc = String(req.query.error_description || providerError).slice(0, 180);
            console.error("[email] OAuth provider returned an error:", providerError, desc);
            return res.redirect(`${redirectBase}?error=oauth_denied&detail=${encodeURIComponent(desc)}`);
          }
          return res.redirect(`${redirectBase}?error=no_code`);
        }

        if (!returnedState || returnedState !== savedState) {
          return res.redirect(`${redirectBase}?error=invalid_state`);
        }

        delete (req.session as Record<string, unknown>).gmailOAuthState;

        const tokens = await exchangeGmailCode(code);

        const existingConfig = await getEmailConfigForUser(user);
        if (existingConfig) {
          await storage.updateEmailConfiguration(existingConfig.id, {
            provider: "gmail",
            config: tokens,
            isActive: true,
          });
        } else {
          const configData: Record<string, unknown> = {
            provider: "gmail",
            config: tokens,
            isActive: true,
          };
          if (user.type === "host") configData.hostUserId = user.id;
          else configData.staffId = user.id;
          await storage.createEmailConfiguration(
            configData as Parameters<
              typeof storage.createEmailConfiguration
            >[0],
          );
        }

        res.redirect(redirectBase);
      } catch (err: unknown) {
        console.error(
          "Gmail OAuth callback error:",
          err instanceof Error ? err.message : err,
        );
        const isHost =
          (req.session as Record<string, unknown>).userType === "host";
        res.redirect(
          `${isHost ? "/crm/host/inbox" : "/crm/email"}?error=gmail_auth_failed`,
        );
      }
    },
  );

  app.post(
    "/api/email/test-imap",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const input = z
          .object({
            imapHost: z.string().min(1),
            imapPort: z.coerce.number().int().min(1).max(65535),
            imapSecure: z.boolean(),
            smtpHost: z.string().min(1),
            smtpPort: z.coerce.number().int().min(1).max(65535),
            smtpSecure: z.boolean(),
            email: z.string().email(),
            password: z.string().min(1),
          })
          .parse(req.body);

        const result = await testImapConnection(input as ImapSmtpConfig);
        res.json(result);
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ message: `Test failed: ${message}` });
      }
    },
  );

  app.post(
    "/api/email/setup-imap",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const input = z
          .object({
            imapHost: z.string().min(1),
            imapPort: z.coerce.number().int().min(1).max(65535),
            imapSecure: z.boolean(),
            smtpHost: z.string().min(1),
            smtpPort: z.coerce.number().int().min(1).max(65535),
            smtpSecure: z.boolean(),
            email: z.string().email(),
            password: z.string().min(1),
          })
          .parse(req.body);

        const testResult = await testImapConnection(input as ImapSmtpConfig);
        if (!testResult.success) {
          return res
            .status(400)
            .json({ message: testResult.error || "Connection test failed" });
        }

        const existingConfig = await getEmailConfigForUser(user);
        if (existingConfig) {
          await storage.updateEmailConfiguration(existingConfig.id, {
            provider: "imap_smtp",
            config: input,
            isActive: true,
          });
        } else {
          const configData: Record<string, unknown> = {
            provider: "imap_smtp",
            config: input,
            isActive: true,
          };
          if (user.type === "host") configData.hostUserId = user.id;
          else configData.staffId = user.id;
          await storage.createEmailConfiguration(
            configData as Parameters<
              typeof storage.createEmailConfiguration
            >[0],
          );
        }

        res.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ message: `Setup failed: ${message}` });
      }
    },
  );

  app.get(
    "/api/email/known-servers",
    isAuthenticated,
    async (_req: Request, res: Response) => {
      res.json({ domains: getAllKnownDomains() });
    },
  );

  app.get(
    "/api/email/known-servers/:domain",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const domain = req.params.domain;
      const config = lookupKnownServer(domain);
      if (!config) {
        return res
          .status(404)
          .json({ message: "No known server settings for this domain" });
      }
      res.json(config);
    },
  );

  app.get(
    "/api/email/config",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const config = await getEmailConfigForUser(user);
        res.json({
          hasConfig: !!config,
          isActive: config?.isActive ?? false,
          provider: config?.provider ?? null,
          emailSetupSkipped: user.emailSetupSkipped,
          staffEmail: user.email,
        });
      } catch {
        res.status(500).json({ message: "Failed to fetch email config" });
      }
    },
  );

  app.get(
    "/api/email/config/:staffId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const caller = await getStaffFromSession(req);
        if (!caller)
          return res.status(403).json({ message: "Staff account required" });

        const adminRoles = ["general_manager", "office_admin"];
        if (!adminRoles.includes(caller.role)) {
          return res.status(403).json({ message: "Admin role required" });
        }

        const staffId = Number(req.params.staffId);
        if (isNaN(staffId))
          return res.status(400).json({ message: "Invalid staff ID" });

        const targetStaff = await storage.getStaffMember(staffId);
        if (!targetStaff || targetStaff.companyId !== caller.companyId) {
          return res.status(404).json({ message: "Staff member not found" });
        }

        const config = await storage.getEmailConfiguration(staffId);

        res.json({
          hasConfig: !!config,
          isActive: config?.isActive ?? false,
          provider: config?.provider ?? null,
        });
      } catch {
        res.status(500).json({ message: "Failed to fetch email config" });
      }
    },
  );

  app.post(
    "/api/email/skip-setup",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        if (user.type === "host") {
          await storage.updateHostUser(user.id, { emailSetupSkipped: true });
        } else {
          await storage.updateStaffMember(user.id, { emailSetupSkipped: true });
        }
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to skip email setup" });
      }
    },
  );

  app.delete(
    "/api/email/disconnect",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await getUserFromSession(req);
        if (!user) return res.status(403).json({ message: "Account required" });

        const config = await getEmailConfigForUser(user);
        if (config) {
          // Best-effort revoke at the provider, then wipe every stored credential.
          if (config.provider === "gmail") {
            const c = (config.config || {}) as { accessToken?: string; refreshToken?: string };
            await revokeGoogleToken(c.refreshToken || c.accessToken).catch(() => {});
          }
          await storage.updateEmailConfiguration(config.id, {
            isActive: false,
            config: {},
          });
          void logEmailAudit({
            companyId: user.companyId,
            actorType: user.type,
            actorId: user.id,
            action: "account.disconnect",
            provider: config.provider,
            ip: req.ip || null,
          });
        }

        res.status(204).send();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ message: `Disconnect failed: ${message}` });
      }
    },
  );

  const requireEmailProvider = async (
    req: {
      session?: { staffId?: number; hostUserId?: number; userType?: string };
    } & Record<string, unknown>,
    res: { status: (code: number) => { json: (data: unknown) => void } },
    next: () => void,
  ) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(403).json({ message: "Not authenticated" });

      const result = await getProviderForUser(user);
      if (!result) {
        return res
          .status(403)
          .json({ message: "Email not configured for your account" });
      }

      const status = await result.provider.getStatus(result.userEmail);
      if (!status.connected) {
        return res.status(403).json({ message: "Email account not connected" });
      }

      (req as Record<string, unknown>).emailProvider = result.provider;
      (req as Record<string, unknown>).emailUser = user;
      (req as Record<string, unknown>).emailProviderType = result.providerType;
      next();
    } catch {
      return res.status(502).json({ message: "Email provider unavailable" });
    }
  };

  app.get(
    "/api/email/folders",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const folders = await provider.listFolders();
        res.json(folders);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Email folders error:", message);
        res
          .status(502)
          .json({ message: "Failed to fetch folders", error: message });
      }
    },
  );

  app.get(
    "/api/email/folders/:folderId/messages",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const folderId = (req as { params: { folderId: string } }).params
          .folderId;
        const messages = await provider.listMessages(folderId);
        res.json(messages);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Email messages error:", message);
        res
          .status(502)
          .json({ message: "Failed to fetch messages", error: message });
      }
    },
  );

  app.get(
    "/api/email/messages/:id",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        const message = await provider.getMessage(id);
        auditFrom(req)("message.view", id);
        res.json(message);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to fetch message", error: message });
      }
    },
  );

  app.post(
    "/api/email/messages/send",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const input = z
          .object({
            subject: z.string().min(1).max(998),
            body: z.string().min(1),
            bodyFormat,
            toRecipients: emailList.min(1),
            ccRecipients: emailList.optional(),
            bccRecipients: emailList.optional(),
            attachments: z.array(attachmentInput).max(MAX_ATTACHMENT_COUNT).optional(),
          })
          .parse((req as { body: unknown }).body);

        const provider = req.emailProvider as EmailProvider;
        const attachments = decodeAttachments(input.attachments);
        await provider.sendMessage({
          subject: input.subject,
          body: toHtml(input.body, input.bodyFormat),
          toRecipients: input.toRecipients,
          ccRecipients: input.ccRecipients,
          bccRecipients: input.bccRecipients,
          attachments,
        });
        auditFrom(req)("message.send", null, {
          to: input.toRecipients.length,
          cc: input.ccRecipients?.length || 0,
          bcc: input.bccRecipients?.length || 0,
          attachments: attachments.length,
        });
        res.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to send email", error: message });
      }
    },
  );

  app.post(
    "/api/email/messages/:id/reply",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const input = z
          .object({
            comment: z.string().min(1),
            bodyFormat,
            ccRecipients: emailList.optional(),
            bccRecipients: emailList.optional(),
            attachments: z.array(attachmentInput).max(MAX_ATTACHMENT_COUNT).optional(),
          })
          .parse((req as { body: unknown }).body);

        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        const attachments = decodeAttachments(input.attachments);
        await provider.replyToMessage(id, toHtml(input.comment, input.bodyFormat), {
          ccRecipients: input.ccRecipients,
          bccRecipients: input.bccRecipients,
          attachments,
        });
        auditFrom(req)("message.reply", id, {
          cc: input.ccRecipients?.length || 0,
          bcc: input.bccRecipients?.length || 0,
          attachments: attachments.length,
        });
        res.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(502).json({ message: "Failed to reply", error: message });
      }
    },
  );

  app.get(
    "/api/email/messages/:id/attachments",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        res.json(await provider.listAttachments(id));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(502).json({ message: "Failed to list attachments", error: message });
      }
    },
  );

  app.get(
    "/api/email/messages/:id/attachments/:attId",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const { id, attId } = (req as { params: { id: string; attId: string } }).params;
        const wantInline = (req as { query: { disposition?: string } }).query.disposition === "inline";
        const { meta, content } = await provider.getAttachment(id, attId);
        auditFrom(req)("attachment.download", id, {
          attachmentId: attId,
          name: meta.name,
          size: content.length,
          contentType: meta.contentType,
          disposition: wantInline ? "inline" : "attachment",
        });
        // Only PDFs and raster images may render in the browser; everything else is forced to download.
        const inline = wantInline && INLINE_SAFE.test(meta.contentType);
        const safeName = meta.name.replace(/[\r\n"\\]/g, "_");
        const r = res as unknown as Response;
        r.setHeader("Content-Type", inline ? meta.contentType : "application/octet-stream");
        r.setHeader(
          "Content-Disposition",
          `${inline ? "inline" : "attachment"}; filename="${safeName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        );
        r.setHeader("X-Content-Type-Options", "nosniff");
        // The CSP sandbox is skipped for PDFs because Chrome's built-in PDF viewer won't load inside one.
        if (!(inline && /pdf/i.test(meta.contentType))) r.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
        r.setHeader("Cache-Control", "no-store, private");
        r.setHeader("Content-Length", String(content.length));
        r.end(content);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(502).json({ message: "Failed to download attachment", error: message });
      }
    },
  );

  app.post(
    "/api/email/messages/:id/forward",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const input = z
          .object({
            comment: z.string().default(""),
            bodyFormat,
            toRecipients: emailList.min(1),
            ccRecipients: emailList.optional(),
            bccRecipients: emailList.optional(),
            includeAttachments: z.boolean().default(true),
            attachments: z.array(attachmentInput).max(MAX_ATTACHMENT_COUNT).optional(),
          })
          .parse((req as { body: unknown }).body);

        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        const orig = await provider.getMessage(id);

        const outgoing = decodeAttachments(input.attachments);
        let carried = 0;
        if (input.includeAttachments) {
          const metas = (await provider.listAttachments(id)).filter((a) => !a.isInline);
          let total = outgoing.reduce((n, a) => n + a.content.length, 0);
          for (const m of metas) {
            total += m.size;
            if (total > MAX_ATTACHMENT_BYTES_TOTAL) {
              return res.status(400).json({ message: "Original attachments plus new files exceed 25 MB" });
            }
          }
          for (const m of metas) {
            const got = await provider.getAttachment(id, m.id);
            outgoing.push({ name: got.meta.name, contentType: got.meta.contentType, content: got.content });
            carried++;
          }
        }

        const subject = /^(fwd?|fw):/i.test(orig.subject) ? orig.subject : `Fwd: ${orig.subject}`;
        await provider.sendMessage({
          subject,
          body: buildForwardHtml(orig, toHtml(input.comment, input.bodyFormat)),
          toRecipients: input.toRecipients,
          ccRecipients: input.ccRecipients,
          bccRecipients: input.bccRecipients,
          attachments: outgoing,
        });
        auditFrom(req)("message.forward", id, {
          to: input.toRecipients.length,
          cc: input.ccRecipients?.length || 0,
          bcc: input.bccRecipients?.length || 0,
          attachments: outgoing.length,
          carriedOriginalAttachments: carried,
        });
        res.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(502).json({ message: "Failed to forward", error: message });
      }
    },
  );

  app.patch(
    "/api/email/messages/:id/read",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        await provider.markAsRead(id);
        res.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to mark as read", error: message });
      }
    },
  );

  app.delete(
    "/api/email/messages/:id",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        await provider.deleteMessage(id);
        auditFrom(req)("message.delete", id);
        res.status(204).send();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to delete message", error: message });
      }
    },
  );

  app.post(
    "/api/email/messages/:id/move",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const input = z
          .object({
            destinationId: z.string().min(1),
          })
          .parse((req as { body: unknown }).body);

        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        await provider.moveMessage(id, input.destinationId);
        res.json({ success: true });
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to move message", error: message });
      }
    },
  );

  app.get(
    "/api/calendar/events",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const query = (req as { query: Record<string, string> }).query;
        const start = query.start || new Date().toISOString();
        const end =
          query.end ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const timeZone = query.timeZone || "UTC";

        const provider = req.emailProvider as EmailProvider;
        if (provider.calendarAvailable === false) {
          return res.json({
            events: [],
            calendarAvailable: false,
            message: "Calendar is not available for IMAP/SMTP accounts",
          });
        }
        const events = await provider.listEvents(start, end, timeZone);
        res.json(events);
      } catch (err: unknown) {
        if (err instanceof CalendarNotAvailableError) {
          return res.json({
            events: [],
            calendarAvailable: false,
            message: err.message,
          });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Calendar events error:", message);
        res
          .status(502)
          .json({ message: "Failed to fetch events", error: message });
      }
    },
  );

  app.get(
    "/api/calendar/events/:id",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        const id = (req as { params: { id: string } }).params.id;
        const event = await provider.getEvent(id);
        res.json(event);
      } catch (err: unknown) {
        if (err instanceof CalendarNotAvailableError) {
          return res
            .status(400)
            .json({ message: err.message, calendarAvailable: false });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to fetch event", error: message });
      }
    },
  );

  app.post(
    "/api/calendar/events",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        if (provider.calendarAvailable === false) {
          return res
            .status(400)
            .json({
              message: "Calendar is not available for IMAP/SMTP accounts",
              calendarAvailable: false,
            });
        }

        const input = z
          .object({
            subject: z.string().min(1),
            start: z.string(),
            end: z.string(),
            timeZone: z.string().default("UTC"),
            location: z.string().optional(),
            body: z.string().optional(),
            isAllDay: z.boolean().optional(),
            attendees: z.array(z.string().email()).optional(),
            clientId: z.coerce.number().optional().nullable(),
            isOnlineMeeting: z.boolean().optional(),
          })
          .parse((req as { body: unknown }).body);

        const created = await provider.createEvent({
          subject: input.subject,
          start: input.start,
          end: input.end,
          timeZone: input.timeZone,
          location: input.location,
          body: input.body,
          isAllDay: input.isAllDay,
          attendees: input.attendees,
          isOnlineMeeting: input.isOnlineMeeting,
        });

        if (input.clientId) {
          const staff = await getStaffFromSession(
            req as { session?: { staffId?: number } },
          );
          if (staff) {
            const linkedClient = await storage.getClient(input.clientId);
            if (linkedClient && linkedClient.companyId === staff.companyId) {
              const descParts: string[] = [];
              if (input.body) descParts.push(input.body);
              if (input.location) descParts.push(`Location: ${input.location}`);
              if (created.onlineMeetingUrl)
                descParts.push(`Teams Meeting: ${created.onlineMeetingUrl}`);
              await storage.createActivity({
                clientId: input.clientId,
                activityType: "appointment",
                title: `Calendar event: ${input.subject}`,
                description: descParts.length > 0 ? descParts.join("\n") : null,
                date: new Date(input.start),
                duration: null,
                staffId: staff.id,
              });
            }
          }
        }

        res.status(201).json(created);
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        if (err instanceof CalendarNotAvailableError) {
          return res
            .status(400)
            .json({ message: err.message, calendarAvailable: false });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to create event", error: message });
      }
    },
  );

  app.patch(
    "/api/calendar/events/:id",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        if (provider.calendarAvailable === false) {
          return res
            .status(400)
            .json({
              message: "Calendar is not available for IMAP/SMTP accounts",
              calendarAvailable: false,
            });
        }

        const input = z
          .object({
            subject: z.string().optional(),
            start: z.string().optional(),
            end: z.string().optional(),
            timeZone: z.string().optional(),
            location: z.string().optional(),
            body: z.string().optional(),
          })
          .parse((req as { body: unknown }).body);

        const id = (req as { params: { id: string } }).params.id;
        const updated = await provider.updateEvent(id, input);
        res.json(updated);
      } catch (err: unknown) {
        if (err instanceof CalendarNotAvailableError) {
          return res
            .status(400)
            .json({ message: err.message, calendarAvailable: false });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to update event", error: message });
      }
    },
  );

  app.delete(
    "/api/calendar/events/:id",
    isAuthenticated,
    requireEmailProvider,
    async (req: Record<string, unknown>, res) => {
      try {
        const provider = req.emailProvider as EmailProvider;
        if (provider.calendarAvailable === false) {
          return res
            .status(400)
            .json({
              message: "Calendar is not available for IMAP/SMTP accounts",
              calendarAvailable: false,
            });
        }
        const id = (req as { params: { id: string } }).params.id;
        await provider.deleteEvent(id);
        res.status(204).send();
      } catch (err: unknown) {
        if (err instanceof CalendarNotAvailableError) {
          return res
            .status(400)
            .json({ message: err.message, calendarAvailable: false });
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(502)
          .json({ message: "Failed to delete event", error: message });
      }
    },
  );
}
