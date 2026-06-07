import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const sql = "CREATE TABLE IF NOT EXISTS financial_goals (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, goal_type TEXT NOT NULL DEFAULT 'custom', title TEXT NOT NULL, target_amount DECIMAL(15,2), current_amount DECIMAL(15,2), target_date TEXT, status TEXT NOT NULL DEFAULT 'in_progress', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())";
await pool.query(sql);
console.log('done');
await pool.end();
