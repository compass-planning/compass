import { Router } from "express";
import { isAuthenticated } from "../auth";
import { getCompanyId } from "./middleware";
import { db } from "../db";
import { clients, ltcAnalyses, diAnalyses } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { runLTCEngine }  from "../engine/ltcEngine";
import { runDIEngine }   from "../engine/diEngine";
import type { LTCInput } from "../engine/ltcEngine";
import type { DIInput }  from "../engine/diEngine";

export const diLtcRouter = Router();
diLtcRouter.use(isAuthenticated);

async function clientInCompany(req: any, clientId: number): Promise<boolean> {
  const companyId = await getCompanyId(req);
  if (!companyId) return false;
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
  return !!c;
}

// ═══ LTC Analyses ════════════════════════════════════════════════════════════

diLtcRouter.get("/clients/:id/ltc-analyses", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const rows = await db.select().from(ltcAnalyses).where(eq(ltcAnalyses.clientId, clientId));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

diLtcRouter.post("/clients/:id/ltc-analyses", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const body = req.body as Partial<LTCInput> & { label?: string; notes?: string };
    const engineInput: LTCInput = {
      currentAge:          Number(body.currentAge          ?? 55),
      province:            String(body.province            ?? "ON"),
      dailyBenefit:        Number(body.dailyBenefit        ?? 200),
      poolYears:           Number(body.poolYears           ?? 5) as any,
      eliminationDays:     Number(body.eliminationDays     ?? 90) as any,
      inflationProtection: String(body.inflationProtection ?? "none") as any,
      estAnnualPremium:    body.estAnnualPremium != null ? Number(body.estAnnualPremium) : undefined,
      careCostInflation:   Number(body.careCostInflation   ?? 0.04),
      estClaimAge:         Number(body.estClaimAge         ?? 80),
      careLevel:           String(body.careLevel           ?? "semi_private") as any,
      hybridLifeBenefit:   body.hybridLifeBenefit != null ? Number(body.hybridLifeBenefit) : undefined,
      hybridLtcPct:        body.hybridLtcPct      != null ? Number(body.hybridLtcPct)      : undefined,
    };
    const result = runLTCEngine(engineInput);
    const [row] = await (db.insert(ltcAnalyses) as any).values({
      clientId,
      person:              body.person            ?? "primary",
      label:               body.label             ?? null,
      currentAge:          engineInput.currentAge,
      province:            engineInput.province,
      dailyBenefit:        String(engineInput.dailyBenefit),
      poolYears:           engineInput.poolYears,
      eliminationDays:     engineInput.eliminationDays,
      inflationProtection: engineInput.inflationProtection,
      estAnnualPremium:    engineInput.estAnnualPremium ? String(engineInput.estAnnualPremium) : null,
      careCostInflation:   String(engineInput.careCostInflation),
      estClaimAge:         engineInput.estClaimAge,
      careLevel:           engineInput.careLevel,
      hybridLifeBenefit:   engineInput.hybridLifeBenefit ? String(engineInput.hybridLifeBenefit) : null,
      hybridLtcPct:        engineInput.hybridLtcPct      ? String(engineInput.hybridLtcPct)      : null,
      notes:               body.notes ?? null,
      resultData:          result,
    }).returning();
    res.json(row);
  } catch (e: any) { console.error("[ltc post]", e?.message); res.status(500).json({ error: e?.message }); }
});

diLtcRouter.patch("/clients/:id/ltc-analyses/:aid", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const aid      = parseInt(req.params.aid);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const body = req.body;
    const result = runLTCEngine(body);
    const [row] = await (db.update(ltcAnalyses) as any)
      .set({ ...body, resultData: result, updatedAt: new Date() })
      .where(eq(ltcAnalyses.id, aid))
      .returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

diLtcRouter.delete("/clients/:id/ltc-analyses/:aid", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const aid      = parseInt(req.params.aid);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    await db.delete(ltcAnalyses).where(eq(ltcAnalyses.id, aid));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

// ═══ DI Analyses ═════════════════════════════════════════════════════════════

diLtcRouter.get("/clients/:id/di-analyses", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const rows = await db.select().from(diAnalyses).where(eq(diAnalyses.clientId, clientId));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

diLtcRouter.post("/clients/:id/di-analyses", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const body = req.body as Partial<DIInput> & { label?: string; notes?: string };
    const engineInput: DIInput = {
      grossMonthlyIncome:    Number(body.grossMonthlyIncome    ?? 0),
      occupationClass:       String(body.occupationClass       ?? "3A") as any,
      definition:            String(body.definition            ?? "own_occ") as any,
      waitingPeriodDays:     Number(body.waitingPeriodDays     ?? 90),
      benefitPeriod:         String(body.benefitPeriod         ?? "age65") as any,
      groupDiMonthly:        Number(body.groupDiMonthly        ?? 0),
      groupDiEmployerPaid:   Boolean(body.groupDiEmployerPaid  ?? true),
      individualDiMonthly:   Number(body.individualDiMonthly   ?? 0),
      cppDisabilityMonthly:  Number(body.cppDisabilityMonthly  ?? 0),
      partialDisabilityPct:  Number(body.partialDisabilityPct  ?? 0.5),
      colaPct:               Number(body.colaPct               ?? 0.02),
      province:              String(body.province              ?? "ON"),
      currentAge:            Number(body.currentAge            ?? 40),
    };
    const result = runDIEngine(engineInput);
    const [row] = await (db.insert(diAnalyses) as any).values({
      clientId,
      person:               body.person              ?? "primary",
      label:                body.label               ?? null,
      grossMonthlyIncome:   String(engineInput.grossMonthlyIncome),
      occupationClass:      engineInput.occupationClass,
      definition:           engineInput.definition,
      waitingPeriodDays:    engineInput.waitingPeriodDays,
      benefitPeriod:        engineInput.benefitPeriod,
      groupDiMonthly:       String(engineInput.groupDiMonthly),
      groupDiEmployerPaid:  engineInput.groupDiEmployerPaid,
      individualDiMonthly:  String(engineInput.individualDiMonthly),
      cppDisabilityMonthly: String(engineInput.cppDisabilityMonthly),
      partialDisabilityPct: String(engineInput.partialDisabilityPct),
      colaPct:              String(engineInput.colaPct),
      province:             engineInput.province,
      notes:                body.notes ?? null,
      resultData:           result,
    }).returning();
    res.json(row);
  } catch (e: any) { console.error("[di post]", e?.message); res.status(500).json({ error: e?.message }); }
});

diLtcRouter.patch("/clients/:id/di-analyses/:aid", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const aid      = parseInt(req.params.aid);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const body   = req.body;
    const result = runDIEngine(body);
    const [row]  = await (db.update(diAnalyses) as any)
      .set({ ...body, resultData: result, updatedAt: new Date() })
      .where(eq(diAnalyses.id, aid))
      .returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

diLtcRouter.delete("/clients/:id/di-analyses/:aid", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const aid      = parseInt(req.params.aid);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    await db.delete(diAnalyses).where(eq(diAnalyses.id, aid));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});
