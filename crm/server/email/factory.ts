import type { EmailProvider } from "./provider";
import type { EmailConfiguration } from "@shared/schema";
import { OutlookEmailProvider } from "./providers/outlook";
import { GmailEmailProvider } from "./providers/gmail";
import { ImapSmtpEmailProvider } from "./providers/imap-smtp";
import { storage } from "../storage";

export function createEmailProvider(config: EmailConfiguration): EmailProvider {
  const providerConfig = (config.config || {}) as Record<string, unknown>;

  switch (config.provider) {
    case "outlook":
      return new OutlookEmailProvider(providerConfig, async (updatedTokens) => {
        await storage.updateEmailConfiguration(config.id, {
          config: updatedTokens,
        });
      });
    case "gmail":
      return new GmailEmailProvider(providerConfig, async (updatedTokens) => {
        await storage.updateEmailConfiguration(config.id, {
          config: updatedTokens,
        });
      });
    case "imap_smtp":
      return new ImapSmtpEmailProvider(providerConfig);
    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
