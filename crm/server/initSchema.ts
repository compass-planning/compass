import { pool, CRM_SCHEMA } from "./db";
import { logger } from "./logger";
import { BASELINE_SQL } from "./baselineSql";

/**
 * Additive changes applied on every start (idempotent). Used for tables/columns added after the
 * first-run baseline, so existing databases pick them up without a manual migration.
 */
const ADDITIVE_SQL = `
CREATE TABLE IF NOT EXISTS email_audit_logs (
  id serial PRIMARY KEY NOT NULL,
  company_id integer,
  actor_type text NOT NULL,
  actor_id integer NOT NULL,
  action text NOT NULL,
  provider text,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pension_plans ADD COLUMN IF NOT EXISTS contribution_start_age integer;
ALTER TABLE pension_plans ADD COLUMN IF NOT EXISTS no_longer_contributing boolean DEFAULT false;
ALTER TABLE pension_plans ADD COLUMN IF NOT EXISTS avg_annual_return numeric(5,2);
ALTER TABLE pension_plans ADD COLUMN IF NOT EXISTS annual_contribution numeric(15,2);
ALTER TABLE plan_snapshots ADD COLUMN IF NOT EXISTS median_outcome numeric(15,2);
ALTER TABLE plan_snapshots ADD COLUMN IF NOT EXISTS percentile_10 numeric(15,2);
ALTER TABLE plan_snapshots ADD COLUMN IF NOT EXISTS percentile_90 numeric(15,2);
ALTER TABLE plan_snapshots ADD COLUMN IF NOT EXISTS paths jsonb;
CREATE INDEX IF NOT EXISTS email_audit_logs_company_idx ON email_audit_logs (company_id, id);

CREATE TABLE IF NOT EXISTS zoom_accounts (
  id serial PRIMARY KEY NOT NULL,
  company_id integer,
  staff_id integer NOT NULL UNIQUE,
  zoom_user_id text NOT NULL,
  zoom_email text,
  status text NOT NULL DEFAULT 'connected',
  granted_scopes text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoom_accounts_company_idx ON zoom_accounts (company_id);
CREATE INDEX IF NOT EXISTS zoom_accounts_zoom_user_idx ON zoom_accounts (zoom_user_id);
CREATE TABLE IF NOT EXISTS zoom_oauth_tokens (
  id serial PRIMARY KEY NOT NULL,
  account_id integer NOT NULL UNIQUE,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  encryption_key_version text NOT NULL DEFAULT 'v1',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zoom_meetings (
  id serial PRIMARY KEY NOT NULL,
  company_id integer,
  staff_id integer NOT NULL,
  client_id integer,
  zoom_meeting_id text NOT NULL,
  topic text,
  start_local text,
  timezone text,
  duration_min integer,
  join_url text,
  calendar_event_id text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoom_meetings_staff_event_idx ON zoom_meetings (staff_id, calendar_event_id);
CREATE INDEX IF NOT EXISTS zoom_meetings_company_idx ON zoom_meetings (company_id);
CREATE INDEX IF NOT EXISTS zoom_meetings_client_idx ON zoom_meetings (client_id);
CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id serial PRIMARY KEY NOT NULL,
  client_id integer NOT NULL,
  label text NOT NULL DEFAULT 'Scenario Comparison',
  scenario_ids integer[] NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saved_reports (
  id serial PRIMARY KEY NOT NULL,
  client_id integer NOT NULL,
  plan_id integer,
  advisor_id integer,
  title text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_content text,
  generated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS projection_data jsonb;
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS run_id text;
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pension_type text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS retained_by_staff_id integer;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS profile_synced text;
ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS nw_entry_id integer;
ALTER TABLE client_policies ADD COLUMN IF NOT EXISTS agent_of_record boolean DEFAULT false;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until timestamp;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_failed_login_at timestamp;
CREATE TABLE IF NOT EXISTS security_events (
  id serial PRIMARY KEY NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  type text NOT NULL,
  email text,
  staff_id integer,
  company_id integer,
  ip text,
  user_agent text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'crm';
CREATE TABLE IF NOT EXISTS public.planning_lockouts (
  email text PRIMARY KEY, failed_count integer NOT NULL DEFAULT 0, locked_until timestamp, last_failed_at timestamp
);
CREATE INDEX IF NOT EXISTS security_events_type_ip_idx ON security_events (type, ip, created_at);
CREATE INDEX IF NOT EXISTS security_events_staff_idx ON security_events (staff_id, created_at);
CREATE TABLE IF NOT EXISTS uptime_checks (id serial PRIMARY KEY, checked_at timestamp NOT NULL DEFAULT now(), ok boolean NOT NULL, latency_ms integer, detail jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE INDEX IF NOT EXISTS uptime_checks_at_idx ON uptime_checks (checked_at);
CREATE TABLE IF NOT EXISTS incidents (id serial PRIMARY KEY, started_at timestamp NOT NULL, ended_at timestamp, kind text NOT NULL, source text NOT NULL DEFAULT 'monitor', detail jsonb NOT NULL DEFAULT '{}'::jsonb, note text);
CREATE TABLE IF NOT EXISTS privacy_breaches (
  id serial PRIMARY KEY, discovered_at date NOT NULL, occurred_at date, description text NOT NULL, data_types text,
  individuals_affected integer, apps text NOT NULL DEFAULT 'both', rrosh text NOT NULL DEFAULT 'unassessed',
  contained boolean NOT NULL DEFAULT false, opc_notified_at date, individuals_notified_at date,
  status text NOT NULL DEFAULT 'open', notes text, created_by text, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_requests (
  id serial PRIMARY KEY, app text NOT NULL DEFAULT 'crm', email text NOT NULL, kind text NOT NULL,
  received_at date NOT NULL DEFAULT current_date, due_at date NOT NULL, status text NOT NULL DEFAULT 'open',
  completed_at date, notes text, created_by text, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plan_prices (app text NOT NULL, plan text NOT NULL, monthly_price numeric(10,2) NOT NULL DEFAULT 0, PRIMARY KEY (app, plan));
CREATE TABLE IF NOT EXISTS login_devices (
  id serial PRIMARY KEY NOT NULL,
  staff_id integer NOT NULL,
  device_hash text NOT NULL,
  label text,
  ip text,
  user_agent text,
  first_seen timestamp NOT NULL DEFAULT now(),
  last_seen timestamp NOT NULL DEFAULT now(),
  UNIQUE (staff_id, device_hash)
);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en' NOT NULL;
ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS payoff_strategy text;
ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE di_analyses ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE di_analyses ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS child_dob text;
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS current_resp_balance numeric(15,2);
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS annual_contribution numeric(15,2);
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS target_amount numeric(15,2);
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS projected_balance numeric(15,2);
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS cesp_grant numeric(10,2);
ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE estate_planning_notes ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE estate_planning_notes ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE financial_plans ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' NOT NULL;
ALTER TABLE financial_plans ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS years_to_replace integer;
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS existing_disability numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS existing_critical_illness numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_life numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_disability numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_critical_illness numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS life_gap numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS disability_gap numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS critical_illness_gap numeric(15,2);
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE ltc_analyses ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE ltc_analyses ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE plan_action_items ADD COLUMN IF NOT EXISTS due_date text;
ALTER TABLE plan_stale_flags ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS person text DEFAULT 'primary';
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS tfsa_contributions_made numeric(15,2);
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS cpp_monthly numeric(10,2);
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS oas_monthly numeric(10,2);
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS success_rate numeric(5,2);
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
ALTER TABLE simulation_results ADD COLUMN IF NOT EXISTS median_outcome numeric(15,2);
ALTER TABLE simulation_results ADD COLUMN IF NOT EXISTS percentile_10 numeric(15,2);
ALTER TABLE simulation_results ADD COLUMN IF NOT EXISTS percentile_90 numeric(15,2);
ALTER TABLE simulation_results ADD COLUMN IF NOT EXISTS paths jsonb;
ALTER TABLE tax_planning_notes ADD COLUMN IF NOT EXISTS plan_id integer;
ALTER TABLE tax_planning_notes ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
`;

