/**
 * Security event log, failed-login alerts, account lockout and new-device notices.
 * Tables are created by initSchema (security_events, login_devices; staff.failed_login_count / locked_until).
 *
 * ENV (all optional):
 *   SECURITY_ALERT_EMAIL   comma-separated recipients for admin alerts. Default: every active host user.
 *   RESEND_API_KEY         used (over HTTPS, no extra dependency) to deliver the emails. Without it alerts are only logged.
 *   EMAIL_FROM             sender, default "Compass CRM <noreply@compassplanning.app>".
 *   LOCKOUT_THRESHOLD      failed attempts before an account locks (default 5)
 *   LOCKOUT_MINUTES        lock length (default 15)
 *   IP_ALERT_THRESHOLD     failures from one IP within 10 min that trigger an alert (default 8)
 */
import crypto from "crypto";
import { pool } from "./db";
import { logger } from "./logger";

export const LOCKOUT_THRESHOLD = Number(process.env.LOCKOUT_THRESHOLD) || 5;
export const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES) || 15;
const IP_ALERT_THRESHOLD = Number(process.env.IP_ALERT_THRESHOLD) || 8;

export type SecurityEventType =
  | "login_failed" | "login_success" | "account_locked" | "login_blocked_locked"
  | "mfa_failed" | "account_unlocked" | "new_device_login" | "ip_burst_alert" | "alert_sent";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function clientIp(req: any): string {
  return String(req?.ip || req?.socket?.remoteAddress || "unknown");
}

/** Short human summary of a User-Agent: "Chrome on Windows". */
export function describeUa(ua?: string): string {
  const u = ua || "";
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : u ? "Unknown browser" : "Unknown browser";
  const os = /Windows/.test(u) ? "Windows" : /iPhone|iPad|iOS/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X|Macintosh/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

export async function recordEvent(
  type: SecurityEventType, req: any,
  o: { email?: string | null; staffId?: number | null; companyId?: number | null; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO security_events (type, email, staff_id, company_id, ip, user_agent, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [type, o.email ?? null, o.staffId ?? null, o.companyId ?? null, req ? clientIp(req) : null, req?.headers?.["user-agent"]?.toString().slice(0, 300) ?? null, JSON.stringify(o.detail ?? {})],
    );
  } catch (err: any) {
    logger.error(`[security] could not record ${type}: ${err?.message}`);
  }
}

// ── Email delivery (Resend HTTP API) ─────────────────────────────────────────

async function sendMail(to: string[], subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) {
    logger.warn(`[security] email not sent (${key ? "no recipients" : "RESEND_API_KEY not set"}): ${subject}`);
    return;
  }
  try {
    const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Compass CRM <noreply@compassplanning.app>", to, subject, html }),
    });
    if (!r.ok) logger.error(`[security] email provider rejected "${subject}": ${r.status} ${(await r.text()).slice(0, 200)}`);
  } catch (err: any) {
    logger.error(`[security] email send failed: ${err?.message}`);
  }
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#2d1b69;color:#fff;padding:18px 24px;font-weight:700">Compass CRM · Security</div>
    <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6"><h2 style="margin:0 0 12px;color:#1e1035;font-size:18px">${esc(title)}</h2>${body}</div></div>`;

