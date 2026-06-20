const { Client } = require("pg");
const DB = "postgresql://fly-user:sQ0gbV8vgoHlRvp9ASvKIWMa@localhost:16380/fly-db";

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  
  const users = await c.query("SELECT id, email, firebase_uid, first_name, last_name, subscription_status FROM users ORDER BY id");
  console.log("USERS:", JSON.stringify(users.rows, null, 2));
  
  const clients = await c.query("SELECT id, user_id, first_name, last_name FROM clients ORDER BY id");
  console.log("CLIENTS:", JSON.stringify(clients.rows, null, 2));
  
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
