import { pensionCreateSchema, pensionPatchSchema } from "../../shared/validators.js";
import { safeMsg, AppError } from "../lib/errorUtils.js";
import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";
import { eq } from "drizzle-orm";
import { pensionPlans } from "../../shared/schema.js";

const r = Router();
r.use(isAuthenticated);

r.get("/clients/:id/pensions", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
  try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e) }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const rows = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.post("/clients/:id/pensions", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
  try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e) }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
  const body = req.body;
  const [row] = await (db.insert(pensionPlans) as any).values({
    clientId: cid,
    pensionType: body.pensionType ?? "dbpp",
    employerName: body.employerName || null,
    accrualRate: body.accrualRate || null,
    yearsOfService: body.yearsOfService || null,
    projectedYearsAtRetirement: body.projectedYearsAtRetirement || null,
    bestAverageEarnings: body.bestAverageEarnings || null,
    currentBalance: body.currentBalance || null,
    employerMatchPct: body.employerMatchPct || null,
    retirementAge: body.retirementAge || 65,
    indexingType: body.indexingType || "none",
    indexingRate: body.indexingRate || null,
    bridgeBenefit: body.bridgeBenefit || null,
    bridgeBenefitEndAge: body.bridgeBenefitEndAge || 65,
    survivorBenefitPct: body.survivorBenefitPct != null && body.survivorBenefitPct !== "" ? body.survivorBenefitPct : null,
    isVested: body.isVested ?? true,
    subscriberOwner: body.subscriberOwner || "primary",
    notes: body.notes || null,
  }).returning();
  res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.patch("/pensions/:id", async (req: AuthRequest, res: Response) => {
  try {
  const [ex] = await db.select({ id: pensionPlans.id, clientId: pensionPlans.clientId })
    .from(pensionPlans).where(eq(pensionPlans.id, +req.params.id));
  let _owns = false;
  try { _owns = !ex ? false : await ownsClient(ex.clientId, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e) }); }
  if (!ex || !_owns) return res.status(404).json({ message: "Not found" });
  const body = req.body;
  const [u] = await db.update(pensionPlans).set({
    pensionType: body.pensionType,
    employerName: body.employerName || null,
    accrualRate: body.accrualRate || null,
    yearsOfService: body.yearsOfService || null,
    projectedYearsAtRetirement: body.projectedYearsAtRetirement || null,
    bestAverageEarnings: body.bestAverageEarnings || null,
    currentBalance: body.currentBalance || null,
    employerMatchPct: body.employerMatchPct || null,
    retirementAge: body.retirementAge || 65,
    indexingType: body.indexingType || "none",
    indexingRate: body.indexingRate || null,
    bridgeBenefit: body.bridgeBenefit || null,
    bridgeBenefitEndAge: body.bridgeBenefitEndAge || 65,
    survivorBenefitPct: body.survivorBenefitPct != null && body.survivorBenefitPct !== "" ? body.survivorBenefitPct : null,
    isVested: body.isVested ?? true,
    subscriberOwner: body.subscriberOwner || "primary",
    notes: body.notes || null,
    updatedAt: new Date(),
  } as any).where(eq(pensionPlans.id, ex.id)).returning();
  res.json(u);
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.delete("/pensions/:id", async (req: AuthRequest, res: Response) => {
  try {
  const [ex] = await db.select({ id: pensionPlans.id, clientId: pensionPlans.clientId })
    .from(pensionPlans).where(eq(pensionPlans.id, +req.params.id));
  let _owns = false;
  try { _owns = !ex ? false : await ownsClient(ex.clientId, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e) }); }
  if (!ex || !_owns) return res.status(404).json({ message: "Not found" });
  await db.delete(pensionPlans).where(eq(pensionPlans.id, ex.id));
  res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

export { r as pensionRouter };
