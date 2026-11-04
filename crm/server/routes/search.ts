/**
 * server/routes/search.ts
 *
 * GET /api/search?q=<query>
 *
 * Returns up to 5 results per category, all scoped to the
 * staff member's company / advisor assignment.
 */

import { Router } from "express";
import { db } from "../db";
import { clients, tasks, meetings, products, leads } from "@shared/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { getStaffFromSession } from "./middleware";

export const searchRouter = Router();

searchRouter.get("/api/search", isAuthenticated, async (req: any, res) => {
  const q = (req.query.q as string || "").trim();
  if (q.length < 2) return res.json({ clients: [], tasks: [], meetings: [], policies: [], leads: [] });

  const staff = await getStaffFromSession(req);
  if (!staff) return res.status(401).json({ message: "Unauthorized" });

  const term = `%${q}%`;
  const companyId = staff.companyId;
  const _staffId = staff.id;

  // ── Clients ──────────────────────────────────────────────────────────────────
  const clientScope = companyId
    ? and(
        eq(clients.companyId, companyId),
        or(
          ilike(clients.firstName, term),
          ilike(clients.lastName, term),
          ilike(clients.email, term),
          ilike(clients.phone, term),
        )
      )
    : or(
        ilike(clients.firstName, term),
        ilike(clients.lastName, term),
        ilike(clients.email, term),
      );

  const clientResults = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
      phone: clients.phone,
    })
    .from(clients)
    .where(clientScope)
    .limit(5);

  // ── Tasks ────────────────────────────────────────────────────────────────────
  const taskScope = companyId
    ? and(
        eq(tasks.companyId, companyId),
        or(ilike(tasks.title, term), ilike(tasks.description, term))
      )
    : or(ilike(tasks.title, term), ilike(tasks.description, term));

  const taskResults = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      dueDate: tasks.dueDate,
      clientId: tasks.clientId,
    })
    .from(tasks)
    .where(taskScope)
    .limit(5);

  // ── Meetings ─────────────────────────────────────────────────────────────────
  const meetingResults = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      date: meetings.date,
      clientId: meetings.clientId,
    })
    .from(meetings)
    .where(ilike(meetings.title, term))
    .limit(5);

  // ── Policies / Products ───────────────────────────────────────────────────────
  const productResults = await db
    .select({
      id: products.id,
      type: products.type,
      provider: products.provider,
      policyNumber: products.policyNumber,
      clientId: products.clientId,
    })
    .from(products)
    .where(or(
      ilike(products.policyNumber, term),
      ilike(products.type, term),
      ilike(products.provider, term),
    ))
    .limit(5);

  // ── Leads ────────────────────────────────────────────────────────────────────
  const leadScope = companyId
    ? and(
        eq(leads.companyId, companyId),
        or(
          ilike(leads.firstName, term),
          ilike(leads.lastName, term),
          ilike(leads.email, term),
        )
      )
    : or(
        ilike(leads.firstName, term),
        ilike(leads.lastName, term),
        ilike(leads.email, term),
      );

  const leadResults = await db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      status: leads.status,
    })
    .from(leads)
    .where(leadScope)
    .limit(5);

  res.json({
    clients: clientResults,
    tasks: taskResults,
    meetings: meetingResults,
    policies: productResults,
    leads: leadResults,
  });
});
