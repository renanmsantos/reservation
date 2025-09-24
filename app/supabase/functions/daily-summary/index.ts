import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient, type PostgrestMaybeSingleResponse } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

type CountQuery = PromiseLike<PostgrestMaybeSingleResponse<unknown>>;

const getCount = async (builder: CountQuery) => {
  const { count, error } = await builder;
  if (error) {
    throw error;
  }
  return count ?? 0;
};

serve(async (request) => {
  if (!supabase) {
    return new Response(
      JSON.stringify({ message: "Supabase client not configured." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("simulate") === "fail") {
      throw new Error("Simulated failure for alert testing.");
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

    const webhookUrl = Deno.env.get("ANALYTICS_WEBHOOK_URL");
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      });
    }

    const healthcheckUrl = Deno.env.get("HEALTHCHECKS_PING_URL");
    if (healthcheckUrl) {
      await fetch(healthcheckUrl, { method: "GET" }).catch((error) => {
        console.warn("Healthcheck ping failed", error);
      });
    }

    return new Response(JSON.stringify(summary), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to generate summary", error);

    const healthcheckUrl = Deno.env.get("HEALTHCHECKS_PING_URL_FAILED");
    if (healthcheckUrl) {
      await fetch(healthcheckUrl, { method: "GET" }).catch((pingError) => {
        console.warn("Failure healthcheck ping failed", pingError);
      });
    }

    return new Response(
      JSON.stringify({
        message: "Failed to compute analytics summary.",
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
