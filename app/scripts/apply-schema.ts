import fs from "node:fs";
import path from "node:path";

import { Client } from "pg";
import { config } from "dotenv";

const envPath = path.join(process.cwd(), ".env.local");
config({ path: envPath, override: true });

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Missing SUPABASE_DB_URL environment variable.");
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(schemaPath, "utf-8");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

(async () => {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  let transactionStarted = false;

  try {
    await client.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    // Drop the trigger if it already exists to prevent schema application errors
    await client.query('DROP TRIGGER IF EXISTS reservations_unique_name_enforcer ON reservations;');
    await client.query(sql);

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("Dry run succeeded; no changes committed.");
      return;
    }

    await client.query("COMMIT");
    console.log("Schema applied successfully.");
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch((rollbackError: unknown) => {
        console.error("Failed to rollback transaction:", rollbackError);
      });
    }
    console.error("Failed to apply schema:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
