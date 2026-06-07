import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'household_expenses'");
console.log(r.rows.map(c => c.column_name).join(', '));
await pool.end();
