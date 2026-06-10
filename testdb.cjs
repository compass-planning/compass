const { Client } = require("pg");
const c = new Client({ connectionString: "postgresql://fly-user:sQ0gbV8vgoHlRvp9ASvKIWMa@direct.z7y24od8ewmrgqd1.flympg.net/fly-db" });
c.connect()
  .then(() => c.query("SELECT current_database(), version()"))
  .then(r => { console.log("CONNECTED:", r.rows[0]); return c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'"); })
  .then(r => { console.log("TABLES:", r.rows.map(x => x.tablename)); c.end(); })
  .catch(e => { console.error("FAILED:", e.message); c.end(); });