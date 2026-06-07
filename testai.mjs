import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
try {
  const r = await pool.query("INSERT INTO ai_recommendations (client_id, category, priority, title, content, status) VALUES (7, 'test', 'medium', 'Test', 'Test content', 'pending') RETURNING id");
  console.log('INSERT OK:', r.rows[0].id);
  await pool.query("DELETE FROM ai_recommendations WHERE id = " + r.rows[0].id);
  console.log('CLEANUP OK');
} catch(e) {
  console.log('ERROR:', e.message);
}
await pool.end();
