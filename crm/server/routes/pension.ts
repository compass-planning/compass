import { Router, Response } from "express";
import { db } from "../db";
import { ownsClient } from "../fpUtils";
import { eq } from "drizzle-orm";
import { pensionPlans } from "@shared/schema";

const r = Router();

r.get("/clients/:id/pensions", async (req: any, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/pensions", async (req: any, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
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
});

r.patch("/pensions/:id", async (req: any, res: Response) => {
  const [ex] = await db.select({ id: pensionPlans.id, clientId: pensionPlans.clientId })
    .from(pensionPlans).where(eq(pensionPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
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
});

r.delete("/pensions/:id", async (req: any, res: Response) => {
  const [ex] = await db.select({ id: pensionPlans.id, clientId: pensionPlans.clientId })
    .from(pensionPlans).where(eq(pensionPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(pensionPlans).where(eq(pensionPlans.id, ex.id));
  res.json({ ok: true });
});

export { r as pensionRouter };
