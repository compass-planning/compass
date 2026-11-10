import type { Express } from "express";
import { _createServer, type Server } from "http";
import _express from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { storage, ALL_COMPANIES } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { registerOutlookRoutes } from "./outlook-routes";
import { registerBotRoutes } from "./teams-bot/bot-routes";
import { registerEmailRoutes } from "./email/email-routes";
import { registerZoomRoutes } from "./zoom/zoom-routes";
import { companies, hostUsers, hostStaff } from "@shared/schema";
import { enforcePasswordChanged, denyHostUsers, getStaffFromSession } from "./routes/middleware";
import { registerMfaRoutes } from "./auth/mfa-routes";
import { staffRouter }         from "./routes/staff";
import { clientsRouter }       from "./routes/clients";
import { meetingsRouter }      from "./routes/meetings";
import { carriersRouter }      from "./routes/carriers";
import { plansRouter }         from "./routes/plans";
import { financialRouter }      from "./routes/financial";
import { searchRouter }         from "./routes/search";
import aiVoiceRouter             from "./routes/ai-voice";
import { reportsRouter }       from "./routes/reports";
import { simulateRouter }      from "./routes/simulate";
import { taxFpRouter }         from "./routes/tax";
import { goalsRouter }         from "./routes/goals";
import { pensionRouter }       from "./routes/pension";
import { lettersRouter }       from "./routes/letters";
import { aiReportRouter }     from "./routes/ai-report";
import { usTaxRouter }        from "./routes/us-tax";
import { incomeRouter }       from "./routes/income";
import { diLtcRouter }        from "./routes/di-ltc";

