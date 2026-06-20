const { Client } = require("pg");

const FIREBASE_UID = "OwOCfpoyZbXmD9K168qK2cZe1jf1";
const DB = "postgresql://fly-user:sQ0gbV8vgoHlRvp9ASvKIWMa@localhost:16380/fly-db";

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const r = await c.query(
    `INSERT INTO users (firebase_uid, email, password_hash, first_name, last_name, jurisdiction, subscription_tier, subscription_status, trial_ends_at)
     VALUES ($1, $2, '', $3, $4, 'CA', 'trial', 'trialing', NOW() + INTERVAL '14 days')
     ON CONFLICT DO NOTHING`,
    [FIREBASE_UID, "scottyw811@gmail.com", "Scott", "Weston"]
  );
  console.log("Inserted:", r.rowCount, "row(s)");

  // Also create the financial profile
  const u = await c.query("SELECT id FROM users WHERE firebase_uid = $1", [FIREBASE_UID]);
  if (u.rows[0]) {
    await c.query(
      `INSERT INTO clients (user_id, first_name, last_name, email, jurisdiction, province)
       VALUES ($1, 'Scott', 'Weston', 'scottyw811@gmail.com', 'CA', 'ON')
       ON CONFLICT DO NOTHING`,
      [u.rows[0].id]
    );
    console.log("Profile created for user id:", u.rows[0].id);
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
