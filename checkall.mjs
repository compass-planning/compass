import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const tables = ['client_policies','retirement_projections','household_expenses'];
for (const t of tables) {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = '" + t + "' ORDER BY ordinal_position");
  console.log('\n' + t + ':');
  console.log(r.rows.map(c => c.column_name).join(', '));
}
await pool.end();
