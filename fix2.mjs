import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

const fixes = [
  // education_savings fixes
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS current_resp_balance DECIMAL(15,2)",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS annual_contribution DECIMAL(15,2)",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS target_amount DECIMAL(15,2)",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS projected_balance DECIMAL(15,2)",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS cesp_grant DECIMAL(10,2)",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS child_dob TEXT",
  // debt_entries fixes
  "ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS payoff_strategy TEXT",
  // simulations table
  "CREATE TABLE IF NOT EXISTS simulations (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, success_rate DECIMAL(5,2), median_outcome DECIMAL(15,2), worst_case DECIMAL(15,2), best_case DECIMAL(15,2), parameters JSONB, results JSONB, created_at TIMESTAMP DEFAULT NOW())",
  // plan tables
  "CREATE TABLE IF NOT EXISTS financial_plans (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL DEFAULT 'Financial Plan', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS plan_assumptions (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE, scenario TEXT NOT NULL DEFAULT 'base', equity_return DECIMAL(6,4), equity_volatility DECIMAL(6,4), bond_return DECIMAL(6,4), bond_volatility DECIMAL(6,4), inflation_mean DECIMAL(6,4), inflation_volatility DECIMAL(6,4), corr_equity_bond DECIMAL(6,4), corr_equity_inflation DECIMAL(6,4), corr_bond_inflation DECIMAL(6,4), plan_to_age INTEGER DEFAULT 95, simulation_count INTEGER DEFAULT 1000, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS simulation_results (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE, scenario TEXT NOT NULL, module TEXT, success_rate DECIMAL(5,2), median_outcome DECIMAL(15,2), percentile_10 DECIMAL(15,2), percentile_90 DECIMAL(15,2), paths JSONB, calculated_at TIMESTAMP DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS plan_snapshots (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE, snapshot_data JSONB, trigger TEXT DEFAULT 'manual', created_at TIMESTAMP DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS plan_stale_flags (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE, module TEXT NOT NULL, reason TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS plan_action_items (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'pending', due_date TEXT, priority TEXT DEFAULT 'medium', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
];

for (const sql of fixes) {
  try {
    await pool.query(sql);
    console.log('OK:', sql.substring(0, 60));
  } catch(e) {
    console.log('SKIP:', e.message.substring(0, 80));
  }
}
await pool.end();
