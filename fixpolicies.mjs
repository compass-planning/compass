import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await pool.query("ALTER TABLE client_policies ADD COLUMN IF NOT EXISTS review_date TEXT");
console.log('done');
await pool.end();
