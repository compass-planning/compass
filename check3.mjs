import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ai_recommendations'");
console.log(r.rows.map(c => c.column_name + ' nullable=' + c.is_nullable + ' default=' + c.column_default).join('\n'));
await pool.end();
