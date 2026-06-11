/**
 * server/services/emailService.ts
 * Sends transactional emails via Resend.
 * ENV: RESEND_API_KEY, EMAIL_FROM (default: noreply@compassplanning.app)
 */

import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM ?? "Compass Planning <noreply@compassplanning.app>";

export async function sendVerificationEmail(to: string, code: string, firstName: string): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Compass Planning account",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 0;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#2d1b69,#4c1d95);padding:32px 40px;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">COMPASS</h1>
            <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px;letter-spacing:4px;">PLANNING</p>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#1e1035;margin:0 0 12px;font-size:20px;">Hi ${firstName},</h2>
            <p style="color:#64748b;margin:0 0 28px;font-size:15px;line-height:1.6;">
              Thanks for signing up! Enter this code to verify your email address:
            </p>
            <div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4c1d95;font-family:monospace;">${code}</div>
              <p style="color:#7c3aed;font-size:13px;margin:8px 0 0;">Expires in 15 minutes</p>
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:0;">
              If you didn't create a Compass Planning account, you can safely ignore this email.
            </p>
          </div>
          <div style="background:#f8f7ff;padding:20px 40px;border-top:1px solid #ede9fe;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} Compass Planning. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, code: string, firstName: string): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Compass Planning password",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 0;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#2d1b69,#4c1d95);padding:32px 40px;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">COMPASS</h1>
            <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px;letter-spacing:4px;">PLANNING</p>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#1e1035;margin:0 0 12px;font-size:20px;">Hi ${firstName},</h2>
            <p style="color:#64748b;margin:0 0 28px;font-size:15px;line-height:1.6;">
              We received a request to reset your password. Use this code:
            </p>
            <div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4c1d95;font-family:monospace;">${code}</div>
              <p style="color:#7c3aed;font-size:13px;margin:8px 0 0;">Expires in 15 minutes</p>
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:0;">
              If you didn't request a password reset, please ignore this email. Your password will not be changed.
            </p>
          </div>
          <div style="background:#f8f7ff;padding:20px 40px;border-top:1px solid #ede9fe;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} Compass Planning. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendMfaCodeEmail(to: string, code: string, firstName: string): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${code} is your Compass Planning sign-in code`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 0;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#2d1b69,#4c1d95);padding:32px 40px;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">COMPASS</h1>
            <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px;letter-spacing:4px;">PLANNING</p>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#1e1035;margin:0 0 12px;font-size:20px;">Hi ${firstName},</h2>
            <p style="color:#64748b;margin:0 0 28px;font-size:15px;line-height:1.6;">
              Here is your sign-in verification code:
            </p>
            <div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4c1d95;font-family:monospace;">${code}</div>
              <p style="color:#7c3aed;font-size:13px;margin:8px 0 0;">Expires in 10 minutes</p>
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:0;">
              If you didn't try to sign in, change your password immediately.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}
