// server/db/migrations/add_activity_logs.cjs
// Run: node server/db/migrations/add_activity_logs.cjs
// (with Fly postgres proxy active on port 5433)
//
// Creates the activity_logs table used for PIPEDA s. 10.1 breach-reporting
// obligations. Every Anthropic API call stores the payload hash and token
// counts so the exact payload can be proven without storing the data itself.

const { Client } = require("pg");

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:@localhost:5433/westoak_planner",
});

async function migrate() {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id              SERIAL PRIMARY KEY,
      client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action          TEXT    NOT NULL,
      model           TEXT,
      input_tokens    INTEGER,
      output_tokens   INTEGER,
      payload_hash    TEXT,
      metadata        JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_client_id
      ON activity_logs(client_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
      ON activity_logs(created_at DESC);
  `);

  console.log("✅ activity_logs table created (or already exists)");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
