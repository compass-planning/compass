import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const fixes = [
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS existing_disability DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS existing_critical_illness DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_life DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_disability DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS recommended_critical_illness DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS life_gap DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS disability_gap DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS critical_illness_gap DECIMAL(15,2)",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS years_to_replace INTEGER",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS method TEXT",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS notes TEXT",
  "ALTER TABLE insurance_analyses ADD COLUMN IF NOT EXISTS worksheet_data JSONB",
];
for (const sql of fixes) {
  try { await pool.query(sql); console.log('OK:', sql.substring(0,60)); }
  catch(e) { console.log('SKIP:', e.message.substring(0,60)); }
}
await pool.end();
