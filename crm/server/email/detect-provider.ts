import type { EmailProviderType } from "@shared/schema";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const OUTLOOK_DOMAINS = new Set([
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "outlook.ca",
  "hotmail.ca",
  "live.ca",
  "outlook.co.uk",
  "hotmail.co.uk",
  "live.co.uk",
]);

export function detectEmailProvider(email: string): EmailProviderType {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "imap_smtp";

  if (GMAIL_DOMAINS.has(domain)) return "gmail";
  if (OUTLOOK_DOMAINS.has(domain)) return "outlook";

  return "imap_smtp";
}
