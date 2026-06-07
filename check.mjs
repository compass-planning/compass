import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const tables = ['net_worth_entries','retirement_projections','insurance_analyses','education_savings','debt_entries','tax_planning_notes','estate_planning_notes','ai_recommendations','client_policies','household_expenses','clients','financial_plans','simulations'];
for (const t of tables) {
  const r = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = ' + "'" + t + "'");
  console.log(t + ': ' + r.rows.map(c => c.column_name).join(', '));
}
await pool.end();
