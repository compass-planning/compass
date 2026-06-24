/**
 * add_totp_auth.cjs
 * Run with flyctl proxy active:
 *   Terminal 1: flyctl proxy 5432:5432 -a <postgres-app>
 *   Terminal 2: node server/db/migrations/add_totp_auth.cjs
 */

const { Client } = require("pg");
require("dotenv/config");

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

  // Force IPv4 and disable SSL for local proxy
  const client = new Client({
    connectionString: url,
    ssl: false,
    host: "127.0.0.1",
  });

  await client.connect();
  console.log("Connected");

  // Run each ALTER separately — avoid multi-statement timeout issues
  const columns = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at    TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_code    TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret          TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret  TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at      TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes   TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code           TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires   TIMESTAMPTZ`,
  ];

  for (const sql of columns) {
    await client.query(sql);
    console.log("✓", sql.split("ADD COLUMN IF NOT EXISTS")[1]?.trim().split(" ")[0]);
  }

  // Mark existing Firebase users as email-verified
  const result = await client.query(`
    UPDATE users
    SET email_verified_at = NOW()
    WHERE email_verified_at IS NULL
      AND firebase_uid IS NOT NULL
  `);
  console.log(`✓ Marked ${result.rowCount} existing users as email-verified`);

  await client.end();
  console.log("✓ Migration complete");
}

run().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
