import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const sql = "CREATE TABLE IF NOT EXISTS reason_why_letters (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, letter_type TEXT NOT NULL DEFAULT 'life', subject TEXT, body TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())";
await pool.query(sql);
console.log('Table created');
await pool.end();
