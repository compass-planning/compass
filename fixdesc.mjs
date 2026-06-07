import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const fixes = [
  "ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE net_worth_entries ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE education_savings ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE debt_entries ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE tax_planning_notes ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE estate_planning_notes ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE client_policies ADD COLUMN IF NOT EXISTS description TEXT",
];
for (const sql of fixes) {
  await pool.query(sql);
  console.log('OK:', sql.substring(0, 60));
}
await pool.end();
