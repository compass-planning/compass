import pg from 'pg';
import bcryptjs from 'bcryptjs';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const hash = await bcryptjs.hash('Knights99!', 10);
const r = await pool.query("SELECT id, email FROM users");
for (const u of r.rows) {
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, u.id]);
  console.log('Reset:', u.email);
}
await pool.end();
