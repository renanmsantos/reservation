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

const EVENT_NAME = "Evento Padrão";
const EVENT_STATUS = "em_andamento";

const getTodayAsDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

(async () => {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const eventDate = getTodayAsDateString();

    const existingEvent = await client.query<{ id: string }>(
      "select id from events where name = $1 limit 1",
      [EVENT_NAME],
    );

    let eventId = existingEvent.rows[0]?.id ?? null;

    if (!eventId) {
      const inserted = await client.query<{ id: string }>(
        `insert into events (name, event_date, status, total_cost)
         values ($1, $2::date, $3, 0)
         returning id`,
        [EVENT_NAME, eventDate, EVENT_STATUS],
      );
      eventId = inserted.rows[0].id;
    } else {
      await client.query(
        `update events
           set status = $2,
               event_date = $3,
               total_cost = 0,
               updated_at = now()
         where id = $1`,
        [eventId, EVENT_STATUS, eventDate],
      );
    }

    const vans = await client.query<{ id: string }>("select id from vans");

    for (const van of vans.rows) {
      await client.query(
        `insert into event_vans (event_id, van_id, status, per_passenger_cost)
         values ($1, $2, 'aberta', 0)
         on conflict (event_id, van_id) do update set
           status = excluded.status,
           per_passenger_cost = excluded.per_passenger_cost,
           updated_at = now()
         ;`,
        [eventId, van.id],
      );

      await client.query(
        `update vans
           set default_event_id = $2,
               updated_at = now()
         where id = $1`,
        [van.id, eventId],
      );
    }

    await client.query(
      `update reservations
         set event_id = $1
       where event_id is null`,
      [eventId],
    );

    await client.query("COMMIT");
    console.log(`Default event '${EVENT_NAME}' ensured with ${vans.rows.length} van(s).`);
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Failed to rollback transaction:", rollbackError);
    });
    console.error("Failed to seed default event:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
