import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET environment variable is required in production");
  console.warn("[auth] WARNING: JWT_SECRET not set — using insecure default.");
}
const SECRET = JWT_SECRET ?? "change-me-in-env";

// ── Session policy ─────────────────────────────────────────────────────────────
const SESSION_TTL_HOURS    = 8;                          // sliding window
const SESSION_MAX_HOURS    = 12;                         // absolute hard cap from first issue
const SESSION_TTL_SECS     = SESSION_TTL_HOURS  * 3600;
const SESSION_MAX_SECS     = SESSION_MAX_HOURS  * 3600;

export interface AuthRequest extends Request {
  userId?:           number;
  userJurisdiction?: "CA" | "US";
}

// ── Token structure ────────────────────────────────────────────────────────────
// sub  — user id
// jur  — "CA" | "US"
// iat  — issued-at (standard, set by jsonwebtoken)
// exp  — sliding expiry (iat + SESSION_TTL_SECS), refreshed on each request
// iss  — absolute session start (set once at login/register, carried forward)

/**
 * Sign a new token.
 * @param issuedAt  Original session start (unix seconds). Pass undefined on
 *                  first login — it will be set to now. Pass existing value
 *                  when rotating so the absolute cap is preserved.
 */
export function signToken(
  id:           number,
  jurisdiction: "CA" | "US" = "CA",
  issuedAt?:    number,          // absolute session start
): string {
  const iss = issuedAt ?? Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: id, jur: jurisdiction, iss },
    SECRET,
    { expiresIn: SESSION_TTL_SECS },
  );
}

/**
 * Middleware — verifies token, enforces absolute session cap, rotates token.
 *
 * Rotation: a refreshed token is written to the `X-Refreshed-Token` response
 * header on every authenticated request so the client's sliding window resets.
 * The absolute cap (`iss`) is carried forward unchanged.
 */
export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });

  try {
    const p = jwt.verify(h.slice(7), SECRET) as any;

    // ── Absolute expiry check ────────────────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    const iss = p.iss ?? p.iat;   // fall back to iat for tokens issued before this change
    if (now - iss > SESSION_MAX_SECS) {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    req.userId           = +p.sub;
    req.userJurisdiction = p.jur === "US" ? "US" : "CA";

    // ── Silent token rotation (sliding window refresh) ───────────────────────
    const refreshed = signToken(req.userId, req.userJurisdiction, iss);
    res.setHeader("X-Refreshed-Token", refreshed);

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }
    res.status(401).json({ message: "Invalid token" });
  }
}

export const hashPassword  = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

// ── Password policy ────────────────────────────────────────────────────────────
export function validatePassword(p: string): string | null {
  if (p.length < 12)                                                           return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(p))                                                        return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(p))                                                        return "Password must contain at least one lowercase letter.";
  if (!/\d/.test(p))                                                           return "Password must contain at least one number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p))                       return "Password must contain at least one special character.";
  return null;
}

/** Fetch a user from the appropriate jurisdiction DB. */
export async function getUser(id: number, jurisdiction: "CA" | "US" = "CA") {
  const [u] = await getDb(jurisdiction).select({
    id:           users.id,
    email:        users.email,
    firstName:    users.firstName,
    lastName:     users.lastName,
    firmName:     users.firmName,
    jurisdiction: users.jurisdiction,
    subscriptionTier:   users.subscriptionTier,
    subscriptionStatus: users.subscriptionStatus,
    trialEndsAt:        users.trialEndsAt,
    currentPeriodEnd:   users.currentPeriodEnd,
  }).from(users).where(eq(users.id, id));
  return u ?? null;
}
