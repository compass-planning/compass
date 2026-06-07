import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const tables = ['net_worth_entries','retirement_projections','insurance_analyses','education_savings','debt_entries','tax_planning_notes','estate_planning_notes','client_policies'];
for (const t of tables) {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = '" + t + "' AND column_name = 'plan_id'");
  if (r.rows.length) console.log(t + ': has plan_id');
}
await pool.end();
