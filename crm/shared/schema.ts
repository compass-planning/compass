import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb,
  decimal, _real, numeric, varchar, date, uniqueIndex
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const subscriptionPlans = ["solo", "standard", "professional", "platinum"] as const;
export type SubscriptionPlan = typeof subscriptionPlans[number];

export const accountTypes = ["single_advisor", "multi_member"] as const;
export type AccountType = typeof accountTypes[number];

type ModuleKey = "moduleEmail" | "moduleCalendar" | "moduleInsurance" | "moduleMutualFund" | "moduleSegFund" | "moduleMeetingRecorder" | "moduleAnalytics" | "modulePipeline" | "moduleFinancialPlanning";

export interface AddonModule {
  price: number;
  interval: string;
  perUser: boolean;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  maxMembers: number;
  accountTypes: AccountType[];
  includedModules: Record<ModuleKey, boolean>;
  addonModules: Partial<Record<ModuleKey, AddonModule>>;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "solo",
    name: "Solo Advisor",
    description: "For independent advisors managing their own book of business",
    price: 49,
    interval: "month",
    features: ["1 advisor + 1 admin", "Client management", "Email & Calendar"],
    maxMembers: 2,
    accountTypes: ["single_advisor"],
    includedModules: {
      moduleEmail: true,
      moduleCalendar: true,
      moduleInsurance: false,
      moduleMutualFund: false,
      moduleSegFund: false,
      moduleMeetingRecorder: false,
      moduleAnalytics: true,
      modulePipeline: true,
      moduleFinancialPlanning: true,
    },
    addonModules: {
      moduleInsurance: { price: 15, interval: "month", perUser: false },
      moduleMutualFund: { price: 15, interval: "month", perUser: false },
      moduleSegFund: { price: 15, interval: "month", perUser: false },
      moduleMeetingRecorder: { price: 20, interval: "month", perUser: false },
      moduleAnalytics: { price: 25, interval: "month", perUser: false },
      modulePipeline: { price: 10, interval: "month", perUser: false },
    },
  },
  {
    id: "standard",
    name: "Standard",
    description: "For small advisory teams with staff management and collaboration",
    price: 149,
    interval: "month",
    features: ["Up to 10 users", "Client management", "Staff & team management", "Email & Calendar", "Role-based access"],
    maxMembers: 10,
    accountTypes: ["single_advisor", "multi_member"],
    includedModules: {
      moduleEmail: true,
      moduleCalendar: true,
      moduleInsurance: false,
      moduleMutualFund: false,
      moduleSegFund: false,
      moduleMeetingRecorder: false,
      moduleAnalytics: true,
      modulePipeline: true,
      moduleFinancialPlanning: true,
    },
    addonModules: {
      moduleInsurance: { price: 10, interval: "month", perUser: true },
      moduleMutualFund: { price: 10, interval: "month", perUser: true },
      moduleSegFund: { price: 10, interval: "month", perUser: true },
      moduleMeetingRecorder: { price: 15, interval: "month", perUser: true },
      moduleAnalytics: { price: 20, interval: "month", perUser: true },
      modulePipeline: { price: 10, interval: "month", perUser: true },
    },
  },
  {
    id: "professional",
    name: "Professional",
    description: "For growing teams with analytics, meeting recording, and advanced tools",
    price: 299,
    interval: "month",
    features: ["Up to 25 users", "All Standard features", "Analytics dashboard", "Meeting recorder", "Advanced reporting"],
    maxMembers: 25,
    accountTypes: ["single_advisor", "multi_member"],
    includedModules: {
      moduleEmail: true,
      moduleCalendar: true,
      moduleInsurance: false,
      moduleMutualFund: false,
      moduleSegFund: false,
      moduleMeetingRecorder: true,
      moduleAnalytics: true,
      modulePipeline: true,
      moduleFinancialPlanning: true,
    },
    addonModules: {
      moduleInsurance: { price: 8, interval: "month", perUser: true },
      moduleMutualFund: { price: 8, interval: "month", perUser: true },
      moduleSegFund: { price: 8, interval: "month", perUser: true },
      modulePipeline: { price: 8, interval: "month", perUser: true },
    },
  },
  {
    id: "platinum",
    name: "Platinum",
    description: "For large organizations with all features and unlimited users",
    price: 499,
    interval: "month",
    features: ["Unlimited users", "All modules included", "Priority support", "Advanced analytics", "API access"],
    maxMembers: -1,
    accountTypes: ["single_advisor", "multi_member"],
    includedModules: {
      moduleEmail: true,
      moduleCalendar: true,
      moduleInsurance: true,
      moduleMutualFund: true,
      moduleSegFund: true,
      moduleMeetingRecorder: true,
      moduleAnalytics: true,
      modulePipeline: true,
      moduleFinancialPlanning: true,
    },
    addonModules: {},
  },
];

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("solo"),
  accountType: text("account_type").notNull().default("single_advisor"),
  moduleEmail: boolean("module_email").notNull().default(true),
  moduleCalendar: boolean("module_calendar").notNull().default(true),
  moduleInsurance: boolean("module_insurance").notNull().default(true),
  moduleMutualFund: boolean("module_mutual_fund").notNull().default(true),
  moduleSegFund: boolean("module_seg_fund").notNull().default(true),
  moduleMeetingRecorder: boolean("module_meeting_recorder").notNull().default(true),
  moduleAnalytics: boolean("module_analytics").notNull().default(true),
  modulePipeline: boolean("module_pipeline").notNull().default(true),
  moduleFinancialPlanning: boolean("module_financial_planning").notNull().default(true),
  contactName: text("contact_name"),
  billingEmail: text("billing_email"),
  corporateAddress: text("corporate_address"),
  corporatePhone: text("corporate_phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  authId: varchar("auth_id"),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  personalEmail: text("personal_email"),
  phone: text("phone"),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  role: text("role").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  linkedClientId: integer("linked_client_id"),
  linkedSpouseClientId: integer("linked_spouse_client_id"),
  maritalStatus: text("marital_status"),
  spouseName: text("spouse_name"),
  spousePhone: text("spouse_phone"),
  spouseEmail: text("spouse_email"),
  spouseBirthday: date("spouse_birthday"),
  spouseIsEmergencyContact: boolean("spouse_is_emergency_contact").notNull().default(false),
  anniversary: date("anniversary"),
  contractDate: date("contract_date"),
  sellsMutualFunds: boolean("sells_mutual_funds").notNull().default(false),
  timezone: text("timezone").default("America/Toronto"),
  emailSetupSkipped: boolean("email_setup_skipped").notNull().default(false),
  emailStyle: text("email_style"),
   lastLoginAt: timestamp("last_login_at"),
  // ── MFA (TOTP) ──
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaEnrolledAt: timestamp("mfa_enrolled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const advisorAssignments = pgTable("advisor_assignments", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  advisorId: integer("advisor_id").notNull(),
});

export const staffDocumentTypes = ["id_document", "contract", "certification", "license", "tax_form", "performance_review", "other"] as const;
export type StaffDocumentType = typeof staffDocumentTypes[number];

