/**
 * server/routes/activityLog.ts
 *
 * GET  /api/clients/:id/activities         — fetch activity feed
 * POST /api/clients/:id/activities         — manual activity entry
 *
 * Also exports logActivity() — call this from any route handler
 * that mutates client data to keep an immutable audit trail.
 */

import { Router } from "express";
import { db } from "../db";
import { activities, staff } from "@shared/schema";
import { _and, desc, eq } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { getStaffFromSession, verifyClientOwnership } from "./middleware";

export const activityLogRouter = Router();

// ── GET /api/clients/:id/activities ──────────────────────────────────────────

activityLogRouter.get(
  "/api/clients/:id/activities",
  isAuthenticated,
  async (req: any, res) => {
    const clientId = Number(req.params.id);
    if (!(await verifyClientOwnership(req, res, clientId))) return;

    const rows = await db
      .select({
        id: activities.id,
        clientId: activities.clientId,
        activityType: activities.activityType,
        title: activities.title,
        description: activities.description,
        date: activities.date,
        duration: activities.duration,
        staffId: activities.staffId,
        createdAt: activities.createdAt,
        staffFirstName: staff.firstName,
        staffLastName: staff.lastName,
      })
      .from(activities)
      .leftJoin(staff, eq(activities.staffId, staff.id))
      .where(eq(activities.clientId, clientId))
      .orderBy(desc(activities.date))
      .limit(100);

    res.json(rows);
  }
);

// ── POST /api/clients/:id/activities ─────────────────────────────────────────

activityLogRouter.post(
  "/api/clients/:id/activities",
  isAuthenticated,
  async (req: any, res) => {
    const clientId = Number(req.params.id);
    if (!(await verifyClientOwnership(req, res, clientId))) return;

    const currentStaff = await getStaffFromSession(req);

    const { activityType, title, description, date, duration } = req.body;
    if (!activityType || !title) {
      return res.status(400).json({ message: "activityType and title are required" });
    }

    const [row] = await db
      .insert(activities)
      .values({
        clientId,
        activityType,
        title,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        duration: duration ? Number(duration) : null,
        staffId: currentStaff?.id || null,
      })
      .returning();

    res.status(201).json(row);
  }
);

// ── logActivity() — call from other routes ────────────────────────────────────
// Usage: await logActivity(req, clientId, "update", "Updated client profile");

export async function logActivity(
  req: any,
  clientId: number,
  activityType: string,
  title: string,
  description?: string,
) {
  try {
    const currentStaff = await getStaffFromSession(req);
    await db.insert(activities).values({
      clientId,
      activityType,
      title,
      description: description || null,
      date: new Date(),
      staffId: currentStaff?.id || null,
    });
  } catch (e) {
    // Never throw — logging should never break the main request
    console.error("[activityLog] failed to log:", e);
  }
}
