/**
 * Subscriptions route
 * Handles Stripe checkout sessions, webhook events, and subscription status.
 *
 * ENV vars required:
 *   STRIPE_SECRET_KEY       — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_...
 *   STRIPE_PRICE_MONTHLY    — price_... for $49/mo plan
 *   STRIPE_PRICE_ANNUAL     — price_... for $490/yr plan
 *   CLIENT_URL              — https://yourapp.com (used for redirect URLs)
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq } from "drizzle-orm";

const r = Router();

// ── GET /api/subscription — current user's subscription status ────────────────
r.get("/", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const [u] = await db.select({
    subscriptionTier:   users.subscriptionTier,
    subscriptionStatus: users.subscriptionStatus,
    trialEndsAt:        users.trialEndsAt,
    currentPeriodEnd:   users.currentPeriodEnd,
    stripeCustomerId:   users.stripeCustomerId,
  }).from(users).where(eq(users.id, req.userId!)).limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });

  const now = new Date();
  const trialActive = u.subscriptionStatus === "trialing" && u.trialEndsAt && u.trialEndsAt > now;
  const trialDaysLeft = trialActive && u.trialEndsAt
    ? Math.ceil((u.trialEndsAt.getTime() - now.getTime()) / 86400000)
    : 0;

  res.json({ ...u, trialActive, trialDaysLeft });
});

// ── POST /api/subscription/checkout — Stripe integration (not yet active) ────
r.post("/checkout", isAuthenticated, async (_req: AuthRequest, res: Response) => {
  // TODO: activate when Stripe is configured
  res.status(503).json({ message: "Payment processing coming soon.", code: "STRIPE_PENDING" });
});

// ── POST /api/subscription/portal — Stripe customer portal (not yet active) ──
r.post("/portal", isAuthenticated, async (_req: AuthRequest, res: Response) => {
  // TODO: activate when Stripe is configured
  res.status(503).json({ message: "Billing portal coming soon.", code: "STRIPE_PENDING" });
});

// ── POST /api/subscription/webhook — Stripe webhook (not yet active) ────────
r.post("/webhook", async (_req: Request, res: Response) => {
  // TODO: activate when Stripe is configured
  res.json({ received: true });
});

export { r as subscriptionsRouter };
