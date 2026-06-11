/**
 * server/auth/index.ts
 * Firebase-based auth middleware.
 * Verifies Firebase ID tokens on each request.
 * Users are looked up by firebase_uid in the users table.
 */

import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { verifyFirebaseToken } from "../lib/firebaseAdmin.js";

export interface AuthRequest extends Request {
  userId?:          number;
  firebaseUid?:     string;
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
  const idToken = header.slice(7);
  try {
    const decoded = await verifyFirebaseToken(idToken);
    req.firebaseUid = decoded.uid;

    // Look up our internal user record
    let [u] = await getDb("CA").select({
      id: users.id, jurisdiction: users.jurisdiction,
    }).from(users).where(eq((users as any).firebaseUid, decoded.uid)).limit(1);

    if (!u) {
      [u] = await getDb("US").select({
        id: users.id, jurisdiction: users.jurisdiction,
      }).from(users).where(eq((users as any).firebaseUid, decoded.uid)).limit(1);
    }

    if (!u) {
      res.status(401).json({ message: "User not found. Please register." });
      return;
    }

    req.userId           = u.id;
    req.userJurisdiction = (u.jurisdiction ?? "CA") as "CA" | "US";
    next();
  } catch (e: any) {
    res.status(401).json({ message: "Invalid or expired token" });
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
  }).from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}
