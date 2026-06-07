import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'household_expenses' AND column_name = 'plan_id'");
console.log(r.rows.length ? 'household_expenses: has plan_id' : 'household_expenses: no plan_id');
await pool.end();
