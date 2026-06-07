import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

// Check education_savings columns
const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'education_savings'");
console.log('education_savings:', r.rows.map(c => c.column_name).join(', '));

// Check debt_entries columns  
const r2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'debt_entries'");
console.log('debt_entries:', r2.rows.map(c => c.column_name).join(', '));

// Check ai_recommendations columns
const r3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_recommendations'");
console.log('ai_recommendations:', r3.rows.map(c => c.column_name).join(', '));

await pool.end();
