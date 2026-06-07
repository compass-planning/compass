import pg from 'pg';
import bcrypt from 'bcryptjs';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT email, password_hash, must_reset_password FROM users");
for (const u of r.rows) {
  const match = await bcrypt.compare('Knights99!', u.password_hash);
  console.log(u.email, 'match:', match, 'mustReset:', u.must_reset_password);
}
await pool.end();
