/**
 * create-tables.cjs
 * One-time table creation for the new compass-db.
 * Run with the mpg proxy active:  node create-tables.cjs
 * Reads DATABASE_URL from .env in the project root.
 */
require("dotenv").config();
const { Client } = require("pg");

const STATEMENTS = [
`CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  first_name text NOT NULL, last_name text NOT NULL, firm_name text,
  jurisdiction text NOT NULL DEFAULT 'CA', must_reset_password boolean DEFAULT false,
  phone text, email_verified boolean DEFAULT false, email_verify_code text,
  email_verify_expiry timestamp, sms_mfa_enabled boolean DEFAULT false,
  sms_code text, sms_code_expiry timestamp,
  address text, city text, province text, us_state text, postal_code text,
  subscription_tier text NOT NULL DEFAULT 'trial',
  subscription_status text NOT NULL DEFAULT 'trialing',
  stripe_customer_id text, stripe_subscription_id text,
  trial_ends_at timestamp, current_period_end timestamp,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS clients (
  id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name text NOT NULL, last_name text NOT NULL, email text, phone text,
  date_of_birth text, province text DEFAULT 'ON', occupation text, employment_status text,
  annual_income numeric(15,2), retirement_age integer, desired_retirement_income numeric(15,2),
  pension_type text, spouse_first_name text, spouse_last_name text, spouse_date_of_birth text,
  spouse_occupation text, spouse_annual_income numeric(15,2), spouse_retirement_age integer,
  spouse_desired_retirement_income numeric(15,2), spouse_pension_type text,
  dependants jsonb, notes text, jurisdiction text NOT NULL DEFAULT 'CA', us_state text,
  filing_status text, birth_year integer, preferred_language text NOT NULL DEFAULT 'en',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS financial_plans (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id),
  title text NOT NULL DEFAULT 'Financial Plan', status text NOT NULL DEFAULT 'draft',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS financial_goals (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type text NOT NULL DEFAULT 'custom', title text NOT NULL,
  target_amount numeric(15,2), current_amount numeric(15,2), target_date text,
  status text NOT NULL DEFAULT 'in_progress', notes text,
  cashflow_type text DEFAULT 'savings_target', target_year integer,
  projection_impact boolean DEFAULT false, priority integer DEFAULT 3,
  monthly_contribution numeric(15,2), inflation_adjust boolean DEFAULT true,
  start_year integer, end_year integer, annual_amount numeric(15,2),
  funding_source text DEFAULT 'non_reg',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS goal_check_ins (
  id serial PRIMARY KEY, goal_id integer NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  check_in_date date NOT NULL DEFAULT now(), current_amount numeric(15,2) DEFAULT '0',
  notes text, created_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS net_worth_entries (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, type text NOT NULL, category text NOT NULL, name text NOT NULL,
  value numeric(15,2) NOT NULL, owner text, notes text, metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS debt_entries (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, name text NOT NULL, category text NOT NULL,
  balance numeric(15,2) NOT NULL, interest_rate numeric(5,2), minimum_payment numeric(10,2),
  payoff_strategy text, term text, priority integer, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS education_savings (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, child_name text NOT NULL, child_dob text, child_age integer,
  target_age integer, current_resp_balance numeric(15,2), annual_contribution numeric(15,2),
  monthly_contribution numeric(10,2), expected_return numeric(5,2), target_amount numeric(15,2),
  estimated_cost numeric(15,2), projected_balance numeric(15,2), cesp_grant numeric(10,2),
  account_type text DEFAULT 'RESP', notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS retirement_projections (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, person text DEFAULT 'primary', label text,
  current_age integer, retirement_age integer, life_expectancy integer,
  current_savings numeric(15,2), rrsp_balance numeric(15,2), tfsa_balance numeric(15,2),
  non_reg_balance numeric(15,2), annual_contribution numeric(15,2),
  annual_tfsa_contribution numeric(15,2), tfsa_contributions_made numeric(15,2),
  expected_return numeric(5,2), inflation_rate numeric(5,2),
  desired_retirement_income numeric(15,2), pension_income numeric(15,2),
  cpp_start_age integer, oas_start_age integer, cpp_monthly numeric(10,2), oas_monthly numeric(10,2),
  projected_balance numeric(15,2), shortfall_surplus numeric(15,2), success_rate numeric(5,2),
  notes text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS pension_plans (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pension_type text NOT NULL DEFAULT 'dbpp', subscriber_owner text DEFAULT 'primary',
  employer_name text, accrual_rate numeric(5,4), years_of_service numeric(5,2),
  projected_years_at_retirement numeric(5,2), best_average_earnings numeric(15,2),
  current_balance numeric(15,2), employer_match_pct numeric(5,4),
  retirement_age integer DEFAULT 65, indexing_type text DEFAULT 'none', indexing_rate numeric(5,4),
  bridge_benefit numeric(15,2), bridge_benefit_end_age integer DEFAULT 65,
  survivor_benefit_pct numeric(5,4), is_vested boolean DEFAULT true, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS household_expenses (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category text NOT NULL, description text, monthly_amount numeric(10,2), annual_amount numeric(15,2),
  frequency text, is_essential boolean DEFAULT true, include_in_retirement boolean DEFAULT true,
  retirement_adjustment_pct integer DEFAULT 100, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS insurance_analyses (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, method text, primary_name text, primary_age integer,
  spouse_name text, spouse_age integer, annual_income numeric(15,2), spouse_annual_income numeric(15,2),
  years_to_replace integer, existing_life_coverage numeric(15,2), existing_disability numeric(15,2),
  existing_critical_illness numeric(15,2), recommended_life numeric(15,2),
  recommended_disability numeric(15,2), recommended_critical_illness numeric(15,2),
  recommended_disability_coverage numeric(15,2), critical_illness_lump_sum numeric(15,2),
  life_gap numeric(15,2), disability_gap numeric(15,2), critical_illness_gap numeric(15,2),
  worksheet_data jsonb, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS client_policies (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL, policy_number text, provider text, insured text,
  coverage_amount numeric(15,2), premium numeric(10,2), premium_frequency text,
  inforce_date text, renewal_date text, beneficiary text, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS tax_planning_notes (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, tax_year integer, category text, title text NOT NULL, content text NOT NULL,
  action_required boolean DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS estate_planning_notes (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, category text, title text NOT NULL, content text NOT NULL,
  document_reference text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS tax_analyses (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL, owner text NOT NULL DEFAULT 'primary', label text,
  input_data jsonb, result_data jsonb,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS capital_gains_positions (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  owner text NOT NULL DEFAULT 'primary', type text NOT NULL DEFAULT 'stock', symbol text,
  acb numeric(15,2) DEFAULT '0', fmv numeric(15,2) DEFAULT '0', lcge_eligible boolean DEFAULT false,
  notes text, province text, marginal_rate numeric(5,2), carry_forward_loss numeric(15,2) DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS ai_recommendations (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer, run_id text, category text NOT NULL, priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL, content text, description text, status text NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS plan_assumptions (
  id serial PRIMARY KEY, plan_id integer NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  scenario text NOT NULL DEFAULT 'base', equity_return numeric(6,4), equity_volatility numeric(6,4),
  bond_return numeric(6,4), bond_volatility numeric(6,4), inflation_mean numeric(6,4),
  inflation_volatility numeric(6,4), corr_equity_bond numeric(6,4), corr_equity_inflation numeric(6,4),
  corr_bond_inflation numeric(6,4), plan_to_age integer DEFAULT 95, simulation_count integer DEFAULT 1000,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS simulation_results (
  id serial PRIMARY KEY, plan_id integer NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  scenario text NOT NULL, module text, success_rate numeric(5,2), median_outcome numeric(15,2),
  percentile_10 numeric(15,2), percentile_90 numeric(15,2), paths jsonb,
  calculated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS simulations (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  success_rate numeric(5,2), median_outcome numeric(15,2), worst_case numeric(15,2),
  best_case numeric(15,2), parameters jsonb, results jsonb,
  created_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS plan_snapshots (
  id serial PRIMARY KEY, plan_id integer NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  snapshot_data jsonb, trigger text DEFAULT 'manual', created_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS plan_stale_flags (
  id serial PRIMARY KEY, plan_id integer NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  module text NOT NULL, reason text, resolved_at timestamp, created_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS plan_action_items (
  id serial PRIMARY KEY, plan_id integer NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  title text NOT NULL, description text, status text DEFAULT 'pending', due_date text,
  priority text DEFAULT 'medium',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Scenario Comparison', scenario_ids integer[] NOT NULL, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS reason_why_letters (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  letter_type text NOT NULL DEFAULT 'life', subject text, body text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS ltc_analyses (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer REFERENCES financial_plans(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS di_analyses (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer REFERENCES financial_plans(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS saved_reports (
  id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id integer REFERENCES financial_plans(id) ON DELETE CASCADE,
  advisor_id integer, title text NOT NULL, locale text NOT NULL DEFAULT 'en',
  sections jsonb NOT NULL DEFAULT '[]', html_content text,
  generated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS audit_log (
  id serial PRIMARY KEY, user_id integer, client_id integer, action text NOT NULL,
  data_category text, outcome text DEFAULT 'success', user_email text, ip_address text,
  correlation_id text, jurisdiction text, external_processor text, error_message text, details jsonb,
  created_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS admin_users (
  id serial PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  name text NOT NULL, role text NOT NULL DEFAULT 'support',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY, user_id integer REFERENCES users(id) ON DELETE SET NULL,
  user_email text, subject text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'open', priority text NOT NULL DEFAULT 'normal',
  assigned_to integer REFERENCES admin_users(id) ON DELETE SET NULL,
  resolved_at timestamp, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
)`,
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log("Connected to", (await c.query("SELECT current_database()")).rows[0].current_database);
  let ok = 0, failed = 0;
  for (const sql of STATEMENTS) {
    const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] ?? "?";
    try {
      await c.query(sql);
      console.log("✓", name);
      ok++;
    } catch (e) {
      console.error("✗", name, "-", e.message);
      failed++;
    }
  }
  const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log(`\nDone: ${ok} ok, ${failed} failed`);
  console.log("Tables now in db:", tables.rows.map(r => r.tablename).join(", "));
  await c.end();
})();
