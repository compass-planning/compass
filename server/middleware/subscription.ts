/**
 * Subscription guard middleware.
 * Attaches subscription info to the request and blocks access
 * when the subscription is canceled or the trial has expired.
 *
 * Routes that should still work for unauthenticated / inactive users
 * (login, register, webhook, subscription checkout) must be mounted
 * BEFORE this middleware in server/index.ts.
 */

import type { Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import type { AuthRequest } from "../auth/index.js";

export interface SubscriptionRequest extends AuthRequest {
  subscriptionStatus?: string;
  subscriptionTier?: string;
}

export async function requireActiveSubscription(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) return next(); // isAuthenticated runs first; let it handle 401

  const [u] = await db.select({
    subscriptionStatus: users.subscriptionStatus,
    subscriptionTier:   users.subscriptionTier,
    trialEndsAt:        users.trialEndsAt,
    currentPeriodEnd:   users.currentPeriodEnd,
  }).from(users).where(eq(users.id, req.userId)).limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });

  const now = new Date();

  // Trialing — check if trial is still valid
  if (u.subscriptionStatus === "trialing") {
    if (u.trialEndsAt && u.trialEndsAt < now) {
      return res.status(402).json({
        message: "Your free trial has expired. Please subscribe to continue.",
        code: "TRIAL_EXPIRED",
      });
    }
    req.subscriptionStatus = "trialing";
    req.subscriptionTier   = u.subscriptionTier ?? "trial";
    return next();
  }

  // Active subscription
  if (u.subscriptionStatus === "active") {
    req.subscriptionStatus = "active";
    req.subscriptionTier   = u.subscriptionTier ?? "monthly";
    return next();
  }

  // Past due — allow read access, block writes
  if (u.subscriptionStatus === "past_due") {
    req.subscriptionStatus = "past_due";
    req.subscriptionTier   = u.subscriptionTier ?? "monthly";
    // Let route handlers decide if they want to block mutations
    return next();
  }

  // Canceled
  return res.status(402).json({
    message: "Your subscription is no longer active. Please resubscribe to continue.",
    code: "SUBSCRIPTION_INACTIVE",
  });
}
