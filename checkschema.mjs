import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT table_schema, column_name FROM information_schema.columns WHERE column_name = 'review_date'");
console.log(JSON.stringify(r.rows));
await pool.end();
