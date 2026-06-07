import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await pool.query("ALTER TABLE household_expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()");
console.log('done');
await pool.end();
