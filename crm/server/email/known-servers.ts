export interface KnownServerConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

const KNOWN_SERVERS: Record<string, KnownServerConfig> = {
  "yahoo.com": {
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "yahoo.ca": {
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "aol.com": {
    imapHost: "imap.aol.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.aol.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "bell.net": {
    imapHost: "imap.bell.net",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtpout.bell.net",
    smtpPort: 465,
    smtpSecure: true,
  },
  "sympatico.ca": {
    imapHost: "imap.bell.net",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtpout.bell.net",
    smtpPort: 465,
    smtpSecure: true,
  },
  "rogers.com": {
    imapHost: "imap.rogers.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.rogers.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "shaw.ca": {
    imapHost: "imap.shaw.ca",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.shaw.ca",
    smtpPort: 587,
    smtpSecure: false,
  },
  "telus.net": {
    imapHost: "imap.telus.net",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.telus.net",
    smtpPort: 587,
    smtpSecure: false,
  },
  "videotron.ca": {
    imapHost: "imap.videotron.ca",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "relais.videotron.ca",
    smtpPort: 587,
    smtpSecure: false,
  },
  "cogeco.ca": {
    imapHost: "imap.cogeco.ca",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.cogeco.ca",
    smtpPort: 587,
    smtpSecure: false,
  },
  "eastlink.ca": {
    imapHost: "mail.eastlink.ca",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.eastlink.ca",
    smtpPort: 587,
    smtpSecure: false,
  },
  "sasktel.net": {
    imapHost: "mail.sasktel.net",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.sasktel.net",
    smtpPort: 587,
    smtpSecure: false,
  },
  "icloud.com": {
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  "me.com": {
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  "mac.com": {
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  "zoho.com": {
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "fastmail.com": {
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "mail.com": {
    imapHost: "imap.mail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "gmx.com": {
    imapHost: "imap.gmx.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.gmx.com",
    smtpPort: 465,
    smtpSecure: true,
  },
};

export function lookupKnownServer(domain: string): KnownServerConfig | null {
  return KNOWN_SERVERS[domain.toLowerCase()] || null;
}

export function getAllKnownDomains(): string[] {
  return Object.keys(KNOWN_SERVERS).sort();
}
