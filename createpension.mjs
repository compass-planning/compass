import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const sql = "CREATE TABLE IF NOT EXISTS pension_plans (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, pension_type TEXT NOT NULL DEFAULT 'dbpp', employer_name TEXT, accrual_rate DECIMAL(5,4), years_of_service DECIMAL(5,2), projected_years_at_retirement DECIMAL(5,2), best_average_earnings DECIMAL(15,2), current_balance DECIMAL(15,2), employer_match_pct DECIMAL(5,4), retirement_age INTEGER DEFAULT 65, indexing_type TEXT DEFAULT 'none', indexing_rate DECIMAL(5,4), bridge_benefit DECIMAL(15,2), bridge_benefit_end_age INTEGER DEFAULT 65, survivor_benefit_pct DECIMAL(5,4), is_vested BOOLEAN DEFAULT true, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())";
await pool.query(sql);
console.log('pension_plans table created');
await pool.end();
