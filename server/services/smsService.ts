/**
 * server/services/smsService.ts
 * Sends SMS via Twilio.
 * ENV: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

import twilio from "twilio";

function getClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  return twilio(sid, token);
}

const FROM = process.env.TWILIO_PHONE_NUMBER;

export async function sendSmsCode(to: string, code: string): Promise<void> {
  if (!FROM) throw new Error("TWILIO_PHONE_NUMBER not set");
  const client = getClient();
  await client.messages.create({
    to,
    from: FROM,
    body: `Your Compass Planning verification code is: ${code}. Valid for 10 minutes.`,
  });
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
