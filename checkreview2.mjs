import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'client_policies' AND column_name ILIKE 'review%'");
console.log(JSON.stringify(r.rows));
await pool.end();
