const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const sql = [
  "CREATE TABLE IF NOT EXISTS activity_logs (",
  "  id           SERIAL PRIMARY KEY,",
  "  client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,",
  "  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,",
  "  action       TEXT NOT NULL,",
  "  model        TEXT,",
  "  input_tokens  INTEGER,",
  "  output_tokens INTEGER,",
  "  payload_hash TEXT,",
  "  metadata     JSONB,",
  "  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_activity_logs_client_id ON activity_logs(client_id);",
  "CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);",
].join("\n");

client
  .connect()
  .then(function () {
    return client.query(sql);
  })
  .then(function () {
    console.log("Done - activity_logs table created");
    return client.end();
  })
  .catch(function (err) {
    console.error("Failed:", err.message);
    client.end();
    process.exit(1);
  });