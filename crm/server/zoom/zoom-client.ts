/**
 * Zoom OAuth + API client (user-managed OAuth app, one connection per advisor).
 *
 * Env: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, CUSTOM_DOMAIN (redirect URI = https://<CUSTOM_DOMAIN>/api/crm/zoom/callback).
 * Scopes are configured on the Zoom Marketplace app itself (Zoom does not take a scope parameter for
 * user-managed apps); the scopes actually granted come back in the token response and are stored.
 * Tokens are encrypted at rest with the same AES-256-GCM helper used for email credentials.
 */
import crypto from "crypto";
import { pool } from "../db";
import { encryptValue, decryptValue } from "../auth/emailCrypto";

// Overridable only for automated tests against a fake Zoom; unset in production.
const ZOOM_OAUTH = process.env.ZOOM_OAUTH_BASE || "https://zoom.us/oauth";
const ZOOM_API = process.env.ZOOM_API_BASE || "https://api.zoom.us/v2";
export const ZOOM_KEY_VERSION = "v1";

export class ZoomAuthError extends Error {}

export function isZoomConfigured(): boolean {
  return !!process.env.ZOOM_CLIENT_ID && !!process.env.ZOOM_CLIENT_SECRET;
}

export function getZoomRedirectUri(): string {
  const d = process.env.CUSTOM_DOMAIN;
  return d ? `https://${d}/api/crm/zoom/callback` : "http://localhost:8080/api/crm/zoom/callback";
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function getZoomAuthUrl(state: string, codeChallenge: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: getZoomRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ZOOM_OAUTH}/authorize?${p.toString()}`;
}

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

async function tokenRequest(body: URLSearchParams): Promise<ZoomTokenResponse> {
  const res = await fetch(`${ZOOM_OAUTH}/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    // Never log the response body verbatim beyond the status: it can echo credentials/codes.
    throw new ZoomAuthError(`Zoom token request failed (${res.status})`);
  }
  return (await res.json()) as ZoomTokenResponse;
}

export function exchangeZoomCode(code: string, codeVerifier: string) {
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: getZoomRedirectUri(), code_verifier: codeVerifier }),
  );
}

export async function fetchZoomUser(accessToken: string): Promise<{ id: string; email: string; displayName: string }> {
  const res = await fetch(`${ZOOM_API}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ZoomAuthError(`Zoom user lookup failed (${res.status})`);
  const u = (await res.json()) as { id: string; email?: string; display_name?: string; first_name?: string; last_name?: string };
  return { id: u.id, email: u.email ?? "", displayName: u.display_name || `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() };
}

