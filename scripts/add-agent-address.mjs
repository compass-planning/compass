import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS address    TEXT,
    ADD COLUMN IF NOT EXISTS city       TEXT,
    ADD COLUMN IF NOT EXISTS province   TEXT,
    ADD COLUMN IF NOT EXISTS us_state   TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT
`);
await pool.end();
console.log('Agent address columns added');
