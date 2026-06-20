const { Client } = require("pg");
const DB = "postgresql://fly-user:sQ0gbV8vgoHlRvp9ASvKIWMa@localhost:16380/fly-db";

const FIREBASE_UID = "OwOCfpoyZbXmD9K168qK2cZe1jf1";

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const r = await c.query(
    "UPDATE users SET firebase_uid = $1 WHERE email = $2",
    [FIREBASE_UID, "scottyw811@gmail.com"]
  );
  console.log(r.rowCount ? "✓ Linked scottyw811@gmail.com" : "✗ User not found");
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