export async function revokeZoomToken(token: string): Promise<void> {
  try {
    await fetch(`${ZOOM_OAUTH}/revoke`, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    /* best effort: local tokens are wiped regardless */
  }
}

/** Insert/replace the connection for a staff member. Returns the account id. */
export async function saveZoomConnection(args: {
  companyId: number | null;
  staffId: number;
  zoomUser: { id: string; email: string };
  tokens: ZoomTokenResponse;
}): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // A Zoom identity may be attached to only one Compass account at a time.
    const clash = await c.query(
      "SELECT staff_id FROM zoom_accounts WHERE zoom_user_id = $1 AND status = 'connected' AND staff_id <> $2",
      [args.zoomUser.id, args.staffId],
    );
    if (clash.rowCount) throw new ZoomAuthError("This Zoom account is already connected to another Compass user.");
    const scopes = (args.tokens.scope ?? "").split(/[\s,]+/).filter(Boolean);
    const acct = await c.query(
      `INSERT INTO zoom_accounts (company_id, staff_id, zoom_user_id, zoom_email, status, granted_scopes, connected_at, disconnected_at, updated_at)
       VALUES ($1,$2,$3,$4,'connected',$5,now(),NULL,now())
       ON CONFLICT (staff_id) DO UPDATE SET company_id=EXCLUDED.company_id, zoom_user_id=EXCLUDED.zoom_user_id, zoom_email=EXCLUDED.zoom_email,
         status='connected', granted_scopes=EXCLUDED.granted_scopes, connected_at=now(), disconnected_at=NULL, updated_at=now()
       RETURNING id`,
      [args.companyId, args.staffId, args.zoomUser.id, args.zoomUser.email, scopes],
    );
    const id: number = acct.rows[0].id;
    await c.query(
      `INSERT INTO zoom_oauth_tokens (account_id, encrypted_access_token, encrypted_refresh_token, expires_at, encryption_key_version, updated_at)
       VALUES ($1,$2,$3, now() + ($4 || ' seconds')::interval, $5, now())
       ON CONFLICT (account_id) DO UPDATE SET encrypted_access_token=EXCLUDED.encrypted_access_token,
         encrypted_refresh_token=EXCLUDED.encrypted_refresh_token, expires_at=EXCLUDED.expires_at,
         encryption_key_version=EXCLUDED.encryption_key_version, updated_at=now()`,
      [id, encryptValue(args.tokens.access_token), encryptValue(args.tokens.refresh_token), String(args.tokens.expires_in), ZOOM_KEY_VERSION],
    );
    await c.query("COMMIT");
    return id;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Returns a valid access token for the advisor, refreshing it (with a row lock so concurrent callers
 * don't both spend the single-use refresh token) when it expires within 2 minutes.
 * Marks the account 'needs_reauth' if Zoom rejects the refresh token.
 */
export async function getValidZoomAccessToken(staffId: number): Promise<string> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `SELECT a.id, a.status, t.encrypted_access_token, t.encrypted_refresh_token, t.expires_at
         FROM zoom_accounts a JOIN zoom_oauth_tokens t ON t.account_id = a.id
        WHERE a.staff_id = $1 FOR UPDATE OF t`,
      [staffId],
    );
    const row = r.rows[0];
    if (!row || row.status !== "connected") {
      await c.query("ROLLBACK");
      throw new ZoomAuthError("Zoom is not connected.");
    }
    if (new Date(row.expires_at).getTime() - Date.now() > 2 * 60 * 1000) {
      await c.query("COMMIT");
      return decryptValue(row.encrypted_access_token);
    }
    try {
      const t = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptValue(row.encrypted_refresh_token) }));
      await c.query(
        `UPDATE zoom_oauth_tokens SET encrypted_access_token=$2, encrypted_refresh_token=$3,
           expires_at = now() + ($4 || ' seconds')::interval, encryption_key_version=$5, updated_at=now() WHERE account_id=$1`,
        [row.id, encryptValue(t.access_token), encryptValue(t.refresh_token), String(t.expires_in), ZOOM_KEY_VERSION],
      );
      await c.query("COMMIT");
      return t.access_token;
    } catch (e) {
      await c.query("UPDATE zoom_accounts SET status='needs_reauth', updated_at=now() WHERE id=$1", [row.id]);
      await c.query("COMMIT");
      throw new ZoomAuthError("Zoom authorization expired. Please reconnect Zoom.");
    }
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch { /* already finished */ }
    throw e;
  } finally {
    c.release();
  }
}

/** Revoke at Zoom, then wipe local tokens and mark the account disconnected. */
export async function disconnectZoom(staffId: number): Promise<boolean> {
  const r = await pool.query(
    `SELECT a.id, t.encrypted_access_token, t.encrypted_refresh_token FROM zoom_accounts a
       LEFT JOIN zoom_oauth_tokens t ON t.account_id = a.id WHERE a.staff_id = $1`,
    [staffId],
  );
  const row = r.rows[0];
  if (!row) return false;
  for (const col of ["encrypted_access_token", "encrypted_refresh_token"]) {
    if (row[col]) { try { await revokeZoomToken(decryptValue(row[col])); } catch { /* ignore */ } }
  }
  await pool.query("DELETE FROM zoom_oauth_tokens WHERE account_id = $1", [row.id]);
  await pool.query("UPDATE zoom_accounts SET status='disconnected', disconnected_at=now(), updated_at=now() WHERE id=$1", [row.id]);
  return true;
}
