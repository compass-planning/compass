import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT id, first_name, last_name, dependants FROM clients LIMIT 5");
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
