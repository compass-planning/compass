import pg from "pg";
const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  firm_name TEXT,
  security_question TEXT,
  security_answer_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth TEXT,
  province TEXT DEFAULT 'ON',
  occupation TEXT,
  employment_status TEXT,
  annual_income DECIMAL(15,2),
  spouse_first_name TEXT,
  spouse_last_name TEXT,
  spouse_date_of_birth TEXT,
  spouse_occupation TEXT,
  spouse_annual_income DECIMAL(15,2),
  spouse_retirement_age INTEGER,
  spouse_desired_retirement_income DECIMAL(15,2),
  retirement_age INTEGER,
  desired_retirement_income DECIMAL(15,2),
  dependants JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_plans (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'Financial Plan',
  status TEXT NOT NULL DEFAULT 'active',
  goal_amount DECIMAL(12,2),
  target_date TEXT,
  risk_tolerance TEXT,
  notes TEXT,
  planning_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS net_worth_entries (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  value DECIMAL(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS retirement_projections (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  current_age INTEGER NOT NULL,
  retirement_age INTEGER NOT NULL,
  life_expectancy INTEGER NOT NULL DEFAULT 90,
  current_savings DECIMAL(14,2) NOT NULL DEFAULT 0,
  rrsp_balance DECIMAL(14,2) DEFAULT 0,
  tfsa_balance DECIMAL(14,2) DEFAULT 0,
  non_reg_balance DECIMAL(14,2) DEFAULT 0,
  annual_contribution DECIMAL(14,2) NOT NULL DEFAULT 0,
  annual_tfsa_contribution DECIMAL(14,2) DEFAULT 0,
  annual_non_reg_contribution DECIMAL(14,2) DEFAULT 0,
  expected_return DECIMAL(5,2) NOT NULL DEFAULT 7,
  inflation_rate DECIMAL(5,2) NOT NULL DEFAULT 2,
  desired_retirement_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  projected_balance DECIMAL(14,2),
  shortfall_surplus DECIMAL(14,2),
  yearly_breakdown TEXT,
  cpp_start_age INTEGER DEFAULT 65,
  oas_start_age INTEGER DEFAULT 65,
  cpp_monthly DECIMAL(10,2) DEFAULT 900,
  oas_monthly DECIMAL(10,2) DEFAULT 700,
  rrif_conversion_age INTEGER DEFAULT 71,
  pension_income DECIMAL(14,2) DEFAULT 0,
  spouse_income DECIMAL(14,2) DEFAULT 0,
  province TEXT DEFAULT 'ON',
  equity_allocation DECIMAL(5,4) DEFAULT 0.6,
  bond_allocation DECIMAL(5,4) DEFAULT 0.4,
  years_in_canada INTEGER DEFAULT 40,
  success_rate DECIMAL(5,2),
  monte_carlo_results JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS insurance_analyses (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  annual_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  years_of_income_needed INTEGER NOT NULL DEFAULT 20,
  existing_life_coverage DECIMAL(14,2) NOT NULL DEFAULT 0,
  existing_assets DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_expenses DECIMAL(14,2) NOT NULL DEFAULT 0,
  existing_disability_coverage DECIMAL(14,2) NOT NULL DEFAULT 0,
  critical_illness_lump_sum DECIMAL(14,2) NOT NULL DEFAULT 0,
  existing_critical_illness_coverage DECIMAL(14,2) NOT NULL DEFAULT 0,
  recommended_life_coverage DECIMAL(14,2),
  life_coverage_gap DECIMAL(14,2),
  recommended_disability_coverage DECIMAL(14,2),
  disability_coverage_gap DECIMAL(14,2),
  recommended_critical_illness_coverage DECIMAL(14,2),
  critical_illness_coverage_gap DECIMAL(14,2),
  calculation_method TEXT DEFAULT 'dime',
  mortgage_balance DECIMAL(14,2) DEFAULT 0,
  total_debts DECIMAL(14,2) DEFAULT 0,
  final_expenses DECIMAL(14,2) DEFAULT 15000,
  worksheet_data JSONB,
  analysis_results JSONB,
  primary_name TEXT,
  primary_age INTEGER,
  spouse_name TEXT,
  spouse_age INTEGER,
  spouse_annual_income DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS education_savings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL DEFAULT 0,
  target_age INTEGER NOT NULL DEFAULT 18,
  current_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_contribution DECIMAL(14,2) NOT NULL DEFAULT 0,
  expected_return DECIMAL(5,2) NOT NULL DEFAULT 5,
  estimated_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  account_type TEXT NOT NULL DEFAULT 'RESP',
  family_income_bracket TEXT DEFAULT 'high',
  cesg_received_to_date DECIMAL(14,2) DEFAULT 0,
  clb_eligible BOOLEAN DEFAULT FALSE,
  projection_results JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_entries (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  balance DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  minimum_payment DECIMAL(14,2) NOT NULL DEFAULT 0,
  term TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_planning_notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  tax_year INTEGER NOT NULL DEFAULT 2024,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  action_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS estate_planning_notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  document_reference TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES financial_plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_assumptions (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL DEFAULT 'base',
  equity_return DECIMAL(6,4) NOT NULL DEFAULT 0.07,
  equity_volatility DECIMAL(6,4) NOT NULL DEFAULT 0.15,
  bond_return DECIMAL(6,4) NOT NULL DEFAULT 0.04,
  bond_volatility DECIMAL(6,4) NOT NULL DEFAULT 0.05,
  inflation_mean DECIMAL(6,4) NOT NULL DEFAULT 0.02,
  inflation_volatility DECIMAL(6,4) NOT NULL DEFAULT 0.01,
  corr_equity_bond DECIMAL(6,4) NOT NULL DEFAULT -0.15,
  corr_equity_inflation DECIMAL(6,4) NOT NULL DEFAULT 0.10,
  corr_bond_inflation DECIMAL(6,4) NOT NULL DEFAULT 0.30,
  plan_to_age INTEGER NOT NULL DEFAULT 95,
  simulation_count INTEGER NOT NULL DEFAULT 1000,
  cpp_start_age INTEGER NOT NULL DEFAULT 65,
  oas_start_age INTEGER NOT NULL DEFAULT 65,
  province TEXT NOT NULL DEFAULT 'ON',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(plan_id, scenario)
);

CREATE TABLE IF NOT EXISTS simulation_results (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  scenario TEXT NOT NULL DEFAULT 'base',
  success_rate DECIMAL(6,4) NOT NULL,
  p10 DECIMAL(14,2) NOT NULL,
  p25 DECIMAL(14,2) NOT NULL,
  p50 DECIMAL(14,2) NOT NULL,
  p75 DECIMAL(14,2) NOT NULL,
  p90 DECIMAL(14,2) NOT NULL,
  percentile_bands JSONB,
  module_medians JSONB,
  sensitivity_data JSONB,
  assumptions_snapshot JSONB,
  median_path JSONB,
  simulation_count INTEGER NOT NULL,
  years_projected INTEGER NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(plan_id, module, scenario)
);

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_stale_flags (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_action_items (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END; $$;
`;

try {
  await pool.query(sql);
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("✅ Tables:", r.rows.map(x => x.table_name).join(", "));
} catch (e) { console.error("❌", e.message); }
finally { await pool.end(); }
