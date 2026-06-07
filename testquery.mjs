import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
try {
  const r = await pool.query('SELECT id, client_id, type, policy_number, provider, insured, coverage_amount, premium, premium_frequency, inforce_date, renewal_date, review_date, beneficiary, notes, created_at, updated_at, description FROM client_policies LIMIT 1');
  console.log('Query OK, rows:', r.rows.length);
} catch(e) {
  console.log('ERROR:', e.message);
}
await pool.end();
