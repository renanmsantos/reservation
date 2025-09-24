import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  config({ path: envPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE credentials (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const getCount = async (builder: any) => {
  const { count, error } = await builder;
  if (error) {
    throw error;
  }
  return count ?? 0;
};

(async () => {
  try {
    if (process.env.SUMMARY_SIMULATE_FAILURE === "true") {
      throw new Error("Simulated failure (SUMMARY_SIMULATE_FAILURE=true)");
    }

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      confirmedTotal,
      waitlistedTotal,
      cancelledTotal,
      reservationsLastDay,
      duplicateBlockedLastDay,
      overridesAddedLastDay,
      overridesActive,
    ] = await Promise.all([
      getCount(
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed"),
      ),
      getCount(
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "waitlisted"),
      ),
      getCount(
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "cancelled"),
      ),
      getCount(
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .gte("joined_at", since),
      ),
      getCount(
        supabase
          .from("reservation_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "duplicate_blocked")
          .gte("created_at", since),
      ),
      getCount(
        supabase
          .from("reservation_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "override_added")
          .gte("created_at", since),
      ),
      getCount(
        supabase
          .from("duplicate_name_overrides")
          .select("id", { count: "exact", head: true })
          .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`),
      ),
    ]);

    const summary = {
      generated_at: now.toISOString(),
      totals: {
        confirmed: confirmedTotal,
        waitlisted: waitlistedTotal,
        cancelled: cancelledTotal,
        overrides_active: overridesActive,
      },
      last_24h: {
        reservations_created: reservationsLastDay,
        duplicate_blocked: duplicateBlockedLastDay,
        overrides_added: overridesAddedLastDay,
      },
    };

    console.table({
      confirmed: summary.totals.confirmed,
      waitlisted: summary.totals.waitlisted,
      cancelled: summary.totals.cancelled,
      overrides_active: summary.totals.overrides_active,
      reservations_24h: summary.last_24h.reservations_created,
      duplicate_blocked_24h: summary.last_24h.duplicate_blocked,
      overrides_added_24h: summary.last_24h.overrides_added,
    });

    const webhookUrl = process.env.ANALYTICS_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      });
      console.log("Posted summary to analytics webhook.");
    }

    const healthcheckUrl = process.env.HEALTHCHECKS_PING_URL;
    if (healthcheckUrl) {
      await fetch(healthcheckUrl).catch((error) => {
        console.warn("Healthcheck ping failed", error);
      });
    }
  } catch (error) {
    console.error("Failed to compute daily summary", error);
    const failurePing = process.env.HEALTHCHECKS_PING_URL_FAILED;
    if (failurePing) {
      await fetch(failurePing).catch(() => {
        // ignore
      });
    }
    process.exitCode = 1;
  }
})();
