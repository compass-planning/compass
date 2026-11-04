import { db } from "./db";
import { encryptEmailConfig, decryptEmailConfig } from "./auth/emailCrypto";
import {
  companies,
  clients,
  children,
  documents,
  activities,
  products,
  meetings,
  meetingTranscripts,
  meetingOutputs,
  meetingTasks,
  meetingRecordingConsents,
  recordingChunks,
  financialPlans,
  staff,
  staffDocuments,
  staffChildren,
  advisorAssignments,
  leads,
  leadActivities,
  hostUsers,
  serviceCases,
  serviceCaseNotes,
  hostInvoices,
  hostPayables,
  hostStaff,
  tasks,
  notifications,
  carriers,
  advisorCarriers,
  netWorthEntries,
  retirementProjections,
  insuranceAnalyses,
  educationSavings,
  debtEntries,
  taxPlanningNotes,
  estatePlanningNotes,
  aiRecommendations,
  type InsertCompany,
  type Company,
  type UpdateCompanySettings,
  type InsertClient,
  type Client,
  type UpdateClientRequest,
  type InsertChild,
  type Child,
  type InsertDocument,
  type Document,
  type InsertActivity,
  type Activity,
  type InsertProduct,
  type Product,
  type InsertMeeting,
  type Meeting,
  type InsertMeetingTranscript,
  type MeetingTranscript,
  type InsertMeetingOutput,
  type MeetingOutput,
  type InsertMeetingTask,
  type MeetingTask,
  type InsertMeetingRecordingConsent,
  type MeetingRecordingConsent,
  type InsertRecordingChunk,
  type RecordingChunk,
  type InsertFinancialPlan,
  type FinancialPlan,
  type InsertStaffMember,
  type StaffMember,
  type InsertStaffDocument,
  type StaffDocument,
  type InsertStaffChild,
  type StaffChild,
  type InsertAdvisorAssignment,
  type AdvisorAssignment,
  type InsertLead,
  type Lead,
  type InsertLeadActivity,
  type LeadActivity,
  type HostUser,
  type InsertHostUser,
  type ServiceCase,
  type InsertServiceCase,
  type ServiceCaseNote,
  type InsertServiceCaseNote,
  type HostInvoice,
  type InsertHostInvoice,
  type HostPayable,
  type InsertHostPayable,
  type HostStaffMember,
  type InsertHostStaffMember,
  type Task,
  type InsertTask,
  type Notification,
  type InsertNotification,
  type Carrier,
  type InsertCarrier,
  type AdvisorCarrier,
  type InsertAdvisorCarrier,
  type NetWorthEntry,
  type InsertNetWorthEntry,
  type RetirementProjection,
  type InsertRetirementProjection,
  type InsuranceAnalysis,
  type InsertInsuranceAnalysis,
  type EducationSaving,
  type InsertEducationSaving,
  type DebtEntry,
  type InsertDebtEntry,
  type TaxPlanningNote,
  type InsertTaxPlanningNote,
  type EstatePlanningNote,
  type InsertEstatePlanningNote,
  estateAnalyses,
  type EstateAnalysis,
  type InsertEstateAnalysis,
  cashFlowBudgets,
  type CashFlowBudget,
  type InsertCashFlowBudget,
  type AiRecommendation,
  type InsertAiRecommendation,
  emailConfigurations,
  type EmailConfiguration,
  type InsertEmailConfiguration,
  carrierCredentials,
  carrierFileRequests,
  carrierFiles,
  type CarrierCredential,
  type InsertCarrierCredential,
  type CarrierFileRequest,
  type InsertCarrierFileRequest,
  type CarrierFile,
  type InsertCarrierFile,
  taxBrackets,
  governmentBenefitRates,
  type TaxBracketRecord,
  type InsertTaxBracket,
  type GovernmentBenefitRateRecord,
  type InsertGovernmentBenefitRate,
  planAssumptions,
  simulationResults,
  planSnapshots,
  planStaleFlags,
  planActionItems,
  type PlanAssumption,
  type InsertPlanAssumption,
  type SimulationResultRecord,
  type InsertSimulationResult,
  type PlanSnapshot,
  type InsertPlanSnapshot,
  type PlanStaleFlag,
  type InsertPlanStaleFlag,
  type PlanActionItem,
  type InsertPlanActionItem,
} from "@shared/schema";
import {
  eq,
  inArray,
  and,
  or,
  count,
  sql,
  desc,
  gte,
  isNull,
} from "drizzle-orm";

