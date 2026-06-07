import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
  CREATE TABLE IF NOT EXISTS ltc_analyses (
    id                     SERIAL PRIMARY KEY,
    client_id              INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    person                 TEXT NOT NULL DEFAULT 'primary',
    label                  TEXT,
    current_age            INTEGER NOT NULL DEFAULT 55,
    province               TEXT NOT NULL DEFAULT 'ON',
    daily_benefit          NUMERIC(10,2) NOT NULL DEFAULT 200,
    pool_years             INTEGER NOT NULL DEFAULT 5,
    elimination_days       INTEGER NOT NULL DEFAULT 90,
    inflation_protection   TEXT NOT NULL DEFAULT 'none',
    est_annual_premium     NUMERIC(10,2),
    care_cost_inflation    NUMERIC(5,4) NOT NULL DEFAULT 0.04,
    est_claim_age          INTEGER NOT NULL DEFAULT 80,
    care_level             TEXT NOT NULL DEFAULT 'semi_private',
    hybrid_life_benefit    NUMERIC(10,2),
    hybrid_ltc_pct         NUMERIC(5,2),
    notes                  TEXT,
    result_data            JSONB,
    created_at             TIMESTAMP DEFAULT NOW(),
    updated_at             TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS di_analyses (
    id                       SERIAL PRIMARY KEY,
    client_id                INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    person                   TEXT NOT NULL DEFAULT 'primary',
    label                    TEXT,
    gross_monthly_income     NUMERIC(10,2) NOT NULL DEFAULT 0,
    occupation_class         TEXT NOT NULL DEFAULT '3A',
    definition               TEXT NOT NULL DEFAULT 'own_occ',
    waiting_period_days      INTEGER NOT NULL DEFAULT 90,
    benefit_period           TEXT NOT NULL DEFAULT 'age65',
    group_di_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
    group_di_employer_paid   BOOLEAN NOT NULL DEFAULT TRUE,
    individual_di_monthly    NUMERIC(10,2) NOT NULL DEFAULT 0,
    cpp_disability_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
    partial_disability_pct   NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    cola_pct                 NUMERIC(5,4) NOT NULL DEFAULT 0.02,
    province                 TEXT NOT NULL DEFAULT 'ON',
    notes                    TEXT,
    result_data              JSONB,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_ltc_analyses_client ON ltc_analyses(client_id);
  CREATE INDEX IF NOT EXISTS idx_di_analyses_client  ON di_analyses(client_id);
`);
await pool.end();
console.log('ltc_analyses and di_analyses tables created');
