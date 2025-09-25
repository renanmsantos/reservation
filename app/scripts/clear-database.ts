import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config();

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL environment variable is not defined.");
  process.exit(1);
}

const tables = [
  "reservations",
  "reservation_events",
  "duplicate_name_overrides",
  "event_vans",
  "events",
  "vans",
];

async function clearDatabase() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    const truncateList = tables.map((table) => `public.${table}`).join(", ");
    await client.query(`TRUNCATE TABLE ${truncateList} CASCADE`);
    await client.query("COMMIT");
    console.log("Database cleared successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to clear database:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

clearDatabase();
