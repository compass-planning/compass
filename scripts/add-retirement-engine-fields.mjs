import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
  ALTER TABLE retirement_projections
    ADD COLUMN IF NOT EXISTS non_reg_tax_type TEXT DEFAULT 'mixed',
    ADD COLUMN IF NOT EXISTS non_reg_acb       NUMERIC(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pension_start_age INTEGER DEFAULT 65,
    ADD COLUMN IF NOT EXISTS pension_indexed   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS bridge_benefit    NUMERIC(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bridge_end_age    INTEGER DEFAULT 65,
    ADD COLUMN IF NOT EXISTS province          TEXT DEFAULT 'ON',
    ADD COLUMN IF NOT EXISTS projection_data   JSONB;
`);
await pool.end();
console.log('retirement_projections columns added');