export interface IStorage {
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: UpdateCompanySettings): Promise<Company>;

  getStaffMembers(companyId?: number): Promise<StaffMember[]>;
  getStaffMember(id: number): Promise<StaffMember | undefined>;
  getStaffMemberByAuthId(authId: string): Promise<StaffMember | undefined>;
  createStaffMember(member: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(
    id: number,
    updates: Partial<InsertStaffMember>,
  ): Promise<StaffMember>;
  deleteStaffMember(id: number): Promise<void>;

  getStaffDocuments(staffId: number): Promise<StaffDocument[]>;
  createStaffDocument(doc: InsertStaffDocument): Promise<StaffDocument>;
  deleteStaffDocument(id: number): Promise<void>;

  getStaffChildren(staffId: number): Promise<StaffChild[]>;
  getStaffChild(id: number): Promise<StaffChild | undefined>;
  createStaffChild(child: InsertStaffChild): Promise<StaffChild>;
  updateStaffChild(
    id: number,
    updates: Partial<InsertStaffChild>,
  ): Promise<StaffChild>;
  deleteStaffChild(id: number): Promise<void>;

  getAdvisorAssignments(companyId?: number): Promise<AdvisorAssignment[]>;
  getAdvisorsByAdmin(adminId: number): Promise<StaffMember[]>;
  createAdvisorAssignment(
    assignment: InsertAdvisorAssignment,
  ): Promise<AdvisorAssignment>;
  deleteAdvisorAssignment(id: number): Promise<void>;

  getClients(companyId?: number): Promise<Client[]>;
  getClientsByAdvisor(advisorId: number): Promise<Client[]>;
  getClientsByAdvisors(advisorIds: number[]): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;

  getChildrenByClient(clientId: number): Promise<Child[]>;
  createChild(child: InsertChild): Promise<Child>;
  updateChild(id: number, updates: Partial<InsertChild>): Promise<Child>;
  deleteChild(id: number): Promise<void>;

  getDocumentsByClient(clientId: number): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(
    id: number,
    updates: Partial<InsertDocument>,
  ): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  getActivitiesByClient(clientId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;

  getProductsByClient(clientId: number): Promise<Product[]>;
  getProductsByClientIds(clientIds: number[]): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product>;

  getMeetingsByClient(clientId: number): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  getMeetingByRecallBotId(recallBotId: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, updates: Partial<InsertMeeting>): Promise<Meeting>;

  getMeetingTranscript(
    meetingId: number,
  ): Promise<MeetingTranscript | undefined>;
  createMeetingTranscript(
    transcript: InsertMeetingTranscript,
  ): Promise<MeetingTranscript>;

  getMeetingOutputs(meetingId: number): Promise<MeetingOutput | undefined>;
  createMeetingOutputs(outputs: InsertMeetingOutput): Promise<MeetingOutput>;
  updateMeetingOutputs(
    id: number,
    updates: Partial<InsertMeetingOutput>,
  ): Promise<MeetingOutput>;

  getMeetingTasks(meetingId: number): Promise<MeetingTask[]>;
  getMeetingTask(id: number): Promise<MeetingTask | undefined>;
  createMeetingTask(task: InsertMeetingTask): Promise<MeetingTask>;
  updateMeetingTask(
    id: number,
    updates: Partial<InsertMeetingTask>,
  ): Promise<MeetingTask>;

  getMeetingConsent(
    meetingId: number,
  ): Promise<MeetingRecordingConsent | undefined>;
  createMeetingConsent(
    consent: InsertMeetingRecordingConsent,
  ): Promise<MeetingRecordingConsent>;

  getRecordingChunks(meetingId: number): Promise<RecordingChunk[]>;
  createRecordingChunk(chunk: InsertRecordingChunk): Promise<RecordingChunk>;
  deleteRecordingChunks(meetingId: number): Promise<void>;

  getPlansByClient(clientId: number): Promise<FinancialPlan[]>;
  createPlan(plan: InsertFinancialPlan): Promise<FinancialPlan>;
  updatePlan(
    id: number,
    updates: Partial<InsertFinancialPlan>,
  ): Promise<FinancialPlan>;
  deletePlan(id: number): Promise<void>;

  getNetWorthEntries(clientId: number): Promise<NetWorthEntry[]>;
  createNetWorthEntry(entry: InsertNetWorthEntry): Promise<NetWorthEntry>;
  updateNetWorthEntry(
    id: number,
    updates: Partial<InsertNetWorthEntry>,
  ): Promise<NetWorthEntry>;
  deleteNetWorthEntry(id: number): Promise<void>;

  getRetirementProjections(clientId: number): Promise<RetirementProjection[]>;
  createRetirementProjection(
    projection: InsertRetirementProjection & {
      projectedBalance: string;
      shortfallSurplus: string;
      yearlyBreakdown: string;
    },
  ): Promise<RetirementProjection>;
  deleteRetirementProjection(id: number): Promise<void>;

  getInsuranceAnalyses(clientId: number): Promise<InsuranceAnalysis[]>;
  createInsuranceAnalysis(
    analysis: InsertInsuranceAnalysis & {
      recommendedLifeCoverage: string;
      lifeCoverageGap: string;
      recommendedDisabilityCoverage: string;
      disabilityCoverageGap: string;
      recommendedCriticalIllnessCoverage: string;
      criticalIllnessCoverageGap: string;
      analysisResults?: unknown;
      primaryNeed?: string;
      spouseNeed?: string;
      primaryNetNeed?: string;
      spouseNetNeed?: string;
    },
  ): Promise<InsuranceAnalysis>;
  deleteInsuranceAnalysis(id: number): Promise<void>;

  getEducationSavings(clientId: number): Promise<EducationSaving[]>;
  createEducationSaving(entry: InsertEducationSaving): Promise<EducationSaving>;
  updateEducationSaving(
    id: number,
    updates: Partial<InsertEducationSaving>,
  ): Promise<EducationSaving>;
  deleteEducationSaving(id: number): Promise<void>;

  getDebtEntries(clientId: number): Promise<DebtEntry[]>;
  createDebtEntry(entry: InsertDebtEntry): Promise<DebtEntry>;
  updateDebtEntry(
    id: number,
    updates: Partial<InsertDebtEntry>,
  ): Promise<DebtEntry>;
  deleteDebtEntry(id: number): Promise<void>;

  getTaxPlanningNotes(clientId: number): Promise<TaxPlanningNote[]>;
  createTaxPlanningNote(note: InsertTaxPlanningNote): Promise<TaxPlanningNote>;
  updateTaxPlanningNote(
    id: number,
    updates: Partial<InsertTaxPlanningNote>,
  ): Promise<TaxPlanningNote>;
  deleteTaxPlanningNote(id: number): Promise<void>;

  getEstatePlanningNotes(clientId: number): Promise<EstatePlanningNote[]>;
  createEstatePlanningNote(
    note: InsertEstatePlanningNote,
  ): Promise<EstatePlanningNote>;
  updateEstatePlanningNote(
    id: number,
    updates: Partial<InsertEstatePlanningNote>,
  ): Promise<EstatePlanningNote>;
  deleteEstatePlanningNote(id: number): Promise<void>;

  getEstateAnalyses(clientId: number): Promise<EstateAnalysis[]>;
  createEstateAnalysis(analysis: InsertEstateAnalysis): Promise<EstateAnalysis>;
  deleteEstateAnalysis(id: number): Promise<void>;

  getCashFlowBudgets(clientId: number): Promise<CashFlowBudget[]>;
  createCashFlowBudget(budget: InsertCashFlowBudget): Promise<CashFlowBudget>;
  deleteCashFlowBudget(id: number): Promise<void>;

  getAiRecommendations(clientId: number): Promise<AiRecommendation[]>;
  createAiRecommendation(
    rec: InsertAiRecommendation,
  ): Promise<AiRecommendation>;
  updateAiRecommendation(
    id: number,
    updates: Partial<InsertAiRecommendation>,
  ): Promise<AiRecommendation>;
  deleteAiRecommendation(id: number): Promise<void>;

  getLeads(companyId?: number): Promise<Lead[]>;
  getLeadsByAdvisor(advisorId: number): Promise<Lead[]>;
  getLeadsByAdvisors(advisorIds: number[]): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: number): Promise<void>;
  getLeadByConvertedClient(clientId: number): Promise<Lead | undefined>;

  getLeadActivities(leadId: number): Promise<LeadActivity[]>;
  getLeadActivity(id: number): Promise<LeadActivity | undefined>;
  createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity>;
  deleteLeadActivity(id: number): Promise<void>;

  getHostUserByAuthId(authId: string): Promise<HostUser | undefined>;
  getHostUsers(): Promise<HostUser[]>;
  getHostUser(id: number): Promise<HostUser | undefined>;
  createHostUser(user: InsertHostUser): Promise<HostUser>;
  updateHostUser(
    id: number,
    updates: Partial<InsertHostUser>,
  ): Promise<HostUser>;

  getAllCompanies(): Promise<Company[]>;

  getServiceCases(companyId?: number): Promise<ServiceCase[]>;
  getServiceCase(id: number): Promise<ServiceCase | undefined>;
  createServiceCase(c: InsertServiceCase): Promise<ServiceCase>;
  updateServiceCase(
    id: number,
    updates: Partial<InsertServiceCase>,
  ): Promise<ServiceCase>;

  getServiceCaseNotes(caseId: number): Promise<ServiceCaseNote[]>;
  createServiceCaseNote(note: InsertServiceCaseNote): Promise<ServiceCaseNote>;

  getHostInvoices(companyId?: number): Promise<HostInvoice[]>;
  getHostInvoice(id: number): Promise<HostInvoice | undefined>;
  createHostInvoice(invoice: InsertHostInvoice): Promise<HostInvoice>;
  updateHostInvoice(
    id: number,
    updates: Partial<InsertHostInvoice>,
  ): Promise<HostInvoice>;

  getHostPayables(): Promise<HostPayable[]>;
  createHostPayable(payable: InsertHostPayable): Promise<HostPayable>;
  updateHostPayable(
    id: number,
    updates: Partial<InsertHostPayable>,
  ): Promise<HostPayable>;

  getHostStaffMembers(): Promise<HostStaffMember[]>;
  createHostStaffMember(
    member: InsertHostStaffMember,
  ): Promise<HostStaffMember>;
  updateHostStaffMember(
    id: number,
    updates: Partial<InsertHostStaffMember>,
  ): Promise<HostStaffMember>;

  getHostAnalytics(): Promise<{
    totalCompanies: number;
    totalUsers: number;
    totalCases: number;
    totalRevenue: string;
  }>;

  getCarriers(): Promise<Carrier[]>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
  getAdvisorCarriers(
    staffId: number,
  ): Promise<(AdvisorCarrier & { carrier: Carrier })[]>;
  addAdvisorCarrier(data: InsertAdvisorCarrier): Promise<AdvisorCarrier>;
  removeAdvisorCarrier(staffId: number, carrierId: number): Promise<void>;
  bulkCreateProducts(products: InsertProduct[]): Promise<Product[]>;

  createTask(task: InsertTask): Promise<Task>;
  getTask(id: number): Promise<Task | undefined>;
  getTasksForStaff(staffId: number, companyId: number): Promise<Task[]>;
  updateTask(
    id: number,
    updates: Partial<InsertTask> & { completedAt?: Date | null },
  ): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  createNotification(notification: InsertNotification): Promise<Notification>;
  getUnreadNotifications(staffId: number): Promise<Notification[]>;
  getRecentNotifications(
    staffId: number,
    limit?: number,
  ): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markNotificationAsReadForRecipient(
    id: number,
    staffId: number,
  ): Promise<Notification | undefined>;
  markAllNotificationsAsRead(staffId: number): Promise<void>;
  getNotificationsSinceLastLogin(
    staffId: number,
    lastLoginAt: Date | null,
  ): Promise<Notification[]>;
  getUpcomingBirthdays(
    companyId: number,
    daysAhead?: number,
  ): Promise<
    {
      id: number;
      firstName: string;
      lastName: string;
      dateOfBirth: string | null;
    }[]
  >;
  updateStaffLastLogin(staffId: number): Promise<void>;

  getEmailConfiguration(
    staffId: number,
  ): Promise<EmailConfiguration | undefined>;
  getEmailConfigurationForHost(
    hostUserId: number,
  ): Promise<EmailConfiguration | undefined>;
  createEmailConfiguration(
    config: InsertEmailConfiguration,
  ): Promise<EmailConfiguration>;
  updateEmailConfiguration(
    id: number,
    updates: Partial<InsertEmailConfiguration>,
  ): Promise<EmailConfiguration>;
  deleteEmailConfiguration(id: number): Promise<void>;

  getCarrierCredentialsByCompany(
    companyId: number,
  ): Promise<CarrierCredential[]>;
  getCarrierCredential(id: number): Promise<CarrierCredential | undefined>;
  createCarrierCredential(
    cred: InsertCarrierCredential,
  ): Promise<CarrierCredential>;
  deleteCarrierCredential(id: number): Promise<void>;

  getCarrierFileRequestsByClient(
    clientId: number,
    companyId: number,
  ): Promise<CarrierFileRequest[]>;
  getCarrierFileRequest(id: number): Promise<CarrierFileRequest | undefined>;
  getCarrierFileRequestByIdAndCompany(
    id: number,
    companyId: number,
  ): Promise<CarrierFileRequest | undefined>;
  createCarrierFileRequest(
    req: InsertCarrierFileRequest,
  ): Promise<CarrierFileRequest>;
  updateCarrierFileRequest(
    id: number,
    updates: Partial<CarrierFileRequest>,
  ): Promise<CarrierFileRequest>;

  getCarrierFilesByRequest(requestId: number): Promise<CarrierFile[]>;
  getCarrierFilesByClient(
    clientId: number,
    companyId: number,
  ): Promise<CarrierFile[]>;
  getCarrierFile(id: number): Promise<CarrierFile | undefined>;
  getCarrierFileByIdAndCompany(
    id: number,
    companyId: number,
  ): Promise<CarrierFile | undefined>;
  createCarrierFile(file: InsertCarrierFile): Promise<CarrierFile>;

  getTaxBrackets(effectiveYear?: number): Promise<TaxBracketRecord[]>;
  bulkInsertTaxBrackets(
    brackets: InsertTaxBracket[],
  ): Promise<TaxBracketRecord[]>;
  clearTaxBrackets(effectiveYear: number): Promise<void>;

  getGovernmentBenefitRates(
    effectiveYear?: number,
  ): Promise<GovernmentBenefitRateRecord[]>;
  bulkInsertGovernmentBenefitRates(
    rates: InsertGovernmentBenefitRate[],
  ): Promise<GovernmentBenefitRateRecord[]>;
  clearGovernmentBenefitRates(effectiveYear: number): Promise<void>;

  getPlanAssumptions(planId: number): Promise<PlanAssumption[]>;
  getPlanAssumptionByScenario(
    planId: number,
    scenario: string,
  ): Promise<PlanAssumption | undefined>;
  upsertPlanAssumption(
    assumption: InsertPlanAssumption,
  ): Promise<PlanAssumption>;
  deletePlanAssumption(id: number): Promise<void>;

  getSimulationResults(planId: number): Promise<SimulationResultRecord[]>;
  getSimulationResultByModuleScenario(
    planId: number,
    module: string,
    scenario: string,
  ): Promise<SimulationResultRecord | undefined>;
  upsertSimulationResult(
    result: InsertSimulationResult,
  ): Promise<SimulationResultRecord>;
  deleteSimulationResults(planId: number): Promise<void>;

  getPlanSnapshots(planId: number): Promise<PlanSnapshot[]>;
  getPlanSnapshot(id: number): Promise<PlanSnapshot | undefined>;
  createPlanSnapshot(snapshot: InsertPlanSnapshot): Promise<PlanSnapshot>;

  getPlanStaleFlags(planId: number): Promise<PlanStaleFlag[]>;
  getUnresolvedStaleFlags(planId: number): Promise<PlanStaleFlag[]>;
  createPlanStaleFlag(flag: InsertPlanStaleFlag): Promise<PlanStaleFlag>;
  resolvePlanStaleFlag(id: number): Promise<PlanStaleFlag>;

  getPlanActionItems(planId: number): Promise<PlanActionItem[]>;
  createPlanActionItem(item: InsertPlanActionItem): Promise<PlanActionItem>;
  updatePlanActionItem(
    id: number,
    updates: Partial<InsertPlanActionItem>,
  ): Promise<PlanActionItem>;
  deletePlanActionItem(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(
    id: number,
    updates: UpdateCompanySettings,
  ): Promise<Company> {
    const [updated] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async getStaffMembers(companyId?: number): Promise<StaffMember[]> {
    if (companyId) {
      return await db
        .select()
        .from(staff)
        .where(eq(staff.companyId, companyId));
    }
    return await db.select().from(staff);
  }

  async getStaffMember(id: number): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staff).where(eq(staff.id, id));
    return member;
  }

  async getStaffMemberByAuthId(
    authId: string,
  ): Promise<StaffMember | undefined> {
    const [member] = await db
      .select()
      .from(staff)
      .where(eq(staff.authId, authId));
    return member;
  }

  async createStaffMember(member: InsertStaffMember): Promise<StaffMember> {
    const [newMember] = await db.insert(staff).values(member).returning();
    return newMember;
  }

  async updateStaffMember(
    id: number,
    updates: Partial<InsertStaffMember>,
  ): Promise<StaffMember> {
    const [updated] = await db
      .update(staff)
      .set(updates)
      .where(eq(staff.id, id))
      .returning();
    return updated;
  }

  async deleteStaffMember(id: number): Promise<void> {
    await db
      .delete(advisorAssignments)
      .where(eq(advisorAssignments.advisorId, id));
    await db
      .delete(advisorAssignments)
      .where(eq(advisorAssignments.adminId, id));
    await db.delete(staffDocuments).where(eq(staffDocuments.staffId, id));
    await db.delete(staffChildren).where(eq(staffChildren.staffId, id));
    await db.delete(staff).where(eq(staff.id, id));
  }

  async getStaffDocuments(staffId: number): Promise<StaffDocument[]> {
    return await db
      .select()
      .from(staffDocuments)
      .where(eq(staffDocuments.staffId, staffId));
  }

  async createStaffDocument(doc: InsertStaffDocument): Promise<StaffDocument> {
    const [newDoc] = await db.insert(staffDocuments).values(doc).returning();
    return newDoc;
  }

  async deleteStaffDocument(id: number): Promise<void> {
    await db.delete(staffDocuments).where(eq(staffDocuments.id, id));
  }

  async getStaffChildren(staffId: number): Promise<StaffChild[]> {
    return await db
      .select()
      .from(staffChildren)
      .where(eq(staffChildren.staffId, staffId));
  }

  async getStaffChild(id: number): Promise<StaffChild | undefined> {
    const [child] = await db
      .select()
      .from(staffChildren)
      .where(eq(staffChildren.id, id));
    return child;
  }

  async createStaffChild(child: InsertStaffChild): Promise<StaffChild> {
    const [newChild] = await db.insert(staffChildren).values(child).returning();
    return newChild;
  }

  async updateStaffChild(
    id: number,
    updates: Partial<InsertStaffChild>,
  ): Promise<StaffChild> {
    const [updated] = await db
      .update(staffChildren)
      .set(updates)
      .where(eq(staffChildren.id, id))
      .returning();
    return updated;
  }

  async deleteStaffChild(id: number): Promise<void> {
    await db.delete(staffChildren).where(eq(staffChildren.id, id));
  }

  async getAdvisorAssignments(
    companyId?: number,
  ): Promise<AdvisorAssignment[]> {
    if (companyId) {
      const companyStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.companyId, companyId));
      const staffIds = companyStaff.map((s) => s.id);
      if (staffIds.length === 0) return [];
      return await db
        .select()
        .from(advisorAssignments)
        .where(inArray(advisorAssignments.adminId, staffIds));
    }
    return await db.select().from(advisorAssignments);
  }

  async getAdvisorsByAdmin(adminId: number): Promise<StaffMember[]> {
    const assignments = await db
      .select()
      .from(advisorAssignments)
      .where(eq(advisorAssignments.adminId, adminId));
    if (assignments.length === 0) return [];
    const advisorIds = assignments.map((a) => a.advisorId);
    return await db.select().from(staff).where(inArray(staff.id, advisorIds));
  }

  async createAdvisorAssignment(
    assignment: InsertAdvisorAssignment,
  ): Promise<AdvisorAssignment> {
    const [newAssignment] = await db
      .insert(advisorAssignments)
      .values(assignment)
      .returning();
    return newAssignment;
  }

  async deleteAdvisorAssignment(id: number): Promise<void> {
    await db.delete(advisorAssignments).where(eq(advisorAssignments.id, id));
  }

  async getClients(companyId?: number): Promise<Client[]> {
    if (companyId) {
      return await db
        .select()
        .from(clients)
        .where(eq(clients.companyId, companyId));
    }
    return await db.select().from(clients);
  }

  async getClientsByAdvisor(advisorId: number): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.advisorId, advisorId));
  }

  async getClientsByAdvisors(advisorIds: number[]): Promise<Client[]> {
    if (advisorIds.length === 0) return [];
    return await db
      .select()
      .from(clients)
      .where(inArray(clients.advisorId, advisorIds));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(
    id: number,
    updates: UpdateClientRequest,
  ): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async getChildrenByClient(clientId: number): Promise<Child[]> {
    return await db
      .select()
      .from(children)
      .where(eq(children.clientId, clientId));
  }

  async createChild(child: InsertChild): Promise<Child> {
    const [newChild] = await db.insert(children).values(child).returning();
    return newChild;
  }

  async updateChild(id: number, updates: Partial<InsertChild>): Promise<Child> {
    const [updated] = await db
      .update(children)
      .set(updates)
      .where(eq(children.id, id))
      .returning();
    return updated;
  }

  async deleteChild(id: number): Promise<void> {
    await db.delete(children).where(eq(children.id, id));
  }

  async getDocumentsByClient(clientId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.clientId, clientId));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [newDoc] = await db.insert(documents).values(doc).returning();
    return newDoc;
  }

  async updateDocument(
    id: number,
    updates: Partial<InsertDocument>,
  ): Promise<Document> {
    const [updated] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getActivitiesByClient(clientId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.clientId, clientId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getProductsByClient(clientId: number): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.clientId, clientId));
  }

  async getProductsByClientIds(clientIds: number[]): Promise<Product[]> {
    if (clientIds.length === 0) return [];
    return await db
      .select()
      .from(products)
      .where(inArray(products.clientId, clientIds));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(
    id: number,
    updates: Partial<InsertProduct>,
  ): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async getMeetingsByClient(clientId: number): Promise<Meeting[]> {
    return await db
      .select()
      .from(meetings)
      .where(eq(meetings.clientId, clientId));
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id));
    return meeting;
  }

  async getMeetingByRecallBotId(
    recallBotId: string,
  ): Promise<Meeting | undefined> {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.recallBotId, recallBotId));
    return meeting;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [newMeeting] = await db.insert(meetings).values(meeting).returning();
    return newMeeting;
  }

  async updateMeeting(
    id: number,
    updates: Partial<InsertMeeting>,
  ): Promise<Meeting> {
    const [updated] = await db
      .update(meetings)
      .set(updates)
      .where(eq(meetings.id, id))
      .returning();
    return updated;
  }

  async getMeetingTranscript(
    meetingId: number,
  ): Promise<MeetingTranscript | undefined> {
    const [transcript] = await db
      .select()
      .from(meetingTranscripts)
      .where(eq(meetingTranscripts.meetingId, meetingId));
    return transcript;
  }

  async createMeetingTranscript(
    transcript: InsertMeetingTranscript,
  ): Promise<MeetingTranscript> {
    const [created] = await db
      .insert(meetingTranscripts)
      .values(transcript)
      .returning();
    return created;
  }

  async getMeetingOutputs(
    meetingId: number,
  ): Promise<MeetingOutput | undefined> {
    const [outputs] = await db
      .select()
      .from(meetingOutputs)
      .where(eq(meetingOutputs.meetingId, meetingId));
    return outputs;
  }

  async createMeetingOutputs(
    outputs: InsertMeetingOutput,
  ): Promise<MeetingOutput> {
    const [created] = await db
      .insert(meetingOutputs)
      .values(outputs)
      .returning();
    return created;
  }

  async updateMeetingOutputs(
    id: number,
    updates: Partial<InsertMeetingOutput>,
  ): Promise<MeetingOutput> {
    const [updated] = await db
      .update(meetingOutputs)
      .set(updates)
      .where(eq(meetingOutputs.id, id))
      .returning();
    return updated;
  }

  async getMeetingTasks(meetingId: number): Promise<MeetingTask[]> {
    return await db
      .select()
      .from(meetingTasks)
      .where(eq(meetingTasks.meetingId, meetingId));
  }

  async getMeetingTask(id: number): Promise<MeetingTask | undefined> {
    const [task] = await db
      .select()
      .from(meetingTasks)
      .where(eq(meetingTasks.id, id));
    return task;
  }

  async createMeetingTask(task: InsertMeetingTask): Promise<MeetingTask> {
    const [created] = await db.insert(meetingTasks).values(task).returning();
    return created;
  }

  async updateMeetingTask(
    id: number,
    updates: Partial<InsertMeetingTask>,
  ): Promise<MeetingTask> {
    const [updated] = await db
      .update(meetingTasks)
      .set(updates)
      .where(eq(meetingTasks.id, id))
      .returning();
    return updated;
  }

  async getMeetingConsent(
    meetingId: number,
  ): Promise<MeetingRecordingConsent | undefined> {
    const [consent] = await db
      .select()
      .from(meetingRecordingConsents)
      .where(eq(meetingRecordingConsents.meetingId, meetingId));
    return consent;
  }

  async createMeetingConsent(
    consent: InsertMeetingRecordingConsent,
  ): Promise<MeetingRecordingConsent> {
    const [created] = await db
      .insert(meetingRecordingConsents)
      .values(consent)
      .returning();
    return created;
  }

  async getRecordingChunks(meetingId: number): Promise<RecordingChunk[]> {
    return await db
      .select()
      .from(recordingChunks)
      .where(eq(recordingChunks.meetingId, meetingId))
      .orderBy(recordingChunks.chunkIndex);
  }

  async createRecordingChunk(
    chunk: InsertRecordingChunk,
  ): Promise<RecordingChunk> {
    const [created] = await db
      .insert(recordingChunks)
      .values(chunk)
      .returning();
    return created;
  }

  async deleteRecordingChunks(meetingId: number): Promise<void> {
    await db
      .delete(recordingChunks)
      .where(eq(recordingChunks.meetingId, meetingId));
  }

  async getPlansByClient(clientId: number): Promise<FinancialPlan[]> {
    return await db
      .select()
      .from(financialPlans)
      .where(eq(financialPlans.clientId, clientId));
  }

  async createPlan(plan: InsertFinancialPlan): Promise<FinancialPlan> {
    const [newPlan] = await db.insert(financialPlans).values(plan).returning();
    return newPlan;
  }

  async updatePlan(
    id: number,
    updates: Partial<InsertFinancialPlan>,
  ): Promise<FinancialPlan> {
    const [updated] = await db
      .update(financialPlans)
      .set(updates)
      .where(eq(financialPlans.id, id))
      .returning();
    return updated;
  }

  async deletePlan(id: number): Promise<void> {
    await db.delete(financialPlans).where(eq(financialPlans.id, id));
  }

  async getNetWorthEntries(clientId: number): Promise<NetWorthEntry[]> {
    return await db
      .select()
      .from(netWorthEntries)
      .where(eq(netWorthEntries.clientId, clientId));
  }

  async createNetWorthEntry(
    entry: InsertNetWorthEntry,
  ): Promise<NetWorthEntry> {
    const [newEntry] = await db
      .insert(netWorthEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateNetWorthEntry(
    id: number,
    updates: Partial<InsertNetWorthEntry>,
  ): Promise<NetWorthEntry> {
    const [updated] = await db
      .update(netWorthEntries)
      .set(updates)
      .where(eq(netWorthEntries.id, id))
      .returning();
    return updated;
  }

  async deleteNetWorthEntry(id: number): Promise<void> {
    await db.delete(netWorthEntries).where(eq(netWorthEntries.id, id));
  }

  async getRetirementProjections(
    clientId: number,
  ): Promise<RetirementProjection[]> {
    return await db
      .select()
      .from(retirementProjections)
      .where(eq(retirementProjections.clientId, clientId))
      .orderBy(retirementProjections.id);
  }

  async createRetirementProjection(
    projection: InsertRetirementProjection & {
      projectedBalance: string;
      shortfallSurplus: string;
      yearlyBreakdown: string;
    },
  ): Promise<RetirementProjection> {
    const [newProjection] = await db
      .insert(retirementProjections)
      .values(projection)
      .returning();
    return newProjection;
  }

  async deleteRetirementProjection(id: number): Promise<void> {
    await db
      .delete(retirementProjections)
      .where(eq(retirementProjections.id, id));
  }

  async getInsuranceAnalyses(clientId: number): Promise<InsuranceAnalysis[]> {
    return await db
      .select()
      .from(insuranceAnalyses)
      .where(eq(insuranceAnalyses.clientId, clientId));
  }

  async createInsuranceAnalysis(
    analysis: InsertInsuranceAnalysis & {
      recommendedLifeCoverage: string;
      lifeCoverageGap: string;
      recommendedDisabilityCoverage: string;
      disabilityCoverageGap: string;
      recommendedCriticalIllnessCoverage: string;
      criticalIllnessCoverageGap: string;
      analysisResults?: unknown;
      primaryNeed?: string;
      spouseNeed?: string;
      primaryNetNeed?: string;
      spouseNetNeed?: string;
    },
  ): Promise<InsuranceAnalysis> {
    const [newAnalysis] = await db
      .insert(insuranceAnalyses)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async deleteInsuranceAnalysis(id: number): Promise<void> {
    await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, id));
  }

  async getEducationSavings(clientId: number): Promise<EducationSaving[]> {
    return await db
      .select()
      .from(educationSavings)
      .where(eq(educationSavings.clientId, clientId));
  }

  async createEducationSaving(
    entry: InsertEducationSaving,
  ): Promise<EducationSaving> {
    const [created] = await db
      .insert(educationSavings)
      .values(entry)
      .returning();
    return created;
  }

  async updateEducationSaving(
    id: number,
    updates: Partial<InsertEducationSaving>,
  ): Promise<EducationSaving> {
    const [updated] = await db
      .update(educationSavings)
      .set(updates)
      .where(eq(educationSavings.id, id))
      .returning();
    return updated;
  }

  async deleteEducationSaving(id: number): Promise<void> {
    await db.delete(educationSavings).where(eq(educationSavings.id, id));
  }

  async getDebtEntries(clientId: number): Promise<DebtEntry[]> {
    return await db
      .select()
      .from(debtEntries)
      .where(eq(debtEntries.clientId, clientId));
  }

  async createDebtEntry(entry: InsertDebtEntry): Promise<DebtEntry> {
    const [created] = await db.insert(debtEntries).values(entry).returning();
    return created;
  }

  async updateDebtEntry(
    id: number,
    updates: Partial<InsertDebtEntry>,
  ): Promise<DebtEntry> {
    const [updated] = await db
      .update(debtEntries)
      .set(updates)
      .where(eq(debtEntries.id, id))
      .returning();
    return updated;
  }

  async deleteDebtEntry(id: number): Promise<void> {
    await db.delete(debtEntries).where(eq(debtEntries.id, id));
  }

  async getTaxPlanningNotes(clientId: number): Promise<TaxPlanningNote[]> {
    return await db
      .select()
      .from(taxPlanningNotes)
      .where(eq(taxPlanningNotes.clientId, clientId));
  }

  async createTaxPlanningNote(
    note: InsertTaxPlanningNote,
  ): Promise<TaxPlanningNote> {
    const [created] = await db
      .insert(taxPlanningNotes)
      .values(note)
      .returning();
    return created;
  }

  async updateTaxPlanningNote(
    id: number,
    updates: Partial<InsertTaxPlanningNote>,
  ): Promise<TaxPlanningNote> {
    const [updated] = await db
      .update(taxPlanningNotes)
      .set(updates)
      .where(eq(taxPlanningNotes.id, id))
      .returning();
    return updated;
  }

  async deleteTaxPlanningNote(id: number): Promise<void> {
    await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, id));
  }

  async getEstatePlanningNotes(
    clientId: number,
  ): Promise<EstatePlanningNote[]> {
    return await db
      .select()
      .from(estatePlanningNotes)
      .where(eq(estatePlanningNotes.clientId, clientId));
  }

  async createEstatePlanningNote(
    note: InsertEstatePlanningNote,
  ): Promise<EstatePlanningNote> {
    const [created] = await db
      .insert(estatePlanningNotes)
      .values(note)
      .returning();
    return created;
  }

  async updateEstatePlanningNote(
    id: number,
    updates: Partial<InsertEstatePlanningNote>,
  ): Promise<EstatePlanningNote> {
    const [updated] = await db
      .update(estatePlanningNotes)
      .set(updates)
      .where(eq(estatePlanningNotes.id, id))
      .returning();
    return updated;
  }

  async deleteEstatePlanningNote(id: number): Promise<void> {
    await db.delete(estatePlanningNotes).where(eq(estatePlanningNotes.id, id));
  }

  async getEstateAnalyses(clientId: number): Promise<EstateAnalysis[]> {
    return await db
      .select()
      .from(estateAnalyses)
      .where(eq(estateAnalyses.clientId, clientId));
  }

  async createEstateAnalysis(
    analysis: InsertEstateAnalysis,
  ): Promise<EstateAnalysis> {
    const [created] = await db
      .insert(estateAnalyses)
      .values(analysis)
      .returning();
    return created;
  }

  async deleteEstateAnalysis(id: number): Promise<void> {
    await db.delete(estateAnalyses).where(eq(estateAnalyses.id, id));
  }

  async getCashFlowBudgets(clientId: number): Promise<CashFlowBudget[]> {
    return await db
      .select()
      .from(cashFlowBudgets)
      .where(eq(cashFlowBudgets.clientId, clientId));
  }

  async createCashFlowBudget(
    budget: InsertCashFlowBudget,
  ): Promise<CashFlowBudget> {
    const [created] = await db
      .insert(cashFlowBudgets)
      .values(budget)
      .returning();
    return created;
  }

  async deleteCashFlowBudget(id: number): Promise<void> {
    await db.delete(cashFlowBudgets).where(eq(cashFlowBudgets.id, id));
  }

  async getAiRecommendations(clientId: number): Promise<AiRecommendation[]> {
    return await db
      .select()
      .from(aiRecommendations)
      .where(eq(aiRecommendations.clientId, clientId));
  }

  async createAiRecommendation(
    rec: InsertAiRecommendation,
  ): Promise<AiRecommendation> {
    const [created] = await db
      .insert(aiRecommendations)
      .values(rec)
      .returning();
    return created;
  }

  async updateAiRecommendation(
    id: number,
    updates: Partial<InsertAiRecommendation>,
  ): Promise<AiRecommendation> {
    const [updated] = await db
      .update(aiRecommendations)
      .set(updates)
      .where(eq(aiRecommendations.id, id))
      .returning();
    return updated;
  }

  async deleteAiRecommendation(id: number): Promise<void> {
    await db.delete(aiRecommendations).where(eq(aiRecommendations.id, id));
  }

  async getLeads(companyId?: number): Promise<Lead[]> {
    if (companyId) {
      return await db
        .select()
        .from(leads)
        .where(eq(leads.companyId, companyId));
    }
    return await db.select().from(leads);
  }

  async getLeadsByAdvisor(advisorId: number): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.advisorId, advisorId));
  }

  async getLeadsByAdvisors(advisorIds: number[]): Promise<Lead[]> {
    if (advisorIds.length === 0) return [];
    return await db
      .select()
      .from(leads)
      .where(inArray(leads.advisorId, advisorIds));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const now = new Date();
    const stageEntry = JSON.stringify([
      { stage: lead.stage || "lead", date: now.toISOString() },
    ]);
    const [newLead] = await db
      .insert(leads)
      .values({ ...lead, stageHistory: stageEntry, updatedAt: now })
      .returning();
    return newLead;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    const [updated] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: number): Promise<void> {
    await db.delete(leadActivities).where(eq(leadActivities.leadId, id));
    await db.delete(leads).where(eq(leads.id, id));
  }

  async getLeadByConvertedClient(clientId: number): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.convertedClientId, clientId));
    return lead;
  }

  async getLeadActivities(leadId: number): Promise<LeadActivity[]> {
    return await db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, leadId));
  }

  async getLeadActivity(id: number): Promise<LeadActivity | undefined> {
    const [activity] = await db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.id, id));
    return activity;
  }

  async createLeadActivity(
    activity: InsertLeadActivity,
  ): Promise<LeadActivity> {
    const [newActivity] = await db
      .insert(leadActivities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async deleteLeadActivity(id: number): Promise<void> {
    await db.delete(leadActivities).where(eq(leadActivities.id, id));
  }

  async getHostUserByAuthId(authId: string): Promise<HostUser | undefined> {
    const [user] = await db
      .select()
      .from(hostUsers)
      .where(eq(hostUsers.authId, authId));
    return user;
  }

  async getHostUsers(): Promise<HostUser[]> {
    return await db.select().from(hostUsers);
  }

  async getHostUser(id: number): Promise<HostUser | undefined> {
    const [user] = await db
      .select()
      .from(hostUsers)
      .where(eq(hostUsers.id, id));
    return user;
  }

  async createHostUser(user: InsertHostUser): Promise<HostUser> {
    const [newUser] = await db.insert(hostUsers).values(user).returning();
    return newUser;
  }

  async updateHostUser(
    id: number,
    updates: Partial<InsertHostUser>,
  ): Promise<HostUser> {
    const [updated] = await db
      .update(hostUsers)
      .set(updates)
      .where(eq(hostUsers.id, id))
      .returning();
    return updated;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getServiceCases(companyId?: number): Promise<ServiceCase[]> {
    if (companyId) {
      return await db
        .select()
        .from(serviceCases)
        .where(eq(serviceCases.companyId, companyId));
    }
    return await db.select().from(serviceCases);
  }

  async getServiceCase(id: number): Promise<ServiceCase | undefined> {
    const [c] = await db
      .select()
      .from(serviceCases)
      .where(eq(serviceCases.id, id));
    return c;
  }

  async createServiceCase(c: InsertServiceCase): Promise<ServiceCase> {
    const [newCase] = await db.insert(serviceCases).values(c).returning();
    return newCase;
  }

  async updateServiceCase(
    id: number,
    updates: Partial<InsertServiceCase>,
  ): Promise<ServiceCase> {
    const [updated] = await db
      .update(serviceCases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(serviceCases.id, id))
      .returning();
    return updated;
  }

  async getServiceCaseNotes(caseId: number): Promise<ServiceCaseNote[]> {
    return await db
      .select()
      .from(serviceCaseNotes)
      .where(eq(serviceCaseNotes.caseId, caseId));
  }

  async createServiceCaseNote(
    note: InsertServiceCaseNote,
  ): Promise<ServiceCaseNote> {
    const [newNote] = await db
      .insert(serviceCaseNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async getHostInvoices(companyId?: number): Promise<HostInvoice[]> {
    if (companyId) {
      return await db
        .select()
        .from(hostInvoices)
        .where(eq(hostInvoices.companyId, companyId));
    }
    return await db.select().from(hostInvoices);
  }

  async getHostInvoice(id: number): Promise<HostInvoice | undefined> {
    const [inv] = await db
      .select()
      .from(hostInvoices)
      .where(eq(hostInvoices.id, id));
    return inv;
  }

  async createHostInvoice(invoice: InsertHostInvoice): Promise<HostInvoice> {
    const [newInv] = await db.insert(hostInvoices).values(invoice).returning();
    return newInv;
  }

  async updateHostInvoice(
    id: number,
    updates: Partial<InsertHostInvoice>,
  ): Promise<HostInvoice> {
    const [updated] = await db
      .update(hostInvoices)
      .set(updates)
      .where(eq(hostInvoices.id, id))
      .returning();
    return updated;
  }

  async getHostPayables(): Promise<HostPayable[]> {
    return await db.select().from(hostPayables);
  }

  async createHostPayable(payable: InsertHostPayable): Promise<HostPayable> {
    const [newPay] = await db.insert(hostPayables).values(payable).returning();
    return newPay;
  }

  async updateHostPayable(
    id: number,
    updates: Partial<InsertHostPayable>,
  ): Promise<HostPayable> {
    const [updated] = await db
      .update(hostPayables)
      .set(updates)
      .where(eq(hostPayables.id, id))
      .returning();
    return updated;
  }

  async getHostStaffMembers(): Promise<HostStaffMember[]> {
    return await db.select().from(hostStaff);
  }

  async createHostStaffMember(
    member: InsertHostStaffMember,
  ): Promise<HostStaffMember> {
    const [newMember] = await db.insert(hostStaff).values(member).returning();
    return newMember;
  }

  async updateHostStaffMember(
    id: number,
    updates: Partial<InsertHostStaffMember>,
  ): Promise<HostStaffMember> {
    const [updated] = await db
      .update(hostStaff)
      .set(updates)
      .where(eq(hostStaff.id, id))
      .returning();
    return updated;
  }

  async getHostAnalytics(): Promise<{
    totalCompanies: number;
    totalUsers: number;
    totalCases: number;
    totalRevenue: string;
  }> {
    const [companyCount] = await db.select({ value: count() }).from(companies);
    const [userCount] = await db.select({ value: count() }).from(staff);
    const [caseCount] = await db.select({ value: count() }).from(serviceCases);
    const [revenue] = await db
      .select({
        value: sql<string>`coalesce(sum(${hostInvoices.amount}), '0')`,
      })
      .from(hostInvoices)
      .where(eq(hostInvoices.status, "paid"));
    return {
      totalCompanies: companyCount.value,
      totalUsers: userCount.value,
      totalCases: caseCount.value,
      totalRevenue: revenue.value,
    };
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksForStaff(staffId: number, companyId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.companyId, companyId),
          or(
            eq(tasks.visibility, "company"),
            eq(tasks.createdByStaffId, staffId),
            eq(tasks.assignedToStaffId, staffId),
          ),
        ),
      );
  }

  async updateTask(
    id: number,
    updates: Partial<InsertTask> & { completedAt?: Date | null },
  ): Promise<Task> {
    const [updated] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n;
  }

  async getUnreadNotifications(staffId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientStaffId, staffId),
          eq(notifications.isRead, false),
        ),
      )
      .orderBy(desc(notifications.createdAt));
  }

  async getRecentNotifications(
    staffId: number,
    limit = 50,
  ): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientStaffId, staffId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markNotificationAsReadForRecipient(
    id: number,
    staffId: number,
  ): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientStaffId, staffId),
        ),
      )
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(staffId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientStaffId, staffId),
          eq(notifications.isRead, false),
        ),
      );
  }

  async getNotificationsSinceLastLogin(
    staffId: number,
    lastLoginAt: Date | null,
  ): Promise<Notification[]> {
    if (!lastLoginAt) {
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientStaffId, staffId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientStaffId, staffId),
          gte(notifications.createdAt, lastLoginAt),
        ),
      )
      .orderBy(desc(notifications.createdAt));
  }

  async getUpcomingBirthdays(
    companyId: number,
    daysAhead = 7,
  ): Promise<
    {
      id: number;
      firstName: string;
      lastName: string;
      dateOfBirth: string | null;
    }[]
  > {
    const allClients = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        dateOfBirth: clients.dateOfBirth,
      })
      .from(clients)
      .where(eq(clients.companyId, companyId));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const upcoming: typeof allClients = [];

    for (const client of allClients) {
      if (!client.dateOfBirth) continue;
      const dob = new Date(client.dateOfBirth + "T00:00:00");
      let nextBday = new Date(
        todayStart.getFullYear(),
        dob.getMonth(),
        dob.getDate(),
      );
      if (nextBday.getTime() < todayStart.getTime()) {
        nextBday = new Date(
          todayStart.getFullYear() + 1,
          dob.getMonth(),
          dob.getDate(),
        );
      }
      const diffDays = Math.floor(
        (nextBday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays >= 0 && diffDays <= daysAhead) {
        upcoming.push(client);
      }
    }

    return upcoming;
  }

  async updateStaffLastLogin(staffId: number): Promise<void> {
    await db
      .update(staff)
      .set({ lastLoginAt: new Date() })
      .where(eq(staff.id, staffId));
  }

  async getCarriers(): Promise<Carrier[]> {
    return await db.select().from(carriers).orderBy(carriers.name);
  }

  async createCarrier(carrier: InsertCarrier): Promise<Carrier> {
    const [newCarrier] = await db.insert(carriers).values(carrier).returning();
    return newCarrier;
  }

  async getAdvisorCarriers(
    staffId: number,
  ): Promise<(AdvisorCarrier & { carrier: Carrier })[]> {
    const rows = await db
      .select({
        id: advisorCarriers.id,
        staffId: advisorCarriers.staffId,
        carrierId: advisorCarriers.carrierId,
        createdAt: advisorCarriers.createdAt,
        carrier: carriers,
      })
      .from(advisorCarriers)
      .innerJoin(carriers, eq(advisorCarriers.carrierId, carriers.id))
      .where(eq(advisorCarriers.staffId, staffId));
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      carrierId: r.carrierId,
      createdAt: r.createdAt,
      carrier: r.carrier,
    }));
  }

  async addAdvisorCarrier(data: InsertAdvisorCarrier): Promise<AdvisorCarrier> {
    const [ac] = await db.insert(advisorCarriers).values(data).returning();
    return ac;
  }

  async removeAdvisorCarrier(
    staffId: number,
    carrierId: number,
  ): Promise<void> {
    await db
      .delete(advisorCarriers)
      .where(
        and(
          eq(advisorCarriers.staffId, staffId),
          eq(advisorCarriers.carrierId, carrierId),
        ),
      );
  }

  async bulkCreateProducts(productList: InsertProduct[]): Promise<Product[]> {
    if (productList.length === 0) return [];
    return await db.insert(products).values(productList).returning();
  }

  async getEmailConfiguration(
    staffId: number,
  ): Promise<EmailConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(emailConfigurations)
      .where(eq(emailConfigurations.staffId, staffId));
    if (config) config.config = decryptEmailConfig(config.config as any) as any;
    return config;
  }

  async getEmailConfigurationForHost(
    hostUserId: number,
  ): Promise<EmailConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(emailConfigurations)
      .where(eq(emailConfigurations.hostUserId, hostUserId));
    if (config) config.config = decryptEmailConfig(config.config as any) as any;
    return config;
  }

  async createEmailConfiguration(
    config: InsertEmailConfiguration,
  ): Promise<EmailConfiguration> {
    const toStore = { ...config, config: encryptEmailConfig(config.config as any) as any };
    const [created] = await db
      .insert(emailConfigurations)
      .values(toStore)
      .returning();
    created.config = decryptEmailConfig(created.config as any) as any;
    return created;
  }

  async updateEmailConfiguration(
    id: number,
    updates: Partial<InsertEmailConfiguration>,
  ): Promise<EmailConfiguration> {
    const toStore = updates.config !== undefined
      ? { ...updates, config: encryptEmailConfig(updates.config as any) as any }
      : updates;
    const [updated] = await db
      .update(emailConfigurations)
      .set(toStore)
      .where(eq(emailConfigurations.id, id))
      .returning();
    updated.config = decryptEmailConfig(updated.config as any) as any;
    return updated;
  }

  async deleteEmailConfiguration(id: number): Promise<void> {
    await db.delete(emailConfigurations).where(eq(emailConfigurations.id, id));
  }

  async getCarrierCredentialsByCompany(
    companyId: number,
  ): Promise<CarrierCredential[]> {
    return await db
      .select()
      .from(carrierCredentials)
      .where(eq(carrierCredentials.companyId, companyId));
  }

  async getCarrierCredential(
    id: number,
  ): Promise<CarrierCredential | undefined> {
    const [cred] = await db
      .select()
      .from(carrierCredentials)
      .where(eq(carrierCredentials.id, id));
    return cred;
  }

  async createCarrierCredential(
    cred: InsertCarrierCredential,
  ): Promise<CarrierCredential> {
    const [created] = await db
      .insert(carrierCredentials)
      .values(cred)
      .returning();
    return created;
  }

  async deleteCarrierCredential(id: number): Promise<void> {
    await db.delete(carrierCredentials).where(eq(carrierCredentials.id, id));
  }

  async getCarrierFileRequestsByClient(
    clientId: number,
    companyId: number,
  ): Promise<CarrierFileRequest[]> {
    return await db
      .select()
      .from(carrierFileRequests)
      .where(
        and(
          eq(carrierFileRequests.clientId, clientId),
          eq(carrierFileRequests.companyId, companyId),
        ),
      )
      .orderBy(desc(carrierFileRequests.requestedAt));
  }

  async getCarrierFileRequest(
    id: number,
  ): Promise<CarrierFileRequest | undefined> {
    const [fileReq] = await db
      .select()
      .from(carrierFileRequests)
      .where(eq(carrierFileRequests.id, id));
    return fileReq;
  }

  async getCarrierFileRequestByIdAndCompany(
    id: number,
    companyId: number,
  ): Promise<CarrierFileRequest | undefined> {
    const [fileReq] = await db
      .select()
      .from(carrierFileRequests)
      .where(
        and(
          eq(carrierFileRequests.id, id),
          eq(carrierFileRequests.companyId, companyId),
        ),
      );
    return fileReq;
  }

  async createCarrierFileRequest(
    req: InsertCarrierFileRequest,
  ): Promise<CarrierFileRequest> {
    const [created] = await db
      .insert(carrierFileRequests)
      .values(req)
      .returning();
    return created;
  }

  async updateCarrierFileRequest(
    id: number,
    updates: Partial<CarrierFileRequest>,
  ): Promise<CarrierFileRequest> {
    const [updated] = await db
      .update(carrierFileRequests)
      .set(updates)
      .where(eq(carrierFileRequests.id, id))
      .returning();
    return updated;
  }

  async getCarrierFilesByRequest(requestId: number): Promise<CarrierFile[]> {
    return await db
      .select()
      .from(carrierFiles)
      .where(eq(carrierFiles.requestId, requestId));
  }

  async getCarrierFilesByClient(
    clientId: number,
    companyId: number,
  ): Promise<CarrierFile[]> {
    return await db
      .select()
      .from(carrierFiles)
      .where(
        and(
          eq(carrierFiles.clientId, clientId),
          eq(carrierFiles.companyId, companyId),
        ),
      )
      .orderBy(desc(carrierFiles.createdAt));
  }

  async getCarrierFile(id: number): Promise<CarrierFile | undefined> {
    const [file] = await db
      .select()
      .from(carrierFiles)
      .where(eq(carrierFiles.id, id));
    return file;
  }

  async getCarrierFileByIdAndCompany(
    id: number,
    companyId: number,
  ): Promise<CarrierFile | undefined> {
    const [file] = await db
      .select()
      .from(carrierFiles)
      .where(
        and(eq(carrierFiles.id, id), eq(carrierFiles.companyId, companyId)),
      );
    return file;
  }

  async createCarrierFile(file: InsertCarrierFile): Promise<CarrierFile> {
    const [created] = await db.insert(carrierFiles).values(file).returning();
    return created;
  }

  async getTaxBrackets(effectiveYear?: number): Promise<TaxBracketRecord[]> {
    if (effectiveYear) {
      return await db
        .select()
        .from(taxBrackets)
        .where(eq(taxBrackets.effectiveYear, effectiveYear));
    }
    return await db.select().from(taxBrackets);
  }

  async bulkInsertTaxBrackets(
    brackets: InsertTaxBracket[],
  ): Promise<TaxBracketRecord[]> {
    if (brackets.length === 0) return [];
    return await db.insert(taxBrackets).values(brackets).returning();
  }

  async clearTaxBrackets(effectiveYear: number): Promise<void> {
    await db
      .delete(taxBrackets)
      .where(eq(taxBrackets.effectiveYear, effectiveYear));
  }

  async getGovernmentBenefitRates(
    effectiveYear?: number,
  ): Promise<GovernmentBenefitRateRecord[]> {
    if (effectiveYear) {
      return await db
        .select()
        .from(governmentBenefitRates)
        .where(eq(governmentBenefitRates.effectiveYear, effectiveYear));
    }
    return await db.select().from(governmentBenefitRates);
  }

  async bulkInsertGovernmentBenefitRates(
    rates: InsertGovernmentBenefitRate[],
  ): Promise<GovernmentBenefitRateRecord[]> {
    if (rates.length === 0) return [];
    return await db.insert(governmentBenefitRates).values(rates).returning();
  }

  async clearGovernmentBenefitRates(effectiveYear: number): Promise<void> {
    await db
      .delete(governmentBenefitRates)
      .where(eq(governmentBenefitRates.effectiveYear, effectiveYear));
  }

  async getPlanAssumptions(planId: number): Promise<PlanAssumption[]> {
    return await db
      .select()
      .from(planAssumptions)
      .where(eq(planAssumptions.planId, planId));
  }

  async getPlanAssumptionByScenario(
    planId: number,
    scenario: string,
  ): Promise<PlanAssumption | undefined> {
    const [result] = await db
      .select()
      .from(planAssumptions)
      .where(
        and(
          eq(planAssumptions.planId, planId),
          eq(planAssumptions.scenario, scenario),
        ),
      );
    return result;
  }

  async upsertPlanAssumption(
    assumption: InsertPlanAssumption,
  ): Promise<PlanAssumption> {
    const existing = await this.getPlanAssumptionByScenario(
      assumption.planId,
      assumption.scenario,
    );
    if (existing) {
      const [updated] = await db
        .update(planAssumptions)
        .set({ ...assumption, updatedAt: new Date() })
        .where(eq(planAssumptions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(planAssumptions)
      .values(assumption)
      .returning();
    return created;
  }

  async deletePlanAssumption(id: number): Promise<void> {
    await db.delete(planAssumptions).where(eq(planAssumptions.id, id));
  }

  async getSimulationResults(
    planId: number,
  ): Promise<SimulationResultRecord[]> {
    return await db
      .select()
      .from(simulationResults)
      .where(eq(simulationResults.planId, planId));
  }

  async getSimulationResultByModuleScenario(
    planId: number,
    module: string,
    scenario: string,
  ): Promise<SimulationResultRecord | undefined> {
    const [result] = await db
      .select()
      .from(simulationResults)
      .where(
        and(
          eq(simulationResults.planId, planId),
          eq(simulationResults.module, module),
          eq(simulationResults.scenario, scenario),
        ),
      );
    return result;
  }

  async upsertSimulationResult(
    result: InsertSimulationResult,
  ): Promise<SimulationResultRecord> {
    const existing = await this.getSimulationResultByModuleScenario(
      result.planId,
      result.module,
      result.scenario,
    );
    if (existing) {
      const [updated] = await db
        .update(simulationResults)
        .set({ ...result, calculatedAt: new Date() })
        .where(eq(simulationResults.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(simulationResults)
      .values(result)
      .returning();
    return created;
  }

  async deleteSimulationResults(planId: number): Promise<void> {
    await db
      .delete(simulationResults)
      .where(eq(simulationResults.planId, planId));
  }

  async getPlanSnapshots(planId: number): Promise<PlanSnapshot[]> {
    return await db
      .select()
      .from(planSnapshots)
      .where(eq(planSnapshots.planId, planId))
      .orderBy(desc(planSnapshots.createdAt));
  }

  async getPlanSnapshot(id: number): Promise<PlanSnapshot | undefined> {
    const [result] = await db
      .select()
      .from(planSnapshots)
      .where(eq(planSnapshots.id, id));
    return result;
  }

  async createPlanSnapshot(
    snapshot: InsertPlanSnapshot,
  ): Promise<PlanSnapshot> {
    const [created] = await db
      .insert(planSnapshots)
      .values(snapshot)
      .returning();
    return created;
  }

  async getPlanStaleFlags(planId: number): Promise<PlanStaleFlag[]> {
    return await db
      .select()
      .from(planStaleFlags)
      .where(eq(planStaleFlags.planId, planId));
  }

  async getUnresolvedStaleFlags(planId: number): Promise<PlanStaleFlag[]> {
    return await db
      .select()
      .from(planStaleFlags)
      .where(
        and(
          eq(planStaleFlags.planId, planId),
          isNull(planStaleFlags.resolvedAt),
        ),
      );
  }

  async createPlanStaleFlag(flag: InsertPlanStaleFlag): Promise<PlanStaleFlag> {
    const [created] = await db.insert(planStaleFlags).values(flag).returning();
    return created;
  }

  async resolvePlanStaleFlag(id: number): Promise<PlanStaleFlag> {
    const [updated] = await db
      .update(planStaleFlags)
      .set({ resolvedAt: new Date() })
      .where(eq(planStaleFlags.id, id))
      .returning();
    return updated;
  }

  async getPlanActionItems(planId: number): Promise<PlanActionItem[]> {
    return await db
      .select()
      .from(planActionItems)
      .where(eq(planActionItems.planId, planId));
  }

  async createPlanActionItem(
    item: InsertPlanActionItem,
  ): Promise<PlanActionItem> {
    const [created] = await db.insert(planActionItems).values(item).returning();
    return created;
  }

  async updatePlanActionItem(
    id: number,
    updates: Partial<InsertPlanActionItem>,
  ): Promise<PlanActionItem> {
    const [updated] = await db
      .update(planActionItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(planActionItems.id, id))
      .returning();
    return updated;
  }

  async deletePlanActionItem(id: number): Promise<void> {
    await db.delete(planActionItems).where(eq(planActionItems.id, id));
  }
}

export const storage = new DatabaseStorage();
