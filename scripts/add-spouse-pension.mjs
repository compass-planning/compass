import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_pension_type TEXT');
await pool.end();
console.log('Column added');
