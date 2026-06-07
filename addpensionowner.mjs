import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await pool.query("ALTER TABLE pension_plans ADD COLUMN IF NOT EXISTS subscriber_owner TEXT DEFAULT 'primary'");
console.log('done');
await pool.end();
