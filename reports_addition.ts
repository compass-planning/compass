
// ── Helper: fetch all FP data ─────────────────────────────────────────────────
async function fetchClientFpData(clientId: number, userId: number) {
  const client = await getClient(clientId, userId);
  if (!client) return null;
  const [netWorth, insuranceList, debts, education, retirementList, taxNotesList, estateNotesList, expensesList, advisor] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, clientId)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, clientId)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId)),
    db.select().from(educationSavings).where(eq(educationSavings.clientId, clientId)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, clientId)),
    db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, clientId)),
    db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, clientId)),
    db.select().from(householdExpenses).where(eq(householdExpenses.clientId, clientId)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  return {
    client, netWorth, debts, education, expenses: expensesList,
    insurance: insuranceList[0] ?? null,
    retirement: retirementList[0] ?? null,
    taxNotes: taxNotesList, estateNotes: estateNotesList,
    advisor: advisor[0] ?? null,
  };
}

// GET /api/reports/:clientId/retirement
r.get("/:clientId/retirement", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateRetirementReport({ client: d.client, retirement: d.retirement, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance
r.get("/:clientId/insurance", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceReport({ client: d.client, insurance: d.insurance, products: [] });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/cash-flow
r.get("/:clientId/cash-flow", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateCashFlowReport({ client: d.client, expenses: d.expenses, retirement: d.retirement, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/asset-allocation
r.get("/:clientId/asset-allocation", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateAssetAllocationReport({ client: d.client, netWorth: d.netWorth, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/retirement-readiness
r.get("/:clientId/retirement-readiness", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateRetirementReadinessReport({ client: d.client, retirement: d.retirement, expenses: d.expenses, netWorth: d.netWorth, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/goal-status
r.get("/:clientId/goal-status", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateGoalStatusReport({ client: d.client, plans: [], education: d.education, retirement: d.retirement, netWorth: d.netWorth, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance-audit
r.get("/:clientId/insurance-audit", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceAuditReport({ client: d.client, insurance: d.insurance, products: [], netWorth: d.netWorth, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/estate-summary
r.get("/:clientId/estate-summary", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateEstateSummaryReport({ client: d.client, estateNotes: d.estateNotes, netWorth: d.netWorth, products: [], advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/tax-strategy
r.get("/:clientId/tax-strategy", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateTaxStrategyReport({ client: d.client, taxNotes: d.taxNotes, netWorth: d.netWorth, retirement: d.retirement, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/one-page
r.get("/:clientId/one-page", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateOnePagePlan({ client: d.client, netWorth: d.netWorth, retirement: d.retirement, insurance: d.insurance, plans: [], education: d.education, aiRecs: [], expenses: d.expenses, advisor: d.advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

