import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
  CREATE TABLE IF NOT EXISTS scenario_comparisons (
    id            SERIAL PRIMARY KEY,
    client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    label         TEXT NOT NULL DEFAULT 'Scenario Comparison',
    scenario_ids  INTEGER[] NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_scenario_comparisons_client
    ON scenario_comparisons(client_id);
`);
await pool.end();
console.log('scenario_comparisons table created');
