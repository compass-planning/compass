/**
 * server/auth/index.ts
 * JWT-based auth middleware.
 * Replaces Firebase token verification entirely.
 *
 * Tokens are signed JWTs in the Authorization: Bearer header.
 * mfaVerified must be true for full access — prevents partial-auth bypass.
 */

import type { Request, Response, NextFunction } from "express";
import { getDb }             from "../db/index.js";
import { users }             from "../../shared/schema.js";
import { eq }                from "drizzle-orm";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  userId?:           number;
  userJurisdiction?: "CA" | "US";
}

export async function isAuthenticated(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));

    // Require TOTP step to have been completed
    if (!payload.mfaVerified) {
      res.status(401).json({ message: "MFA verification required" });
      return;
    }

    req.userId           = payload.userId;
    req.userJurisdiction = payload.jurisdiction;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}

export async function getUser(userId: number, jurisdiction: "CA" | "US" = "CA") {
  const [u] = await getDb(jurisdiction).select({
    id:                 users.id,
    email:              users.email,
    firstName:          users.firstName,
    lastName:           users.lastName,
    firmName:           users.firmName,
    jurisdiction:       users.jurisdiction,
    subscriptionTier:   users.subscriptionTier,
    subscriptionStatus: users.subscriptionStatus,
    trialEndsAt:        users.trialEndsAt,
    currentPeriodEnd:   users.currentPeriodEnd,
    mustResetPassword:  users.mustResetPassword,
    province:           users.province,
    totpEnabledAt:      users.totpEnabledAt,
    emailVerifiedAt:    users.emailVerifiedAt,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}
