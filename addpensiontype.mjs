import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS pension_type TEXT");
console.log('done');
await pool.end();
