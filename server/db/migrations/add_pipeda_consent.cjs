const { Client } = require("pg");

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS consent_data_processing BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS consent_marketing       BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS consent_crm_sharing     BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS consent_updated_at      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS purge_requested_at      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS purge_at                TIMESTAMPTZ;
    `);
    console.log("✓ Added PIPEDA consent + erasure columns to users");
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);
