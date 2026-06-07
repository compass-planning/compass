import { clientCreateSchema, clientPatchSchema } from "../../shared/validators.js";
import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { clients, financialPlans as plans } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq, and, ilike, or, inArray } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

function safe(body: any) {
  const { id, createdAt, updatedAt, userId, ...rest } = body;
  return rest;
}

// Each user only sees their own clients — strict isolation
async function accessibleUserIds(userId: number): Promise<number[]> {
  return [userId];
}

// Check if requester can access a specific client
async function canAccessClient(userId: number, clientId: number): Promise<boolean> {
  const ids = await accessibleUserIds(userId);
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
  return !!c;
}

r.get("/", async (req: AuthRequest, res: Response) => {
  const s = req.query.search as string | undefined;
  const agentId = req.query.agentId ? +req.query.agentId : null;
  const ids = await accessibleUserIds(req.userId!);
  const effectiveIds = agentId && ids.includes(agentId) ? [agentId] : ids;
  const rows = await db.select().from(clients)
    .where(s
      ? and(inArray(clients.userId, effectiveIds), or(ilike(clients.firstName, `%${s}%`), ilike(clients.lastName, `%${s}%`)))
      : inArray(clients.userId, effectiveIds));
  res.json(rows);
});

r.get("/:id", async (req: AuthRequest, res: Response) => {
  const ok = await canAccessClient(req.userId!, +req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  const [c] = await db.select().from(clients).where(eq(clients.id, +req.params.id));
  res.json(c);
});

r.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = clientCreateSchema.parse(req.body);
    const [c] = await db.insert(clients).values({ ...safe(body), userId: req.userId }).returning();
    res.status(201).json(c);
  } catch (e: any) {
    console.error("[clients/post]", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.patch("/:id", async (req: AuthRequest, res: Response) => {
  const ok = await canAccessClient(req.userId!, +req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  try {
    const body = clientPatchSchema.parse(req.body);
    const [u] = await db.update(clients).set(safe(body)).where(eq(clients.id, +req.params.id)).returning();
    res.json(u);
  } catch (e: any) {
    console.error("[clients/patch]", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.delete("/:id", async (req: AuthRequest, res: Response) => {
  const ok = await canAccessClient(req.userId!, +req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  await db.delete(clients).where(eq(clients.id, +req.params.id));
  res.json({ ok: true });
});

r.get("/:id/plans", async (req: AuthRequest, res: Response) => {
  const ok = await canAccessClient(req.userId!, +req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(plans).where(eq(plans.clientId, +req.params.id));
  res.json(rows);
});

r.post("/:id/plans", async (req: AuthRequest, res: Response) => {
  const ok = await canAccessClient(req.userId!, +req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  const [p] = await (db.insert(plans) as any).values({ clientId: +req.params.id, userId: req.userId!, title: req.body.name ?? req.body.title ?? "Financial Plan" }).returning();
  res.status(201).json(p);
});

export { r as clientsRouter };