import { pipelineRouter }      from "./routes/pipeline";
import { companyRouter }       from "./routes/company";
import { marketRouter }        from "./routes/market";
import { notificationsRouter } from "./routes/notifications";
import { hostRouter }          from "./routes/host";
import { tasksRouter }         from "./routes/tasks";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);

  // Make the authenticated staff id available to every handler. The FP routers
  // (goals, pensions, letters, simulate, ai-report) read req.userId for ownership
  // checks; without this they fail closed (404 everything). Host users have no
  // staffId, so req.userId stays undefined for them — and ownsClient rejects it.
  app.use((req: any, _res, next) => { req.userId = req.session?.staffId; next(); });

  registerAuthRoutes(app);
  registerMfaRoutes(app);
  registerOutlookRoutes(app);
  registerBotRoutes(app);
  registerEmailRoutes(app);
  registerZoomRoutes(app);

  app.use("/api", enforcePasswordChanged);
  app.use("/api/staff",    isAuthenticated, denyHostUsers);
  app.use("/api/clients",  isAuthenticated, denyHostUsers);
  app.use("/api/leads",    isAuthenticated, denyHostUsers);
  app.use("/api/company",  isAuthenticated, denyHostUsers);
  app.use("/api/dashboard",isAuthenticated, denyHostUsers);

  app.use(staffRouter);
  app.use(clientsRouter);
  app.use(carriersRouter);
  app.use("/api/leads",          pipelineRouter);
  app.use(companyRouter);
  app.use("/api/market",         marketRouter);
  app.use("/api/notifications",  isAuthenticated, denyHostUsers, notificationsRouter);
  app.use("/api/tasks",          isAuthenticated, denyHostUsers, tasksRouter);
  app.use("/api/host",           hostRouter);

  app.use(meetingsRouter);
  app.use(plansRouter);

  // ── AI voice endpoints ────────────────────────────────────────────────────
  app.use("/api/ai", isAuthenticated, denyHostUsers, aiVoiceRouter);

  // ── Global search ────────────────────────────────────────────────────────
  app.use(searchRouter);


  // ── Financial Planning Suite routes ──────────────────────────────────
  app.use("/api", isAuthenticated, denyHostUsers, financialRouter);
  app.use("/api/reports", isAuthenticated, denyHostUsers, reportsRouter);
  app.use("/api", isAuthenticated, denyHostUsers, simulateRouter);
  app.use("/api", isAuthenticated, denyHostUsers, taxFpRouter);
  app.use("/api", isAuthenticated, denyHostUsers, goalsRouter);
  app.use("/api", isAuthenticated, denyHostUsers, pensionRouter);
  app.use("/api", isAuthenticated, denyHostUsers, lettersRouter);
  app.use("/api", isAuthenticated, denyHostUsers, aiReportRouter);
  app.use("/api/us-tax", isAuthenticated, denyHostUsers, usTaxRouter);
  app.use("/api", isAuthenticated, denyHostUsers, diLtcRouter);
  app.use("/api", isAuthenticated, denyHostUsers, incomeRouter);

  app.post("/api/admin/seed-reference-data", isAuthenticated, async (req: any, res) => {
    if (req.session?.userType === "host") {
      const hostUser = await storage.getHostUser(req.session.hostUserId);
      if (!hostUser || !hostUser.roles.includes("admin")) {
        return res.status(403).json({ message: "Only host admins can seed reference data" });
      }
    } else {
      const member = await getStaffFromSession(req);
      if (!member || member.role !== "general_manager") {
        return res.status(403).json({ message: "Only general managers or host admins can seed reference data" });
      }
    }
    try {
      await seedReferenceData();
      res.json({ message: "Reference data seeded successfully" });
    } catch (err: unknown) {
      res.status(500).json({ message: `Failed to seed reference data: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  });

  seedCarriers();
  migrateOldPlans();
  seedHostSuperAdmin();
  seedDatabase();
  seedReferenceData().catch(err => console.error("Failed to seed reference data:", err));

  return httpServer;
}

async function seedCarriers() {
  const existing = await storage.getCarriers();
  if (existing.length > 0) return;

  const carriers: { name: string; type: string }[] = [
    { name: "Manulife", type: "insurance" },
    { name: "Sun Life", type: "insurance" },
    { name: "Canada Life", type: "insurance" },
    { name: "Great-West Life", type: "insurance" },
    { name: "Desjardins Insurance", type: "insurance" },
    { name: "Industrial Alliance (iA)", type: "insurance" },
    { name: "Equitable Life", type: "insurance" },
    { name: "Empire Life", type: "insurance" },
    { name: "Beneva", type: "insurance" },
    { name: "RBC Insurance", type: "insurance" },
    { name: "TD Insurance", type: "insurance" },
    { name: "BMO Insurance", type: "insurance" },
    { name: "Foresters Financial", type: "insurance" },
    { name: "Assumption Life", type: "insurance" },
    { name: "Humania", type: "insurance" },
    { name: "Manulife Investments", type: "mutual_fund" },
    { name: "Sun Life Global Investments", type: "mutual_fund" },
    { name: "Fidelity Investments Canada", type: "mutual_fund" },
    { name: "CI Global Asset Management", type: "mutual_fund" },
    { name: "AGF Investments", type: "mutual_fund" },
    { name: "Mackenzie Investments", type: "mutual_fund" },
    { name: "Dynamic Funds", type: "mutual_fund" },
    { name: "RBC Global Asset Management", type: "mutual_fund" },
    { name: "TD Asset Management", type: "mutual_fund" },
    { name: "BMO Global Asset Management", type: "mutual_fund" },
    { name: "Franklin Templeton Canada", type: "mutual_fund" },
    { name: "Invesco Canada", type: "mutual_fund" },
    { name: "PIMCO Canada", type: "mutual_fund" },
    { name: "Capital Group Canada", type: "mutual_fund" },
    { name: "IG Wealth Management", type: "mutual_fund" },
    { name: "Manulife Segregated Funds", type: "segregated_fund" },
    { name: "Sun Life Segregated Funds", type: "segregated_fund" },
    { name: "Canada Life Segregated Funds", type: "segregated_fund" },
    { name: "Desjardins Segregated Funds", type: "segregated_fund" },
    { name: "Industrial Alliance (iA) Seg Funds", type: "segregated_fund" },
    { name: "Equitable Life Seg Funds", type: "segregated_fund" },
    { name: "Empire Life Seg Funds", type: "segregated_fund" },
    { name: "Beneva Seg Funds", type: "segregated_fund" },
    { name: "BMO Segregated Funds", type: "segregated_fund" },
    { name: "RBC Segregated Funds", type: "segregated_fund" },
  ];

  for (const c of carriers) await storage.createCarrier(c);
  console.log(`Seeded ${carriers.length} carriers`);
}

async function migrateOldPlans() {
  try {
    const oldPlans = await db.select().from(companies);
    for (const c of oldPlans) {
      if (c.plan === "team") {
        await db.update(companies).set({ plan: "standard" }).where(eq(companies.id, c.id));
        console.log(`Migrated company ${c.id} from "team" to "standard"`);
      } else if (c.plan === "enterprise") {
        await db.update(companies).set({ plan: "platinum" }).where(eq(companies.id, c.id));
        console.log(`Migrated company ${c.id} from "enterprise" to "platinum"`);
      }
    }
  } catch (err) {
    console.error("Plan migration error:", err);
  }
}

async function seedHostSuperAdmin() {
  try {
    const existing = await db.select().from(hostUsers);
    if (existing.length > 0) return;

    const seedPassword = process.env.HOST_SUPERADMIN_PASSWORD;
    const seedEmail = process.env.HOST_SUPERADMIN_EMAIL;
    if (!seedPassword || !seedEmail) {
      console.warn(
        "[seed] No host users present and HOST_SUPERADMIN_EMAIL / " +
        "HOST_SUPERADMIN_PASSWORD not set — skipping super-admin seed. " +
        "Set both env vars to bootstrap the first host admin.",
      );
      return;
    }

    const passwordHash = await bcrypt.hash(seedPassword, 12);
    await db.insert(hostUsers).values({
      firstName: "Super", lastName: "Admin",
      email: seedEmail,
      passwordHash, roles: ["admin"], isActive: true,
    });
    await db.insert(hostStaff).values({
      firstName: "Super", lastName: "Admin",
      email: seedEmail,
      position: "CEO", department: "Executive", isActive: true,
    });
    console.log(`Seeded host super-admin: ${seedEmail}`);
  } catch (err) {
    console.error("Host super-admin seed error:", err);
  }
}

async function seedDatabase() {
  try {
    const existingStaff = await storage.getStaffMembers(ALL_COMPANIES);
    if (existingStaff.length > 0) return;
    console.log("Seeding database...");

    const company = await storage.createCompany({ name: "Compass CRM Demo" });

    const _gm = await storage.createStaffMember({
      firstName: "Sarah", lastName: "Mitchell",
      email: "sarah.mitchell@finadvisor.com", role: "general_manager",
      companyId: company.id, phone: "(416) 555-0100",
      address: "100 Bay St, Suite 2000, Toronto, ON M5J 2T3",
    });

    const adminUser = await storage.createStaffMember({
      firstName: "Robert", lastName: "Chen",
      email: "robert.chen@finadvisor.com", role: "advisor_admin",
      companyId: company.id, phone: "(416) 555-0200",
      address: "200 King St W, Toronto, ON M5H 1K4",
    });

    const salesMgr = await storage.createStaffMember({
      firstName: "David", lastName: "Kim",
      email: "david.kim@finadvisor.com", role: "sales_manager",
      companyId: company.id, phone: "(416) 555-0300",
    });

    const advisor1 = await storage.createStaffMember({
      firstName: "Michael", lastName: "Torres",
      email: "michael.torres@finadvisor.com", role: "advisor",
      companyId: company.id, phone: "(416) 555-0400",
      personalEmail: "mtorres.personal@gmail.com",
    });

    const advisor2 = await storage.createStaffMember({
      firstName: "Lisa", lastName: "Patel",
      email: "lisa.patel@finadvisor.com", role: "advisor",
      companyId: company.id, phone: "(416) 555-0500",
    });

    await storage.createAdvisorAssignment({ adminId: adminUser.id, advisorId: advisor1.id });
    await storage.createAdvisorAssignment({ adminId: adminUser.id, advisorId: advisor2.id });
    await storage.createAdvisorAssignment({ adminId: salesMgr.id, advisorId: advisor1.id });

    const client1 = await storage.createClient({
      advisorId: advisor1.id, firstName: "John", lastName: "Doe",
      email: "john.doe@example.com", phone: "(555) 123-4567", cell: "(555) 123-0001",
      workPhone: "(555) 800-1234", workEmail: "john.doe@acmecorp.com",
      address: "123 Main St, Cityville, ON L5A 1X2", dateOfBirth: "1978-06-15",
      maritalStatus: "married", preferredContact: "cell",
      employerName: "Acme Corporation", pensionPlan: "defined_benefit", yearsAtJob: 12,
      notes: "Interested in retiring early. Moderate risk tolerance.",
    });

    await storage.createProduct({ clientId: client1.id, type: "insurance", provider: "Manulife", policyNumber: "ML-987654", value: "500000.00", status: "active" });
    await storage.createProduct({ clientId: client1.id, type: "mutual_fund", provider: "Fidelity", policyNumber: "FID-1234", value: "150000.00", status: "active" });
    await storage.createMeeting({ clientId: client1.id, title: "Initial Consultation", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), summary: "Discussed overall financial goals. Client wants to focus on building a robust retirement portfolio." });
    await storage.createPlan({ clientId: client1.id, title: "Retirement Strategy 2024", goalAmount: "1500000.00", targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 15)).toISOString().split("T")[0], riskTolerance: "medium", notes: "Balanced portfolio with a mix of equities and fixed income." });

    const client1Spouse = await storage.createClient({
      advisorId: advisor1.id, firstName: "Mary", lastName: "Doe",
      email: "mary.doe@example.com", phone: "(555) 123-4568", cell: "(555) 123-0002",
      address: "123 Main St, Cityville, ON L5A 1X2", dateOfBirth: "1980-03-22",
      maritalStatus: "married", preferredContact: "email", spouseId: client1.id,
      employerName: "City General Hospital", pensionPlan: "rrsp_matching", yearsAtJob: 8,
      notes: "Joint planning with spouse John.",
    });
    await storage.updateClient(client1.id, { spouseId: client1Spouse.id });

    await storage.createChild({ clientId: client1.id, name: "Emily Doe", dateOfBirth: "2010-09-14", sex: "female" });
    await storage.createChild({ clientId: client1.id, name: "Jacob Doe", dateOfBirth: "2013-02-05", sex: "male" });

    const client2 = await storage.createClient({
      advisorId: advisor2.id, firstName: "Jane", lastName: "Smith",
      email: "jane.smith@example.com", phone: "(555) 987-6543", cell: "(555) 987-0001",
      workPhone: "(555) 900-5678", workEmail: "j.smith@smithenterprises.com",
      address: "456 Oak Ave, Townsburg, ON M4C 3T1", dateOfBirth: "1985-11-30",
      maritalStatus: "single", preferredContact: "work_email",
      employerName: "Smith Enterprises", pensionPlan: "non_contributory", yearsAtJob: 15,
      notes: "Business owner. High risk tolerance.",
    });
    await storage.createProduct({ clientId: client2.id, type: "segregated_fund", provider: "Sun Life", policyNumber: "SL-5678", value: "250000.00", status: "active" });

    await storage.createDocument({ clientId: client1.id, title: "Initial Intake Assessment", documentType: "initial_intake", description: "Comprehensive intake form covering financial goals and risk profile.", signedDate: "2024-01-15", status: "signed" });
    await storage.createDocument({ clientId: client1.id, title: "KYC Form - 2025 Update", documentType: "kyc_form", description: "Annual Know Your Client update.", signedDate: "2025-03-10", status: "signed" });
    await storage.createDocument({ clientId: client1.id, title: "Beneficiary Change Request", documentType: "beneficiary_change", description: "Updating primary beneficiary to spouse Mary Doe.", signedDate: null, status: "pending" });
    await storage.createDocument({ clientId: client2.id, title: "Business Owner Disclosure", documentType: "disclosure", description: "Disclosure regarding business ownership and potential conflicts.", signedDate: "2024-06-20", status: "signed" });

    await storage.createActivity({ clientId: client1.id, activityType: "phone_call", title: "Discussed portfolio rebalancing", description: "John expressed interest in shifting allocation toward more conservative options as retirement approaches.", date: new Date("2026-03-01T14:30:00"), duration: 25, staffId: advisor1.id });
    await storage.createActivity({ clientId: client1.id, activityType: "email", title: "Sent updated beneficiary forms", description: "Emailed beneficiary change forms for John to review and sign.", date: new Date("2026-03-05T09:15:00"), duration: null, staffId: advisor1.id });
    await storage.createActivity({ clientId: client1.id, activityType: "appointment", title: "Annual review meeting", description: "Comprehensive annual review covering all products, beneficiaries, and retirement timeline.", date: new Date("2026-02-15T10:00:00"), duration: 60, staffId: advisor1.id });
    await storage.createActivity({ clientId: client2.id, activityType: "phone_call", title: "Follow-up on seg fund performance", description: "Jane inquired about recent segregated fund returns and potential alternatives.", date: new Date("2026-03-08T16:00:00"), duration: 15, staffId: advisor2.id });

    console.log("Seeding complete.");
  } catch (e) {
    console.error("Error seeding database:", e);
  }
}

async function seedReferenceData() {
  try {
    let brackets = await storage.getTaxBrackets(2024);
    let rates = await storage.getGovernmentBenefitRates(2024);

    if (brackets.length === 0) {
      const {
        FEDERAL_TAX_BRACKETS_2024, ONTARIO_TAX_BRACKETS_2024,
        BC_TAX_BRACKETS_2024, ALBERTA_TAX_BRACKETS_2024, QUEBEC_TAX_BRACKETS_2024,
      } = await import("./engine/reference/taxBrackets");

      brackets = await storage.bulkInsertTaxBrackets(
        [...FEDERAL_TAX_BRACKETS_2024, ...ONTARIO_TAX_BRACKETS_2024,
         ...BC_TAX_BRACKETS_2024, ...ALBERTA_TAX_BRACKETS_2024, ...QUEBEC_TAX_BRACKETS_2024]
        .map(b => ({
          province: b.province,
          minIncome: String(b.minIncome),
          maxIncome: b.maxIncome !== null ? String(b.maxIncome) : null,
          rate: String(b.rate),
          effectiveYear: b.effectiveYear,
        }))
      );
      console.log(`Seeded ${brackets.length} tax brackets.`);
    }

    if (rates.length === 0) {
      const { BENEFIT_RATES_2024, RRIF_MINIMUM_FACTORS } = await import("./engine/reference/benefitRates");

      const rateRows = BENEFIT_RATES_2024.map(r => ({
        rateKey: r.key, label: r.label, value: String(r.value),
        category: r.category, effectiveYear: r.effectiveYear,
      }));
      const rrifRows = Object.entries(RRIF_MINIMUM_FACTORS).map(([age, factor]) => ({
        rateKey: `rrif_min_factor_${age}`,
        label: `RRIF Minimum Factor Age ${age}`,
        value: String(factor), category: "rrif", effectiveYear: 2024,
      }));

      rates = await storage.bulkInsertGovernmentBenefitRates([...rateRows, ...rrifRows]);
      console.log(`Seeded ${rates.length} government benefit rates.`);
    }

    const { loadReferenceDataFromDb } = await import("./engine/reference/loader");
    loadReferenceDataFromDb(brackets, rates);
    console.log("Reference data loaded into memory cache from database.");
  } catch (err) {
    console.error("Error seeding reference data:", err);
    throw err;
  }
}
