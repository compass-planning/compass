const { Client } = require("pg");

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE pension_plans 
      ADD COLUMN IF NOT EXISTS subscriber_owner TEXT DEFAULT 'primary';
    `);
    console.log("✓ Added subscriber_owner to pension_plans");
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);