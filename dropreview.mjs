import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await pool.query("ALTER TABLE client_policies DROP COLUMN IF EXISTS review_date");
console.log('done');
await pool.end();
