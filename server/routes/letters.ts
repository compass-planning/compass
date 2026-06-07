import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";
import { eq, and } from "drizzle-orm";
import { reasonWhyLetters } from "../../shared/schema.js";

const r = Router();
r.use(isAuthenticated);

r.get("/clients/:id/letters", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(reasonWhyLetters).where(eq(reasonWhyLetters.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/letters", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { letterType = "life", subject = "", body = "" } = req.body;
  const [row] = await (db.insert(reasonWhyLetters) as any).values({ clientId: cid, letterType, subject, body }).returning();
  res.status(201).json(row);
});

r.patch("/letters/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: reasonWhyLetters.id, clientId: reasonWhyLetters.clientId })
    .from(reasonWhyLetters).where(eq(reasonWhyLetters.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { subject, body } = req.body;
  const [u] = await db.update(reasonWhyLetters).set({ subject, body, updatedAt: new Date() } as any)
    .where(eq(reasonWhyLetters.id, ex.id)).returning();
  res.json(u);
});

r.delete("/letters/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: reasonWhyLetters.id, clientId: reasonWhyLetters.clientId })
    .from(reasonWhyLetters).where(eq(reasonWhyLetters.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(reasonWhyLetters).where(eq(reasonWhyLetters.id, ex.id));
  res.json({ ok: true });
});

export { r as lettersRouter };