export const staffDocuments = pgTable("staff_documents", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  description: text("description"),
  fileName: text("file_name"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const staffChildren = pgTable("staff_children", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth"),
});

export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id:        serial("id").primaryKey(),
  staffId:   integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  codeHash:  text("code_hash").notNull(),
  used:      boolean("used").notNull().default(false),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const maritalStatuses = ["single", "married", "divorced", "widowed", "common_law", "separated"] as const;
export type MaritalStatus = typeof maritalStatuses[number];

export const preferredContactMethods = ["email", "phone", "cell", "work_email", "work_phone"] as const;
export type PreferredContactMethod = typeof preferredContactMethods[number];

export const pensionTypes = ["defined_benefit", "defined_contribution", "non_contributory", "rrsp_matching", "none"] as const;
export type PensionType = typeof pensionTypes[number];

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  advisorId: integer("advisor_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  cell: text("cell"),
  workPhone: text("work_phone"),
  workEmail: text("work_email"),
  address: text("address"),
  dateOfBirth: date("date_of_birth"),
  maritalStatus: text("marital_status"),
  preferredContact: text("preferred_contact"),
  spouseId: integer("spouse_id"),
  employerName: text("employer_name"),
  pensionPlan: text("pension_plan"),
  yearsAtJob: integer("years_at_job"),
  greeting: text("greeting"),
  notes: text("notes"),
  // ── Financial planning fields ─────────────────────────────────────────────
  province:                    text("province").default("ON"),
  occupation:                  text("occupation"),
  employmentStatus:            text("employment_status"),
  annualIncome:                decimal("annual_income", { precision: 15, scale: 2 }),
  retirementAge:               integer("retirement_age"),
  desiredRetirementIncome:     decimal("desired_retirement_income", { precision: 15, scale: 2 }),
  spouseFirstName:             text("spouse_first_name"),
  spouseLastName:              text("spouse_last_name"),
  spouseDateOfBirth:           text("spouse_date_of_birth"),
  spouseEmail:                 text("spouse_email"),
  spousePhone:                 text("spouse_phone"),
  spouseOccupation:            text("spouse_occupation"),
  spouseAnnualIncome:          decimal("spouse_annual_income", { precision: 15, scale: 2 }),
  spouseRetirementAge:         integer("spouse_retirement_age"),
  spouseDesiredRetirementIncome: decimal("spouse_desired_retirement_income", { precision: 15, scale: 2 }),
  spousePensionType:           text("spouse_pension_type"),
  // Address
  city:                        text("city"),
  postalCode:                  text("postal_code"),
  spouseAddress:               text("spouse_address"),
  spouseCity:                  text("spouse_city"),
  spousePostalCode:            text("spouse_postal_code"),
  dependants:                  jsonb("dependants"),
  jurisdiction:                text("jurisdiction").notNull().default("CA"),
  birthYear:                   integer("birth_year"),
  usState:                     text("us_state"),
  filingStatus:                text("filing_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth"),
  sex: text("sex"),
  relationship: text("relationship").default("child"), // child | step-child | foster-child
  otherParentName: text("other_parent_name"), // for step-children: name of other biological parent
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  policyNumber: text("policy_number").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull(),
  beneficiary: text("beneficiary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingPlatforms = ["teams", "zoom", "google_meet", "in_app", "other"] as const;
export type MeetingPlatform = typeof meetingPlatforms[number];

export const meetingRecordingStatuses = ["none", "pending", "joining", "recording", "processing", "done", "error"] as const;
export type MeetingRecordingStatus = typeof meetingRecordingStatuses[number];

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  date: timestamp("date").notNull(),
  transcript: text("transcript"),
  summary: text("summary"),
  platform: text("platform").default("other"),
  platformMeetingId: text("platform_meeting_id"),
  meetingJoinUrl: text("meeting_join_url"),
  recallBotId: text("recall_bot_id"),
  recordingUrl: text("recording_url"),
  recordingStatus: text("recording_status").default("none"),
  durationSeconds: integer("duration_seconds"),
  participants: jsonb("participants").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingTranscripts = pgTable("meeting_transcripts", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  segments: jsonb("segments").notNull().default([]),
  fullText: text("full_text").notNull().default(""),
  language: text("language").default("en-CA"),
  wordCount: integer("word_count").default(0),
  transcribedAt: timestamp("transcribed_at").defaultNow(),
});

export const meetingOutputs = pgTable("meeting_outputs", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  summary: text("summary"),
  keyDecisions: jsonb("key_decisions").default([]),
  clientGoals: jsonb("client_goals").default([]),
  followUpEmailDraft: text("follow_up_email_draft"),
  complianceNotes: jsonb("compliance_notes").default({}),
  planTriggers: jsonb("plan_triggers").default([]),
  coachingNotes: text("coaching_notes"),
  coachingScore: jsonb("coaching_score").default({}),
  complianceReviewed: boolean("compliance_reviewed").default(false),
  complianceReviewedBy: integer("compliance_reviewed_by"),
  complianceReviewedAt: timestamp("compliance_reviewed_at"),
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const meetingTaskStatuses = ["open", "in_progress", "complete", "cancelled"] as const;
export type MeetingTaskStatus = typeof meetingTaskStatuses[number];

export const meetingTasks = pgTable("meeting_tasks", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  clientId: integer("client_id").notNull(),
  owner: text("owner").notNull().default("advisor"),
  description: text("description").notNull(),
  dueDate: date("due_date"),
  priority: text("priority").default("medium"),
  status: text("status").default("open"),
  promotedToTask: boolean("promoted_to_task").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const consentMethods = ["email", "verbal", "in_app"] as const;
export type ConsentMethod = typeof consentMethods[number];

export const meetingRecordingConsents = pgTable("meeting_recording_consents", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  clientId: integer("client_id").notNull(),
  consentMethod: text("consent_method").notNull().default("verbal"),
  consentGivenAt: timestamp("consent_given_at").defaultNow(),
  consentRevokedAt: timestamp("consent_revoked_at"),
  ipAddress: text("ip_address"),
  verbalCertifiedBy: integer("verbal_certified_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recordingChunks = pgTable("recording_chunks", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  audioData: text("audio_data").notNull(),
  sizeBytes: integer("size_bytes").default(0),
  receivedAt: timestamp("received_at").defaultNow(),
});

export const documentTypes = ["beneficiary_change", "initial_intake", "kyc_form", "policy_application", "disclosure", "consent_form", "carrier_download", "other"] as const;
export type DocumentType = typeof documentTypes[number];

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  description: text("description"),
  signedDate: date("signed_date"),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pipelineStages = ["lead", "contacted", "opportunity", "proposal", "closed_won", "follow_up"] as const;
export type PipelineStage = typeof pipelineStages[number];

export const leadSources = ["referral", "cold_call", "website", "social_media", "event", "partner", "other"] as const;
export type LeadSource = typeof leadSources[number];

export const productInterestTypes = ["insurance", "mutual_fund", "segregated_fund"] as const;
export type ProductInterest = typeof productInterestTypes[number];

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  advisorId: integer("advisor_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  stage: text("stage").notNull().default("lead"),
  source: text("source"),
  productInterest: text("product_interest"),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  expectedCloseDate: date("expected_close_date"),
  notes: text("notes"),
  convertedClientId: integer("converted_client_id"),
  stageHistory: text("stage_history").default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leadActivities = pgTable("lead_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  staffId: integer("staff_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityTypes = ["phone_call", "appointment", "email", "follow_up", "note"] as const;
export type ActivityType = typeof activityTypes[number];

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  activityType: text("activity_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  duration: integer("duration"),
  staffId: integer("staff_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financialPlans = pgTable("financial_plans", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  goalAmount: numeric("goal_amount", { precision: 12, scale: 2 }),
  targetDate: date("target_date"),
  riskTolerance: text("risk_tolerance"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const netWorthEntries = pgTable("net_worth_entries", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const retirementProjections = pgTable("retirement_projections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  currentAge: integer("current_age").notNull(),
  retirementAge: integer("retirement_age").notNull(),
  lifeExpectancy: integer("life_expectancy").notNull(),
  currentSavings: numeric("current_savings", { precision: 14, scale: 2 }).notNull(),
  annualContribution: numeric("annual_contribution", { precision: 14, scale: 2 }).notNull(),
  expectedReturn: numeric("expected_return", { precision: 5, scale: 2 }).notNull(),
  inflationRate: numeric("inflation_rate", { precision: 5, scale: 2 }).notNull(),
  desiredRetirementIncome: numeric("desired_retirement_income", { precision: 14, scale: 2 }).notNull(),
  projectedBalance: numeric("projected_balance", { precision: 14, scale: 2 }),
  shortfallSurplus: numeric("shortfall_surplus", { precision: 14, scale: 2 }),
  yearlyBreakdown: text("yearly_breakdown"),
  cppStartAge: integer("cpp_start_age").default(65),
  oasStartAge: integer("oas_start_age").default(65),
  rrifConversionAge: integer("rrif_conversion_age").default(71),
  rrspBalance: numeric("rrsp_balance", { precision: 14, scale: 2 }).default("0"),
  tfsaBalance: numeric("tfsa_balance", { precision: 14, scale: 2 }).default("0"),
  nonRegBalance: numeric("non_reg_balance", { precision: 14, scale: 2 }).default("0"),
  pensionIncome: numeric("pension_income", { precision: 14, scale: 2 }).default("0"),
  spouseIncome: numeric("spouse_income", { precision: 14, scale: 2 }).default("0"),
  employmentIncome: numeric("employment_income", { precision: 14, scale: 2 }).default("0"),
  province: text("province").default("ontario"),
  equityAllocation: numeric("equity_allocation", { precision: 5, scale: 4 }).default("0.6"),
  bondAllocation: numeric("bond_allocation", { precision: 5, scale: 4 }).default("0.4"),
  yearsInCanada: integer("years_in_canada").default(40),
  annualTfsaContribution: numeric("annual_tfsa_contribution", { precision: 14, scale: 2 }).default("0"),
  annualNonRegContribution: numeric("annual_non_reg_contribution", { precision: 14, scale: 2 }).default("0"),
  desiredIncomeSourceMix: jsonb("desired_income_source_mix"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insuranceAnalyses = pgTable("insurance_analyses", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  annualIncome: numeric("annual_income", { precision: 14, scale: 2 }).notNull(),
  yearsOfIncomeNeeded: integer("years_of_income_needed").notNull(),
  existingLifeCoverage: numeric("existing_life_coverage", { precision: 14, scale: 2 }).notNull(),
  existingAssets: numeric("existing_assets", { precision: 14, scale: 2 }).notNull(),
  monthlyExpenses: numeric("monthly_expenses", { precision: 14, scale: 2 }).notNull(),
  existingDisabilityCoverage: numeric("existing_disability_coverage", { precision: 14, scale: 2 }).notNull(),
  criticalIllnessLumpSum: numeric("critical_illness_lump_sum", { precision: 14, scale: 2 }).notNull(),
  existingCriticalIllnessCoverage: numeric("existing_critical_illness_coverage", { precision: 14, scale: 2 }).notNull(),
  recommendedLifeCoverage: numeric("recommended_life_coverage", { precision: 14, scale: 2 }),
  lifeCoverageGap: numeric("life_coverage_gap", { precision: 14, scale: 2 }),
  recommendedDisabilityCoverage: numeric("recommended_disability_coverage", { precision: 14, scale: 2 }),
  disabilityCoverageGap: numeric("disability_coverage_gap", { precision: 14, scale: 2 }),
  recommendedCriticalIllnessCoverage: numeric("recommended_critical_illness_coverage", { precision: 14, scale: 2 }),
  criticalIllnessCoverageGap: numeric("critical_illness_coverage_gap", { precision: 14, scale: 2 }),
  calculationMethod: text("calculation_method").default("dime"),
  personalConsumptionRate: numeric("personal_consumption_rate", { precision: 5, scale: 4 }).default("0.30"),
  discountRate: numeric("discount_rate", { precision: 5, scale: 4 }).default("0.04"),
  withdrawalRate: numeric("withdrawal_rate", { precision: 5, scale: 4 }).default("0.04"),
  mortgageBalance: numeric("mortgage_balance", { precision: 14, scale: 2 }).default("0"),
  totalDebts: numeric("total_debts", { precision: 14, scale: 2 }).default("0"),
  educationFundTarget: numeric("education_fund_target", { precision: 14, scale: 2 }).default("0"),
  finalExpenses: numeric("final_expenses", { precision: 14, scale: 2 }).default("15000"),
  cppDisabilityBenefit: numeric("cpp_disability_benefit", { precision: 14, scale: 2 }).default("0"),
  diReplacementRate: numeric("di_replacement_rate", { precision: 5, scale: 4 }).default("0.70"),
  uncoveredTreatmentCosts: numeric("uncovered_treatment_costs", { precision: 14, scale: 2 }).default("0"),
  incomeVolatility: numeric("income_volatility", { precision: 5, scale: 4 }).default("0"),
  isVariableIncome: boolean("is_variable_income").default(false),
  analysisResults: jsonb("analysis_results"),
  analysisType: text("analysis_type").default("legacy"),
  primaryName: text("primary_name"),
  primaryAge: integer("primary_age"),
  spouseName: text("spouse_name"),
  spouseAge: integer("spouse_age"),
  spouseAnnualIncome: numeric("spouse_annual_income", { precision: 14, scale: 2 }).default("0"),
  familyMembers: integer("family_members").default(2),
  worksheetData: jsonb("worksheet_data"),
  primaryNeed: numeric("primary_need", { precision: 14, scale: 2 }),
  spouseNeed: numeric("spouse_need", { precision: 14, scale: 2 }),
  primaryExistingCoverage: numeric("primary_existing_coverage", { precision: 14, scale: 2 }),
  spouseExistingCoverage: numeric("spouse_existing_coverage", { precision: 14, scale: 2 }),
  primaryNetNeed: numeric("primary_net_need", { precision: 14, scale: 2 }),
  spouseNetNeed: numeric("spouse_net_need", { precision: 14, scale: 2 }),
  primaryCoveragePurchased: numeric("primary_coverage_purchased", { precision: 14, scale: 2 }),
  spouseCoveragePurchased: numeric("spouse_coverage_purchased", { precision: 14, scale: 2 }),
  primaryShortfallAcknowledged: numeric("primary_shortfall_acknowledged", { precision: 14, scale: 2 }),
  spouseShortfallAcknowledged: numeric("spouse_shortfall_acknowledged", { precision: 14, scale: 2 }),
  primarySignature: text("primary_signature"),
  spouseSignature: text("spouse_signature"),
  signatureDate: text("signature_date"),
  meetingNotes: text("meeting_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const educationSavings = pgTable("education_savings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  childName: text("child_name").notNull(),
  childAge: integer("child_age").notNull(),
  targetAge: integer("target_age").notNull().default(18),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  monthlyContribution: numeric("monthly_contribution", { precision: 14, scale: 2 }).notNull().default("0"),
  expectedReturn: numeric("expected_return", { precision: 5, scale: 2 }).notNull().default("5"),
  estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  accountType: text("account_type").notNull().default("RESP"),
  notes: text("notes"),
  familyIncomeBracket: text("family_income_bracket").default("high"),
  cesgReceivedToDate: numeric("cesg_received_to_date", { precision: 14, scale: 2 }).default("0"),
  clbEligible: boolean("clb_eligible").default(false),
  clbReceivedToDate: numeric("clb_received_to_date", { precision: 14, scale: 2 }).default("0"),
  educationCostInflation: numeric("education_cost_inflation", { precision: 5, scale: 4 }).default("0.03"),
  equityAllocation: numeric("equity_allocation", { precision: 5, scale: 4 }).default("0.6"),
  bondAllocation: numeric("bond_allocation", { precision: 5, scale: 4 }).default("0.4"),
  projectionResults: jsonb("projection_results"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const debtEntries = pgTable("debt_entries", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  minimumPayment: numeric("minimum_payment", { precision: 14, scale: 2 }).notNull().default("0"),
  term: text("term"),
  priority: integer("priority").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taxPlanningNotes = pgTable("tax_planning_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  taxYear: integer("tax_year").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  actionRequired: boolean("action_required").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const estatePlanningNotes = pgTable("estate_planning_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  documentReference: text("document_reference"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const estateAnalyses = pgTable("estate_analyses", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  province: text("province").notNull(),
  grossEstateValue: numeric("gross_estate_value", { precision: 14, scale: 2 }).notNull(),
  realEstateValue: numeric("real_estate_value", { precision: 14, scale: 2 }).default("0"),
  jointTenancyRealEstate: numeric("joint_tenancy_real_estate", { precision: 14, scale: 2 }).default("0"),
  registeredAccountsWithBeneficiary: numeric("registered_accounts_with_beneficiary", { precision: 14, scale: 2 }).default("0"),
  lifeInsuranceWithBeneficiary: numeric("life_insurance_with_beneficiary", { precision: 14, scale: 2 }).default("0"),
  trustAssets: numeric("trust_assets", { precision: 14, scale: 2 }).default("0"),
  rrspRrifBalance: numeric("rrsp_rrif_balance", { precision: 14, scale: 2 }).default("0"),
  nonRegInvestments: numeric("non_reg_investments", { precision: 14, scale: 2 }).default("0"),
  nonRegCostBase: numeric("non_reg_cost_base", { precision: 14, scale: 2 }).default("0"),
  primaryResidenceValue: numeric("primary_residence_value", { precision: 14, scale: 2 }).default("0"),
  otherIncome: numeric("other_income", { precision: 14, scale: 2 }).default("0"),
  hasWill: boolean("has_will").default(false),
  hasPowerOfAttorney: boolean("has_power_of_attorney").default(false),
  probateFee: numeric("probate_fee", { precision: 14, scale: 2 }),
  terminalTax: numeric("terminal_tax", { precision: 14, scale: 2 }),
  efficiencyScore: numeric("efficiency_score", { precision: 5, scale: 4 }),
  netToBeneficiaries: numeric("net_to_beneficiaries", { precision: 14, scale: 2 }),
  analysisResults: jsonb("analysis_results"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cashFlowBudgets = pgTable("cash_flow_budgets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  monthlyGrossIncome: numeric("monthly_gross_income", { precision: 14, scale: 2 }).notNull(),
  monthlyNetIncome: numeric("monthly_net_income", { precision: 14, scale: 2 }).notNull(),
  additionalIncome: numeric("additional_income", { precision: 14, scale: 2 }).default("0"),
  currentEmergencyFund: numeric("current_emergency_fund", { precision: 14, scale: 2 }).default("0"),
  budgetEntries: jsonb("budget_entries").notNull(),
  analysisResults: jsonb("analysis_results"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Income Sources ─────────────────────────────────────────────────────────────
// Structured per-source income records replacing the single annualIncome field.
// Enables AI recommendations on income type, taxability, splitting, and CPP deferral.
export const incomeSourceTypes = [
  "employment", "self_employment", "rental", "corporate_dividend",
  "cpp", "oas", "defined_benefit_pension", "defined_contribution_pension",
  "annuity", "other",
] as const;
export type IncomeSourceType = typeof incomeSourceTypes[number];

export const incomeTaxabilityTypes = [
  "fully_taxable", "capital_gain", "eligible_dividend",
  "non_eligible_dividend", "non_taxable",
] as const;
export type IncomeTaxability = typeof incomeTaxabilityTypes[number];

export const incomeOwnerTypes = ["primary", "spouse", "joint"] as const;
export type IncomeOwner = typeof incomeOwnerTypes[number];

export const incomeSources = pgTable("income_sources", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  owner: text("owner").notNull().default("primary"), // primary | spouse | joint
  sourceType: text("source_type").notNull(),          // incomeSourceTypes
  label: text("label"),                               // custom display name
  annualAmount: numeric("annual_amount", { precision: 14, scale: 2 }).notNull(),
  taxability: text("taxability").notNull().default("fully_taxable"),
  startAge: integer("start_age"),                     // null = already active
  endAge: integer("end_age"),                         // null = lifetime
  indexedToInflation: boolean("indexed_to_inflation").notNull().default(false),
  isSurvivorBenefit: boolean("is_survivor_benefit").notNull().default(false),
  survivorPercentage: numeric("survivor_percentage", { precision: 5, scale: 2 }), // e.g. 60 = 60%
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIncomeSourceSchema = createInsertSchema(incomeSources).omit({ id: true, createdAt: true });
export type IncomeSource = typeof incomeSources.$inferSelect;
export type InsertIncomeSource = z.infer<typeof insertIncomeSourceSchema>;

export const aiRecommendations = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taxBrackets = pgTable("tax_brackets", {
  id: serial("id").primaryKey(),
  province: text("province").notNull(),
  minIncome: numeric("min_income", { precision: 14, scale: 2 }).notNull(),
  maxIncome: numeric("max_income", { precision: 14, scale: 2 }),
  rate: numeric("rate", { precision: 8, scale: 6 }).notNull(),
  effectiveYear: integer("effective_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const governmentBenefitRates = pgTable("government_benefit_rates", {
  id: serial("id").primaryKey(),
  rateKey: text("rate_key").notNull(),
  label: text("label").notNull(),
  value: numeric("value", { precision: 14, scale: 4 }).notNull(),
  category: text("category").notNull(),
  effectiveYear: integer("effective_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const planScenarios = ["base", "optimistic", "stress"] as const;
export type PlanScenario = typeof planScenarios[number];

export const planModules = ["retirement", "insurance", "education", "estate", "debt", "tax", "cashflow"] as const;
export type PlanModule = typeof planModules[number];

export const simulatableModules = ["retirement", "insurance", "education", "debt"] as const;
export type SimulatableModule = typeof simulatableModules[number];

export const planAssumptions = pgTable("plan_assumptions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => financialPlans.id),
  scenario: text("scenario").notNull(),
  equityReturn: numeric("equity_return", { precision: 6, scale: 4 }).notNull(),
  equityVolatility: numeric("equity_volatility", { precision: 6, scale: 4 }).notNull(),
  bondReturn: numeric("bond_return", { precision: 6, scale: 4 }).notNull(),
  bondVolatility: numeric("bond_volatility", { precision: 6, scale: 4 }).notNull(),
  inflationMean: numeric("inflation_mean", { precision: 6, scale: 4 }).notNull().default("0.02"),
  inflationVolatility: numeric("inflation_volatility", { precision: 6, scale: 4 }).notNull().default("0.01"),
  corrEquityBond: numeric("corr_equity_bond", { precision: 6, scale: 4 }).notNull().default("-0.15"),
  corrEquityInflation: numeric("corr_equity_inflation", { precision: 6, scale: 4 }).notNull().default("0.10"),
  corrBondInflation: numeric("corr_bond_inflation", { precision: 6, scale: 4 }).notNull().default("0.30"),
  planToAge: integer("plan_to_age").notNull().default(95),
  simulationCount: integer("simulation_count").notNull().default(5000),
  cppStartAge: integer("cpp_start_age").notNull().default(65),
  oasStartAge: integer("oas_start_age").notNull().default(65),
  province: text("province").notNull().default("ontario"),
  stressCrashYear: integer("stress_crash_year"),
  stressCrashMagnitude: numeric("stress_crash_magnitude", { precision: 6, scale: 4 }),
  stressRecoveryYears: integer("stress_recovery_years"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("plan_assumptions_plan_scenario_unique").on(table.planId, table.scenario),
]);

export const simulationResults = pgTable("simulation_results", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => financialPlans.id),
  module: text("module").notNull(),
  scenario: text("scenario").notNull(),
  successRate: numeric("success_rate", { precision: 6, scale: 4 }).notNull(),
  p10: numeric("p10", { precision: 14, scale: 2 }).notNull(),
  p25: numeric("p25", { precision: 14, scale: 2 }).notNull(),
  p50: numeric("p50", { precision: 14, scale: 2 }).notNull(),
  p75: numeric("p75", { precision: 14, scale: 2 }).notNull(),
  p90: numeric("p90", { precision: 14, scale: 2 }).notNull(),
  moduleMedians: jsonb("module_medians"),
  sensitivityData: jsonb("sensitivity_data"),
  assumptionsSnapshot: jsonb("assumptions_snapshot"),
  medianPath: jsonb("median_path"),
  percentileBands: jsonb("percentile_bands"),
  simulationCount: integer("simulation_count").notNull(),
  yearsProjected: integer("years_projected").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  uniqueIndex("simulation_results_plan_module_scenario_unique").on(table.planId, table.module, table.scenario),
]);

export const snapshotTriggers = ["present_to_client", "annual_review", "manual"] as const;
export type SnapshotTrigger = typeof snapshotTriggers[number];

export const planSnapshots = pgTable("plan_snapshots", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => financialPlans.id),
  snapshotData: jsonb("snapshot_data").notNull(),
  trigger: text("trigger").notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => staff.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const planStaleFlags = pgTable("plan_stale_flags", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => financialPlans.id),
  module: text("module").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const actionItemStatuses = ["pending", "in_progress", "completed", "dismissed"] as const;
export type ActionItemStatus = typeof actionItemStatuses[number];

export const actionItemPriorities = ["critical", "high", "medium", "low"] as const;
export type ActionItemPriority = typeof actionItemPriorities[number];

export const planActionItems = pgTable("plan_action_items", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => financialPlans.id),
  module: text("module").notNull(),
  priority: text("priority").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlanAssumptionSchema = createInsertSchema(planAssumptions).omit({ id: true, createdAt: true, updatedAt: true });
export type PlanAssumption = typeof planAssumptions.$inferSelect;
export type InsertPlanAssumption = z.infer<typeof insertPlanAssumptionSchema>;

export const insertSimulationResultSchema = createInsertSchema(simulationResults).omit({ id: true, calculatedAt: true });
export type SimulationResultRecord = typeof simulationResults.$inferSelect;
export type InsertSimulationResult = z.infer<typeof insertSimulationResultSchema>;

export const insertPlanSnapshotSchema = createInsertSchema(planSnapshots).omit({ id: true, createdAt: true });
export type PlanSnapshot = typeof planSnapshots.$inferSelect;
export type InsertPlanSnapshot = z.infer<typeof insertPlanSnapshotSchema>;

export const insertPlanStaleFlagSchema = createInsertSchema(planStaleFlags).omit({ id: true, createdAt: true });
export type PlanStaleFlag = typeof planStaleFlags.$inferSelect;
export type InsertPlanStaleFlag = z.infer<typeof insertPlanStaleFlagSchema>;

export const insertPlanActionItemSchema = createInsertSchema(planActionItems).omit({ id: true, createdAt: true, updatedAt: true });
export type PlanActionItem = typeof planActionItems.$inferSelect;
export type InsertPlanActionItem = z.infer<typeof insertPlanActionItemSchema>;

export const DEFAULT_ASSUMPTION_SETS = {
  conservative: {
    equityReturn: "0.055",
    equityVolatility: "0.12",
    bondReturn: "0.035",
    bondVolatility: "0.05",
    inflationMean: "0.02",
    inflationVolatility: "0.01",
  },
  moderate: {
    equityReturn: "0.07",
    equityVolatility: "0.15",
    bondReturn: "0.04",
    bondVolatility: "0.06",
    inflationMean: "0.02",
    inflationVolatility: "0.01",
  },
  aggressive: {
    equityReturn: "0.085",
    equityVolatility: "0.18",
    bondReturn: "0.045",
    bondVolatility: "0.07",
    inflationMean: "0.02",
    inflationVolatility: "0.01",
  },
} as const;

export const carrierTypes = ["insurance", "mutual_fund", "segregated_fund"] as const;
export type CarrierType = typeof carrierTypes[number];

export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const advisorCarriers = pgTable("advisor_carriers", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  staff: many(staff),
  clients: many(clients),
  leads: many(leads),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  company: one(companies, {
    fields: [staff.companyId],
    references: [companies.id],
  }),
  linkedClient: one(clients, {
    fields: [staff.linkedClientId],
    references: [clients.id],
  }),
  assignedAdvisors: many(advisorAssignments, { relationName: "admin" }),
  assignedToAdmin: many(advisorAssignments, { relationName: "advisor" }),
  clients: many(clients),
  staffDocuments: many(staffDocuments),
  staffChildren: many(staffChildren),
  advisorCarriers: many(advisorCarriers),
}));

export const advisorAssignmentsRelations = relations(advisorAssignments, ({ one }) => ({
  admin: one(staff, {
    fields: [advisorAssignments.adminId],
    references: [staff.id],
    relationName: "admin",
  }),
  advisor: one(staff, {
    fields: [advisorAssignments.advisorId],
    references: [staff.id],
    relationName: "advisor",
  }),
}));

export const staffDocumentsRelations = relations(staffDocuments, ({ one }) => ({
  staffMember: one(staff, {
    fields: [staffDocuments.staffId],
    references: [staff.id],
  }),
}));

export const staffChildrenRelations = relations(staffChildren, ({ one }) => ({
  staffMember: one(staff, {
    fields: [staffChildren.staffId],
    references: [staff.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  company: one(companies, {
    fields: [clients.companyId],
    references: [companies.id],
  }),
  advisor: one(staff, {
    fields: [clients.advisorId],
    references: [staff.id],
  }),
  spouse: one(clients, {
    fields: [clients.spouseId],
    references: [clients.id],
  }),
  children: many(children),
  products: many(products),
  meetings: many(meetings),
  documents: many(documents),
  activities: many(activities),
  financialPlans: many(financialPlans),
}));

export const childrenRelations = relations(children, ({ one }) => ({
  client: one(clients, {
    fields: [children.clientId],
    references: [clients.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  client: one(clients, {
    fields: [products.clientId],
    references: [clients.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  client: one(clients, {
    fields: [meetings.clientId],
    references: [clients.id],
  }),
  meetingTranscript: one(meetingTranscripts),
  meetingOutputs: one(meetingOutputs),
  meetingTasks: many(meetingTasks),
}));

export const meetingTranscriptsRelations = relations(meetingTranscripts, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingTranscripts.meetingId],
    references: [meetings.id],
  }),
}));

export const meetingOutputsRelations = relations(meetingOutputs, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingOutputs.meetingId],
    references: [meetings.id],
  }),
}));

export const meetingTasksRelations = relations(meetingTasks, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingTasks.meetingId],
    references: [meetings.id],
  }),
  client: one(clients, {
    fields: [meetingTasks.clientId],
    references: [clients.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  client: one(clients, {
    fields: [activities.clientId],
    references: [clients.id],
  }),
  staffMember: one(staff, {
    fields: [activities.staffId],
    references: [staff.id],
  }),
}));

export const financialPlansRelations = relations(financialPlans, ({ one }) => ({
  client: one(clients, {
    fields: [financialPlans.clientId],
    references: [clients.id],
  }),
}));

export const incomeSourcesRelations = relations(incomeSources, ({ one }) => ({
  client: one(clients, {
    fields: [incomeSources.clientId],
    references: [clients.id],
  }),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  advisorCarriers: many(advisorCarriers),
}));

export const advisorCarriersRelations = relations(advisorCarriers, ({ one }) => ({
  staff: one(staff, {
    fields: [advisorCarriers.staffId],
    references: [staff.id],
  }),
  carrier: one(carriers, {
    fields: [advisorCarriers.carrierId],
    references: [carriers.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  advisor: one(staff, {
    fields: [leads.advisorId],
    references: [staff.id],
  }),
  convertedClient: one(clients, {
    fields: [leads.convertedClientId],
    references: [clients.id],
  }),
  leadActivities: many(leadActivities),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  staffMember: one(staff, {
    fields: [leadActivities.staffId],
    references: [staff.id],
  }),
}));

export const userRoles = ["general_manager", "office_admin", "sales_manager", "advisor_admin", "advisor"] as const;
export type UserRole = typeof userRoles[number];

export const hostRoles = ["admin", "sales", "accounting", "manager", "development", "service"] as const;
export type HostRole = typeof hostRoles[number];

export const hostUsers = pgTable("host_users", {
  id: serial("id").primaryKey(),
  authId: varchar("auth_id").unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  roles: text("roles").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  emailSetupSkipped: boolean("email_setup_skipped").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceCaseStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export type ServiceCaseStatus = typeof serviceCaseStatuses[number];

export const serviceCasePriorities = ["low", "medium", "high", "critical"] as const;
export type ServiceCasePriority = typeof serviceCasePriorities[number];

export const serviceCases = pgTable("service_cases", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignedToId: integer("assigned_to_id"),
  createdById: integer("created_by_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceCaseNotes = pgTable("service_case_notes", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  authorId: integer("author_id"),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hostInvoiceStatuses = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export type HostInvoiceStatus = typeof hostInvoiceStatuses[number];

export const hostInvoices = pgTable("host_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  invoiceNumber: varchar("invoice_number").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hostPayables = pgTable("host_payables", {
  id: serial("id").primaryKey(),
  vendorName: text("vendor_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hostStaff = pgTable("host_staff", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  department: text("department"),
  position: text("position"),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  startDate: date("start_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskPriorities = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = typeof taskPriorities[number];

export const taskStatuses = ["pending", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = typeof taskStatuses[number];

export const taskVisibilities = ["company", "private"] as const;
export type TaskVisibility = typeof taskVisibilities[number];

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  createdByStaffId: integer("created_by_staff_id").notNull(),
  assignedToStaffId: integer("assigned_to_staff_id"),
  clientId: integer("client_id").references(() => clients.id),
  leadId: integer("lead_id").references(() => leads.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  dueTime: text("due_time"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  visibility: text("visibility").notNull().default("private"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  company: one(companies, {
    fields: [tasks.companyId],
    references: [companies.id],
  }),
  createdBy: one(staff, {
    fields: [tasks.createdByStaffId],
    references: [staff.id],
    relationName: "createdTasks",
  }),
  assignedTo: one(staff, {
    fields: [tasks.assignedToStaffId],
    references: [staff.id],
    relationName: "assignedTasks",
  }),
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [tasks.leadId],
    references: [leads.id],
  }),
}));

export const hostUsersRelations = relations(hostUsers, ({ many }) => ({
  assignedCases: many(serviceCases, { relationName: "assignedTo" }),
  createdCases: many(serviceCases, { relationName: "createdBy" }),
}));

export const serviceCasesRelations = relations(serviceCases, ({ one, many }) => ({
  company: one(companies, {
    fields: [serviceCases.companyId],
    references: [companies.id],
  }),
  assignedTo: one(hostUsers, {
    fields: [serviceCases.assignedToId],
    references: [hostUsers.id],
    relationName: "assignedTo",
  }),
  createdBy: one(hostUsers, {
    fields: [serviceCases.createdById],
    references: [hostUsers.id],
    relationName: "createdBy",
  }),
  notes: many(serviceCaseNotes),
}));

export const serviceCaseNotesRelations = relations(serviceCaseNotes, ({ one }) => ({
  serviceCase: one(serviceCases, {
    fields: [serviceCaseNotes.caseId],
    references: [serviceCases.id],
  }),
}));

export const hostInvoicesRelations = relations(hostInvoices, ({ one }) => ({
  company: one(companies, {
    fields: [hostInvoices.companyId],
    references: [companies.id],
  }),
}));

export const notificationTypes = ["task_assigned", "lead_assigned", "reminder_due", "birthday"] as const;
export type NotificationType = typeof notificationTypes[number];

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  recipientStaffId: integer("recipient_staff_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: integer("related_entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(staff, {
    fields: [notifications.recipientStaffId],
    references: [staff.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertHostUserSchema = createInsertSchema(hostUsers).omit({ id: true, createdAt: true });
export const insertServiceCaseSchema = createInsertSchema(serviceCases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceCaseNoteSchema = createInsertSchema(serviceCaseNotes).omit({ id: true, createdAt: true });
export const insertHostInvoiceSchema = createInsertSchema(hostInvoices).omit({ id: true, createdAt: true });
export const insertHostPayableSchema = createInsertSchema(hostPayables).omit({ id: true, createdAt: true });
export const insertHostStaffSchema = createInsertSchema(hostStaff).omit({ id: true, createdAt: true });

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const updateCompanySettingsSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(subscriptionPlans).optional(),
  accountType: z.enum(accountTypes).optional(),
  moduleEmail: z.boolean().optional(),
  moduleCalendar: z.boolean().optional(),
  moduleInsurance: z.boolean().optional(),
  moduleMutualFund: z.boolean().optional(),
  moduleSegFund: z.boolean().optional(),
  moduleMeetingRecorder: z.boolean().optional(),
  moduleAnalytics: z.boolean().optional(),
  modulePipeline: z.boolean().optional(),
  moduleFinancialPlanning: z.boolean().optional(),
});
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, createdAt: true, passwordHash: true, mustChangePassword: true }).extend({
  role: z.enum(userRoles),
});
export const insertStaffDocumentSchema = createInsertSchema(staffDocuments).omit({ id: true, createdAt: true });
export const insertStaffChildSchema = createInsertSchema(staffChildren).omit({ id: true });
export const insertAdvisorAssignmentSchema = createInsertSchema(advisorAssignments).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChildSchema = createInsertSchema(children).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertMeetingTranscriptSchema = createInsertSchema(meetingTranscripts).omit({ id: true, transcribedAt: true });
export const insertMeetingOutputSchema = createInsertSchema(meetingOutputs).omit({ id: true, generatedAt: true });
export const insertMeetingTaskSchema = createInsertSchema(meetingTasks).omit({ id: true, createdAt: true });
export const insertMeetingRecordingConsentSchema = createInsertSchema(meetingRecordingConsents).omit({ id: true, createdAt: true });
export const insertRecordingChunkSchema = createInsertSchema(recordingChunks).omit({ id: true, receivedAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({ id: true, createdAt: true });
export const insertFinancialPlanSchema = createInsertSchema(financialPlans).omit({ id: true, createdAt: true });

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type StaffMember = typeof staff.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffSchema>;

export type StaffDocument = typeof staffDocuments.$inferSelect;
export type InsertStaffDocument = z.infer<typeof insertStaffDocumentSchema>;

export type StaffChild = typeof staffChildren.$inferSelect;
export type InsertStaffChild = z.infer<typeof insertStaffChildSchema>;

export type AdvisorAssignment = typeof advisorAssignments.$inferSelect;
export type InsertAdvisorAssignment = z.infer<typeof insertAdvisorAssignmentSchema>;

export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateClientRequest = Partial<InsertClient>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type MeetingTranscript = typeof meetingTranscripts.$inferSelect;
export type InsertMeetingTranscript = z.infer<typeof insertMeetingTranscriptSchema>;

export type MeetingOutput = typeof meetingOutputs.$inferSelect;
export type InsertMeetingOutput = z.infer<typeof insertMeetingOutputSchema>;

export type MeetingTask = typeof meetingTasks.$inferSelect;
export type InsertMeetingTask = z.infer<typeof insertMeetingTaskSchema>;

export type MeetingRecordingConsent = typeof meetingRecordingConsents.$inferSelect;
export type InsertMeetingRecordingConsent = z.infer<typeof insertMeetingRecordingConsentSchema>;

export type RecordingChunk = typeof recordingChunks.$inferSelect;
export type InsertRecordingChunk = z.infer<typeof insertRecordingChunkSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

export type FinancialPlan = typeof financialPlans.$inferSelect;
export type InsertFinancialPlan = z.infer<typeof insertFinancialPlanSchema>;

export type HostUser = typeof hostUsers.$inferSelect;
export type InsertHostUser = z.infer<typeof insertHostUserSchema>;

export type ServiceCase = typeof serviceCases.$inferSelect;
export type InsertServiceCase = z.infer<typeof insertServiceCaseSchema>;

export type ServiceCaseNote = typeof serviceCaseNotes.$inferSelect;
export type InsertServiceCaseNote = z.infer<typeof insertServiceCaseNoteSchema>;

export type HostInvoice = typeof hostInvoices.$inferSelect;
export type InsertHostInvoice = z.infer<typeof insertHostInvoiceSchema>;

export type HostPayable = typeof hostPayables.$inferSelect;
export type InsertHostPayable = z.infer<typeof insertHostPayableSchema>;

export type HostStaffMember = typeof hostStaff.$inferSelect;
export type InsertHostStaffMember = z.infer<typeof insertHostStaffSchema>;

export const insertCarrierSchema = createInsertSchema(carriers).omit({ id: true, createdAt: true });
export const insertAdvisorCarrierSchema = createInsertSchema(advisorCarriers).omit({ id: true, createdAt: true });

export type Carrier = typeof carriers.$inferSelect;
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;

export type AdvisorCarrier = typeof advisorCarriers.$inferSelect;
export type InsertAdvisorCarrier = z.infer<typeof insertAdvisorCarrierSchema>;

export const insertNetWorthEntrySchema = createInsertSchema(netWorthEntries).omit({ id: true, createdAt: true });
export const insertRetirementProjectionSchema = createInsertSchema(retirementProjections).omit({ id: true, createdAt: true, projectedBalance: true, shortfallSurplus: true, yearlyBreakdown: true });
export const insertInsuranceAnalysisSchema = createInsertSchema(insuranceAnalyses).omit({ id: true, createdAt: true, recommendedLifeCoverage: true, lifeCoverageGap: true, recommendedDisabilityCoverage: true, disabilityCoverageGap: true, recommendedCriticalIllnessCoverage: true, criticalIllnessCoverageGap: true, analysisResults: true, primaryNeed: true, spouseNeed: true, primaryNetNeed: true, spouseNetNeed: true });

export type NetWorthEntry = typeof netWorthEntries.$inferSelect;
export type InsertNetWorthEntry = z.infer<typeof insertNetWorthEntrySchema>;

export type RetirementProjection = typeof retirementProjections.$inferSelect;
export type InsertRetirementProjection = z.infer<typeof insertRetirementProjectionSchema>;

export type InsuranceAnalysis = typeof insuranceAnalyses.$inferSelect;
export type InsertInsuranceAnalysis = z.infer<typeof insertInsuranceAnalysisSchema>;

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export const emailProviders = ["outlook", "gmail", "imap_smtp"] as const;
export type EmailProviderType = typeof emailProviders[number];

export const emailConfigurations = pgTable("email_configurations", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").unique().references(() => staff.id, { onDelete: "cascade" }),
  hostUserId: integer("host_user_id").unique().references(() => hostUsers.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().$type<EmailProviderType>(),
  config: jsonb("config").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailConfigurationSchema = createInsertSchema(emailConfigurations).omit({ id: true, createdAt: true });
export type EmailConfiguration = typeof emailConfigurations.$inferSelect;
export type InsertEmailConfiguration = z.infer<typeof insertEmailConfigurationSchema>;

export const insertEducationSavingsSchema = createInsertSchema(educationSavings).omit({ id: true, createdAt: true, projectionResults: true });
export type EducationSaving = typeof educationSavings.$inferSelect;
export type InsertEducationSaving = z.infer<typeof insertEducationSavingsSchema>;

export const insertDebtEntrySchema = createInsertSchema(debtEntries).omit({ id: true, createdAt: true });
export type DebtEntry = typeof debtEntries.$inferSelect;
export type InsertDebtEntry = z.infer<typeof insertDebtEntrySchema>;

export const insertTaxPlanningNoteSchema = createInsertSchema(taxPlanningNotes).omit({ id: true, createdAt: true });
export type TaxPlanningNote = typeof taxPlanningNotes.$inferSelect;
export type InsertTaxPlanningNote = z.infer<typeof insertTaxPlanningNoteSchema>;

export const insertEstatePlanningNoteSchema = createInsertSchema(estatePlanningNotes).omit({ id: true, createdAt: true });
export type EstatePlanningNote = typeof estatePlanningNotes.$inferSelect;
export type InsertEstatePlanningNote = z.infer<typeof insertEstatePlanningNoteSchema>;

export const insertEstateAnalysisSchema = createInsertSchema(estateAnalyses).omit({ id: true, createdAt: true });
export type EstateAnalysis = typeof estateAnalyses.$inferSelect;
export type InsertEstateAnalysis = z.infer<typeof insertEstateAnalysisSchema>;

export const insertCashFlowBudgetSchema = createInsertSchema(cashFlowBudgets).omit({ id: true, createdAt: true });
export type CashFlowBudget = typeof cashFlowBudgets.$inferSelect;
export type InsertCashFlowBudget = z.infer<typeof insertCashFlowBudgetSchema>;

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations).omit({ id: true, createdAt: true });
export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;

export const insertTaxBracketSchema = createInsertSchema(taxBrackets).omit({ id: true, createdAt: true });
export type TaxBracketRecord = typeof taxBrackets.$inferSelect;
export type InsertTaxBracket = z.infer<typeof insertTaxBracketSchema>;

export const insertGovernmentBenefitRateSchema = createInsertSchema(governmentBenefitRates).omit({ id: true, createdAt: true });
export type GovernmentBenefitRateRecord = typeof governmentBenefitRates.$inferSelect;
export type InsertGovernmentBenefitRate = z.infer<typeof insertGovernmentBenefitRateSchema>;

export const carrierCredentialTypes = ["advisor_code", "api_key", "username_password"] as const;
export type CarrierCredentialType = typeof carrierCredentialTypes[number];

export const carrierCredentials = pgTable("carrier_credentials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  credentialType: text("credential_type").notNull(),
  label: text("label").notNull(),
  encryptedCredentials: text("encrypted_credentials").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const carrierFileRequestStatuses = ["pending", "processing", "completed", "failed", "partial"] as const;
export type CarrierFileRequestStatus = typeof carrierFileRequestStatuses[number];

export const carrierFileRequests = pgTable("carrier_file_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  clientId: integer("client_id").notNull(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  status: text("status").notNull().default("pending"),
  fileTypes: text("file_types").array().notNull(),
  errorMessage: text("error_message"),
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const carrierFileStatuses = ["available", "expired", "error"] as const;
export type CarrierFileStatus = typeof carrierFileStatuses[number];

export const carrierFiles = pgTable("carrier_files", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => carrierFileRequests.id),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  clientId: integer("client_id").notNull(),
  companyId: integer("company_id").notNull(),
  fileType: text("file_type").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  status: text("status").notNull().default("available"),
  demoContent: text("demo_content"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCarrierCredentialSchema = createInsertSchema(carrierCredentials).omit({ id: true, createdAt: true, updatedAt: true });
export type CarrierCredential = typeof carrierCredentials.$inferSelect;
export type InsertCarrierCredential = z.infer<typeof insertCarrierCredentialSchema>;

export const insertCarrierFileRequestSchema = createInsertSchema(carrierFileRequests).omit({ id: true, requestedAt: true, completedAt: true });
export type CarrierFileRequest = typeof carrierFileRequests.$inferSelect;
export type InsertCarrierFileRequest = z.infer<typeof insertCarrierFileRequestSchema>;

export const insertCarrierFileSchema = createInsertSchema(carrierFiles).omit({ id: true, createdAt: true });
export type CarrierFile = typeof carrierFiles.$inferSelect;
export type InsertCarrierFile = z.infer<typeof insertCarrierFileSchema>;

export const carrierFileTypeOptions = [
  "policy_statement",
  "tax_slip",
  "account_summary",
  "transaction_history",
  "confirmation_of_coverage",
  "beneficiary_summary",
] as const;
export type CarrierFileType = typeof carrierFileTypeOptions[number];
//   import { pgTable, serial, text, integer, boolean, timestamp, jsonb, decimal, real, date } from "drizzle-orm/pg-core";

export const financialGoals = pgTable("financial_goals", {
  id:            serial("id").primaryKey(),
  clientId:      integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  goalType:      text("goal_type").notNull().default("custom"),
  title:         text("title").notNull(),
  targetAmount:  decimal("target_amount", { precision: 15, scale: 2 }),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }),
  targetDate:    text("target_date"),
  status:        text("status").notNull().default("in_progress"),
  notes:         text("notes"),
  // ── Projection fields ──────────────────────────────────────────────────
  // cashflowType: how this goal affects the plan cashflow
  //   "outflow"          = one-time spend (cottage, car, renovation)
  //   "inflow"           = one-time receipt (inheritance, bonus, sale)
  //   "savings_target"   = accumulation goal (RESP, emergency fund, down payment)
  //   "recurring_expense"= annual extra spend for N years (travel, sabbatical)
  cashflowType:        text("cashflow_type").default("savings_target"),
  targetYear:          integer("target_year"),          // calendar year goal hits
  projectionImpact:    boolean("projection_impact").default(false), // inject into Monte Carlo
  priority:            integer("priority").default(3),  // 1=critical, 5=nice-to-have
  monthlyContribution: decimal("monthly_contribution", { precision: 15, scale: 2 }), // savings toward goal
  inflationAdjust:     boolean("inflation_adjust").default(true),
  startYear:           integer("start_year"),           // for recurring_expense
  endYear:             integer("end_year"),              // for recurring_expense
  annualAmount:        decimal("annual_amount", { precision: 15, scale: 2 }), // for recurring_expense
  fundingSource:       text("funding_source").default("non_reg"), // non_reg|tfsa|rrsp|automatic
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const clientPolicies = pgTable("client_policies", {
  id:               serial("id").primaryKey(),
  clientId:         integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type:             text("type").notNull(),
  policyNumber:     text("policy_number"),
  provider:         text("provider"),
  insured:          text("insured"),
  coverageAmount:   decimal("coverage_amount", { precision: 15, scale: 2 }),
  premium:          decimal("premium", { precision: 10, scale: 2 }),
  premiumFrequency: text("premium_frequency"),
  inforceDate:      text("inforce_date"),
  renewalDate:      text("renewal_date"),
  beneficiary:      text("beneficiary"),
  notes:            text("notes"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export const householdExpenses = pgTable("household_expenses", {
  id:                      serial("id").primaryKey(),
  clientId:                integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  category:                text("category").notNull(),
  description:             text("description"),
  monthlyAmount:           decimal("monthly_amount", { precision: 10, scale: 2 }),
  annualAmount:            decimal("annual_amount", { precision: 15, scale: 2 }),
  frequency:               text("frequency"),
  isEssential:             boolean("is_essential").default(true),
  includeInRetirement:     boolean("include_in_retirement").default(true),
  retirementAdjustmentPct: integer("retirement_adjustment_pct").default(100),
  notes:                   text("notes"),
  createdAt:               timestamp("created_at").defaultNow().notNull(),
  updatedAt:               timestamp("updated_at").defaultNow().notNull(),
});

export const simulations = pgTable("simulations", {
  id:              serial("id").primaryKey(),
  clientId:        integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  successRate:     decimal("success_rate", { precision: 5, scale: 2 }),
  medianOutcome:   decimal("median_outcome", { precision: 15, scale: 2 }),
  worstCase:       decimal("worst_case", { precision: 15, scale: 2 }),
  bestCase:        decimal("best_case", { precision: 15, scale: 2 }),
  parameters:      jsonb("parameters"),
  results:         jsonb("results"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const pensionPlans = pgTable("pension_plans", {
  id:                         serial("id").primaryKey(),
  clientId:                   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  pensionType:                text("pension_type").notNull().default("dbpp"),
  subscriberOwner:            text("subscriber_owner").default("primary"),
  employerName:               text("employer_name"),
  accrualRate:                decimal("accrual_rate", { precision: 5, scale: 4 }),
  yearsOfService:             decimal("years_of_service", { precision: 5, scale: 2 }),
  projectedYearsAtRetirement: decimal("projected_years_at_retirement", { precision: 5, scale: 2 }),
  bestAverageEarnings:        decimal("best_average_earnings", { precision: 15, scale: 2 }),
  currentBalance:             decimal("current_balance", { precision: 15, scale: 2 }),
  employerMatchPct:           decimal("employer_match_pct", { precision: 5, scale: 4 }),
  retirementAge:              integer("retirement_age").default(65),
  indexingType:               text("indexing_type").default("none"),
  indexingRate:               decimal("indexing_rate", { precision: 5, scale: 4 }),
  bridgeBenefit:              decimal("bridge_benefit", { precision: 15, scale: 2 }),
  bridgeBenefitEndAge:        integer("bridge_benefit_end_age").default(65),
  survivorBenefitPct:         decimal("survivor_benefit_pct", { precision: 5, scale: 4 }),
  isVested:                   boolean("is_vested").default(true),
  notes:                      text("notes"),
  createdAt:                  timestamp("created_at").defaultNow().notNull(),
  updatedAt:                  timestamp("updated_at").defaultNow().notNull(),
  });

export const reasonWhyLetters = pgTable("reason_why_letters", {
  id:         serial("id").primaryKey(),
  clientId:   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  letterType: text("letter_type").notNull().default("life"),
  subject:    text("subject"),
  body:       text("body"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const capitalGainsPositions = pgTable("capital_gains_positions", {
  id:              serial("id").primaryKey(),
  clientId:        integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  owner:           text("owner").notNull().default("primary"),   // primary | spouse | joint
  type:            text("type").notNull().default("stock"),
  symbol:          text("symbol"),
  acb:             decimal("acb", { precision: 15, scale: 2 }).default("0"),
  fmv:             decimal("fmv", { precision: 15, scale: 2 }).default("0"),
  lcgeEligible:    boolean("lcge_eligible").default(false),
  notes:           text("notes"),
  province:        text("province"),
  marginalRate:    decimal("marginal_rate", { precision: 5, scale: 2 }),
  carryForwardLoss: decimal("carry_forward_loss", { precision: 15, scale: 2 }).default("0"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const taxAnalyses = pgTable("tax_analyses", {
  id:         serial("id").primaryKey(),
  clientId:   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type:       text("type").notNull(),
  owner:      text("owner").notNull().default("primary"),
  label:      text("label"),
  inputData:  jsonb("input_data"),
  resultData: jsonb("result_data"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const goalCheckIns = pgTable("goal_check_ins", {
  id:            serial("id").primaryKey(),
  goalId:        integer("goal_id").notNull().references(() => financialGoals.id, { onDelete: "cascade" }),
  checkInDate:   date("check_in_date").notNull().defaultNow(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
// ── PIPEDA AI Audit Log ───────────────────────────────────────────────────────
// Records every Anthropic API call made for report generation.
// Contains ZERO PII — only de-identified statistics and metadata.
// Required for PIPEDA breach reporting obligations (s. 10.1) and
// for demonstrating that personal financial data was not transmitted externally.
export const aiAuditLog = pgTable("ai_audit_log", {
  id:            serial("id").primaryKey(),
  // Identifies which client's report triggered the call — stored for breach tracing.
  // The client's financial data was NOT sent; only de-identified ratios were.
  clientId:      integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  // Which report type generated this call
  reportType:    text("report_type").notNull(),               // e.g. "retirement", "readiness"
  // SHA-256 of the de-identified payload — proves what was sent without storing it
  payloadHash:   text("payload_hash").notNull(),
  // Anthropic model used
  model:         text("model").notNull(),
  // Token usage for cost tracking and audit
  inputTokens:   integer("input_tokens").notNull().default(0),
  outputTokens:  integer("output_tokens").notNull().default(0),
  // Whether the call succeeded
  success:       boolean("success").notNull().default(true),
  errorMessage:  text("error_message"),
  // Duration in ms for SLA monitoring
  durationMs:    integer("duration_ms"),
  // The company this call belongs to (for multi-tenant cost allocation)
  companyId:     integer("company_id").references(() => companies.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ── LTC Analyses ──────────────────────────────────────────────────────────────
export const ltcAnalyses = pgTable("ltc_analyses", {
  id:                  serial("id").primaryKey(),
  clientId:            integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  person:              text("person").notNull().default("primary"),
  label:               text("label"),
  currentAge:          integer("current_age").notNull().default(55),
  province:            text("province").notNull().default("ON"),
  dailyBenefit:        decimal("daily_benefit", { precision: 10, scale: 2 }).notNull().default("200"),
  poolYears:           integer("pool_years").notNull().default(5),
  eliminationDays:     integer("elimination_days").notNull().default(90),
  inflationProtection: text("inflation_protection").notNull().default("none"),
  estAnnualPremium:    decimal("est_annual_premium", { precision: 10, scale: 2 }),
  careCostInflation:   decimal("care_cost_inflation", { precision: 5, scale: 4 }).notNull().default("0.04"),
  estClaimAge:         integer("est_claim_age").notNull().default(80),
  careLevel:           text("care_level").notNull().default("semi_private"),
  hybridLifeBenefit:   decimal("hybrid_life_benefit", { precision: 10, scale: 2 }),
  hybridLtcPct:        decimal("hybrid_ltc_pct", { precision: 5, scale: 2 }),
  notes:               text("notes"),
  resultData:          jsonb("result_data"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});
export type LtcAnalysis       = typeof ltcAnalyses.$inferSelect;
export type InsertLtcAnalysis = typeof ltcAnalyses.$inferInsert;

// ── DI Analyses ───────────────────────────────────────────────────────────────
export const diAnalyses = pgTable("di_analyses", {
  id:                    serial("id").primaryKey(),
  clientId:              integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  person:                text("person").notNull().default("primary"),
  label:                 text("label"),
  grossMonthlyIncome:    decimal("gross_monthly_income",    { precision: 10, scale: 2 }).notNull().default("0"),
  occupationClass:       text("occupation_class").notNull().default("3A"),
  definition:            text("definition").notNull().default("own_occ"),
  waitingPeriodDays:     integer("waiting_period_days").notNull().default(90),
  benefitPeriod:         text("benefit_period").notNull().default("age65"),
  groupDiMonthly:        decimal("group_di_monthly",        { precision: 10, scale: 2 }).notNull().default("0"),
  groupDiEmployerPaid:   boolean("group_di_employer_paid").notNull().default(true),
  individualDiMonthly:   decimal("individual_di_monthly",   { precision: 10, scale: 2 }).notNull().default("0"),
  cppDisabilityMonthly:  decimal("cpp_disability_monthly",  { precision: 10, scale: 2 }).notNull().default("0"),
  partialDisabilityPct:  decimal("partial_disability_pct",  { precision: 5,  scale: 2 }).notNull().default("0.50"),
  colaPct:               decimal("cola_pct",                { precision: 5,  scale: 4 }).notNull().default("0.02"),
  province:              text("province").notNull().default("ON"),
  notes:                 text("notes"),
  resultData:            jsonb("result_data"),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
});
export type DiAnalysis       = typeof diAnalyses.$inferSelect;
export type InsertDiAnalysis = typeof diAnalyses.$inferInsert;