async function applyAdditive(client: { query: (q: string) => Promise<unknown> }): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL search_path TO ${CRM_SCHEMA}, public`);
    await client.query(ADDITIVE_SQL);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Creates the "crm" Postgres schema and (on first run only) all CRM tables inside it.
 * Idempotent and safe with several machines starting at once (advisory lock).
 * Additive changes after the first run belong in `scripts/reconcile-schema.ts`.
 */
export async function ensureCrmSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(7461001)");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${CRM_SCHEMA}`);
    const { rows } = await client.query(
      `SELECT to_regclass('${CRM_SCHEMA}.staff') AS t`,
    );
    if (rows[0]?.t) {
      // One-time upgrade: Pipeline and Analytics used to be off by default. Switch them on for
      // existing companies once (detected by the old column default), then never touch them again.
      const d = await client.query(
        `SELECT column_default FROM information_schema.columns
         WHERE table_schema='${CRM_SCHEMA}' AND table_name='companies' AND column_name='module_pipeline'`,
      );
      if (d.rows[0]?.column_default === "false") {
        await client.query(`ALTER TABLE ${CRM_SCHEMA}.companies ALTER COLUMN module_pipeline SET DEFAULT true`);
        await client.query(`ALTER TABLE ${CRM_SCHEMA}.companies ALTER COLUMN module_analytics SET DEFAULT true`);
        await client.query(`UPDATE ${CRM_SCHEMA}.companies SET module_pipeline = true, module_analytics = true`);
        logger.info("[crm] enabled Pipeline and Analytics modules for existing companies");
      }
      await applyAdditive(client);
      return;
    }
    logger.info("[crm] first run — creating CRM tables in schema 'crm'");
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL search_path TO ${CRM_SCHEMA}, public`);
      await client.query(BASELINE_SQL);
      await client.query("COMMIT");
      await applyAdditive(client);
      logger.info("[crm] schema created");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(7461001)").catch(() => {});
    client.release();
  }
}