async function adminRecipients(): Promise<string[]> {
  const env = (process.env.SECURITY_ALERT_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (env.length) return env;
  try {
    const r = await pool.query(`SELECT email FROM host_users WHERE is_active = true AND email IS NOT NULL`);
    return r.rows.map((x: any) => x.email);
  } catch { return []; }
}

/** Email the admins once per `key` per hour. */
export async function alertAdmins(key: string, subject: string, bodyHtml: string): Promise<void> {
  try {
    const dup = await pool.query(
      `SELECT 1 FROM security_events WHERE type='alert_sent' AND detail->>'key' = $1 AND created_at > now() - interval '1 hour' LIMIT 1`, [key]);
    if (dup.rowCount) return;
    await recordEvent("alert_sent", null, { detail: { key, subject } });
    await sendMail(await adminRecipients(), `[Compass security] ${subject}`, wrap(subject, bodyHtml));
  } catch (err: any) {
    logger.error(`[security] alertAdmins failed: ${err?.message}`);
  }
}

// ── Failed logins, lockout ───────────────────────────────────────────────────

export async function isLocked(staffId: number): Promise<Date | null> {
  const r = await pool.query(`SELECT locked_until FROM staff WHERE id=$1`, [staffId]);
  const until: Date | null = r.rows[0]?.locked_until ?? null;
  return until && until.getTime() > Date.now() ? until : null;
}

/** Call on every wrong password / unknown email. Handles counting, lockout and alerts. */
export async function onLoginFailure(req: any, email: string, member?: { id: number; companyId: number | null; firstName: string } | null): Promise<{ locked: boolean }> {
  const ip = clientIp(req);
  await recordEvent("login_failed", req, { email, staffId: member?.id ?? null, companyId: member?.companyId ?? null });
  let locked = false;

  if (member) {
    // Count failures since the last success; reset an expired lock's counter.
    const r = await pool.query(
      `UPDATE staff SET failed_login_count = CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE COALESCE(failed_login_count,0) + 1 END,
                        last_failed_login_at = now(),
                        locked_until = CASE WHEN locked_until IS NOT NULL AND locked_until > now() THEN locked_until ELSE NULL END
       WHERE id=$1 RETURNING failed_login_count`, [member.id]);
    const count: number = r.rows[0]?.failed_login_count ?? 0;
    if (count >= LOCKOUT_THRESHOLD) {
      await pool.query(`UPDATE staff SET locked_until = now() + ($2 || ' minutes')::interval, failed_login_count = 0 WHERE id=$1`, [member.id, String(LOCKOUT_MINUTES)]);
      locked = true;
      await recordEvent("account_locked", req, { email, staffId: member.id, companyId: member.companyId, detail: { minutes: LOCKOUT_MINUTES } });
      // Tell the account owner and the admins.
      void sendMail([email], "Your Compass CRM account was temporarily locked",
        wrap("Your account was temporarily locked",
          `<p>Hi ${esc(member.firstName)},</p><p>There were ${LOCKOUT_THRESHOLD} failed sign-in attempts on your account, so we locked it for ${LOCKOUT_MINUTES} minutes. The last attempt came from IP <b>${esc(ip)}</b> (${esc(describeUa(req.headers?.["user-agent"]))}).</p>
           <p>If this was you, wait ${LOCKOUT_MINUTES} minutes and try again, or use "Forgot password". If it wasn't, change your password once you can sign in and tell your administrator.</p>`));
      void alertAdmins(`lock:${member.id}`, `Account locked: ${email}`,
        `<p><b>${esc(email)}</b> was locked for ${LOCKOUT_MINUTES} minutes after ${LOCKOUT_THRESHOLD} failed sign-ins.</p><p>Latest attempt: IP ${esc(ip)}, ${esc(describeUa(req.headers?.["user-agent"]))}.</p>`);
    }
  }

  // Same IP hammering (any account): alert once per hour per IP.
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n, count(DISTINCT lower(email))::int AS accounts FROM security_events
       WHERE type='login_failed' AND ip=$1 AND created_at > now() - interval '10 minutes'`, [ip]);
    const { n, accounts } = r.rows[0] ?? { n: 0, accounts: 0 };
    if (n >= IP_ALERT_THRESHOLD) {
      await recordEvent("ip_burst_alert", req, { detail: { failures: n, accounts } });
      void alertAdmins(`ip:${ip}`, `Possible brute-force from ${ip}`,
        `<p>${n} failed sign-ins from IP <b>${esc(ip)}</b> in the last 10 minutes, targeting ${accounts} account(s).</p><p>Latest browser: ${esc(describeUa(req.headers?.["user-agent"]))}.</p>
         <p>To block it, add the IP to your edge firewall (e.g. Cloudflare) or rotate <code>SESSION_SECRET</code> if you suspect a session was taken.</p>`);
    }
  } catch (err: any) { logger.error(`[security] ip burst check failed: ${err?.message}`); }

  return { locked };
}

// ── Success: reset counter + new-device notice ───────────────────────────────

export async function onLoginSuccess(req: any, member: { id: number; companyId: number | null; email: string; firstName: string }): Promise<void> {
  try {
    await pool.query(`UPDATE staff SET failed_login_count = 0, locked_until = NULL WHERE id=$1`, [member.id]);
    await recordEvent("login_success", req, { email: member.email, staffId: member.id, companyId: member.companyId });

    const ua = req.headers?.["user-agent"]?.toString() ?? "";
    const device = crypto.createHash("sha256").update(describeUa(ua)).digest("hex").slice(0, 32);
    const ip = clientIp(req);
    const known = await pool.query(`SELECT 1 FROM login_devices WHERE staff_id=$1 LIMIT 1`, [member.id]);
    const ins = await pool.query(
      `INSERT INTO login_devices (staff_id, device_hash, label, ip, user_agent) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (staff_id, device_hash) DO UPDATE SET last_seen = now(), ip = EXCLUDED.ip
       RETURNING (xmax = 0) AS inserted`, [member.id, device, describeUa(ua), ip, ua.slice(0, 300)]);
    const isNew = ins.rows[0]?.inserted === true;
    // First device ever recorded for the account is the baseline, not an alert.
    if (isNew && known.rowCount) {
      await recordEvent("new_device_login", req, { email: member.email, staffId: member.id, companyId: member.companyId, detail: { device: describeUa(ua) } });
      void sendMail([member.email], "New sign-in to your Compass CRM account",
        wrap("New sign-in to your account",
          `<p>Hi ${esc(member.firstName)},</p><p>Your account was just used to sign in from a browser we haven't seen before:</p>
           <ul><li><b>Device:</b> ${esc(describeUa(ua))}</li><li><b>IP address:</b> ${esc(ip)}</li><li><b>Time:</b> ${esc(new Date().toUTCString())}</li></ul>
           <p>If this was you, no action is needed. If it wasn't, change your password right away and tell your administrator.</p>`));
    }
  } catch (err: any) {
    logger.error(`[security] onLoginSuccess failed: ${err?.message}`);
  }
}

export async function onMfaFailure(req: any, staffId: number | undefined): Promise<void> {
  await recordEvent("mfa_failed", req, { staffId: staffId ?? null });
  try {
    const ip = clientIp(req);
    const r = await pool.query(`SELECT count(*)::int AS n FROM security_events WHERE type='mfa_failed' AND ip=$1 AND created_at > now() - interval '10 minutes'`, [ip]);
    if ((r.rows[0]?.n ?? 0) >= 5) void alertAdmins(`mfa:${ip}`, `Repeated MFA failures from ${ip}`, `<p>${r.rows[0].n} failed MFA / recovery-code attempts from IP <b>${esc(ip)}</b> in 10 minutes. The password for that account was already correct, so treat this as a likely compromised password.</p>`);
  } catch (err: any) { logger.error(`[security] mfa check failed: ${err?.message}`); }
}
