const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL_CA || process.env.DATABASE_URL });
p.query("UPDATE clients SET user_id = (SELECT id FROM users WHERE account_type = 'advisor' ORDER BY id LIMIT 1) WHERE id = 41")
  .then(r => { console.log('rows updated:', r.rowCount); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
