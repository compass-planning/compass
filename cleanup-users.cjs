const { Client } = require("pg");
const DB = "postgresql://fly-user:sQ0gbV8vgoHlRvp9ASvKIWMa@localhost:16380/fly-db";

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  
  // Delete clients first (foreign key), then users
  const emails = ["letsjusttry2024@gmail.com", "jamieburans0908@gmail.com"];
  
  for (const email of emails) {
    const u = await c.query("SELECT id FROM users WHERE email = $1", [email]);
    if (!u.rows[0]) { console.log("Not found:", email); continue; }
    const id = u.rows[0].id;
    await c.query("DELETE FROM clients WHERE user_id = $1", [id]);
    await c.query("DELETE FROM users WHERE id = $1", [id]);
    console.log("✓ Deleted:", email);
  }
  
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
