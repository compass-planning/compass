import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { createHash } from "crypto";
import { pool } from "../db";

// ── Session TTL constants ─────────────────────────────────────────────────────
// IDLE_TTL:     cookie maxAge — session expires after 8 hours of inactivity.
// ABSOLUTE_TTL: hard ceiling — no session survives longer than 12 hours
//               regardless of activity. Forces re-authentication daily.
export const IDLE_TTL     = 8  * 60 * 60 * 1000;   // 8 hours  (ms)
export const ABSOLUTE_TTL = 12 * 60 * 60 * 1000;   // 12 hours (ms)

// ── Session data shape ────────────────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    staffId?:    number;
    hostUserId?: number;
    userType?:   "staff" | "host";
    // Security stamps — set on login, checked on every authenticated request
    createdAt?:  number;   // Unix ms — used to enforce ABSOLUTE_TTL
    uaHash?:     string;   // SHA-256 of User-Agent — detects session hijacking
    mfaEnabled?: boolean;  // Cached from DB on login — avoids per-request DB lookup
    mfaVerified?: boolean; // True once TOTP code confirmed for this session
  }
}

// ── User-Agent fingerprint helper ─────────────────────────────────────────────
// Hashes the User-Agent header so we can detect if the same session cookie
// is being used from a different browser/device mid-session.
export function hashUserAgent(ua: string | undefined): string {
  return createHash("sha256").update(ua ?? "").digest("hex").slice(0, 16);
}

// ── Session store factory ─────────────────────────────────────────────────────
export function getSession() {
  const pgStore    = connectPg(session);
  const sessionStore = new pgStore({
    pool,                                  // CRM pool: search_path = crm,public
    createTableIfMissing: false,
    ttl:                IDLE_TTL / 1000,   // connect-pg-simple uses seconds
    tableName:          "sessions",
  });

  return session({
    name:             "connect.sid",
    secret:           process.env.SESSION_SECRET!,
    store:            sessionStore,
    resave:           false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      path:     "/",
      sameSite: "lax",
      maxAge:   IDLE_TTL,   // browser drops cookie after 8 hours of inactivity
    },
  });
}

export async function setupAuth(app: Express): Promise<void> {
  app.set("trust proxy", 1);
  app.use(getSession());
}

// ── isAuthenticated middleware ────────────────────────────────────────────────
// Checks:
//   1. Session contains a valid user ID
//   2. Session has not exceeded the absolute 12-hour ceiling
//   3. User-Agent matches the fingerprint set at login (detects session theft)
export const isAuthenticated: RequestHandler = (req, res, next) => {
  const s = (req as any).session;

  // 1. Must have a user ID
  if (!s?.staffId && !s?.hostUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // 2. Absolute session expiry — force re-login after 12 hours regardless of activity
  if (s.createdAt && Date.now() - s.createdAt > ABSOLUTE_TTL) {
    s.destroy(() => {});
    res.clearCookie("connect.sid");
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }

  // 3. User-Agent fingerprint — reject if the browser changed mid-session
  if (s.uaHash) {
    const currentHash = hashUserAgent(req.headers["user-agent"]);
    if (currentHash !== s.uaHash) {
      s.destroy(() => {});
      res.clearCookie("connect.sid");
      return res.status(401).json({ message: "Session invalid. Please log in again." });
    }
  }

  // 4. MFA gate — if the account has MFA enabled, the TOTP step must be
  //    completed before any API access is granted.
  if (s.mfaEnabled && !s.mfaVerified) {
    return res.status(403).json({
      message:     "MFA verification required.",
      mfaRequired: true,
    });
  }

  return next();
};
