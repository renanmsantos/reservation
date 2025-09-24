import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  try {
    const client = createServiceRoleClient();

    const { data: vans, error } = await client
      .from("vans")
      .select("id, name, capacity, departure_timestamp")
      .order("departure_timestamp", { ascending: true });

    if (error || !vans) {
      throw error ?? new Error("No vans found");
    }

    const summaries = await Promise.all(
      vans.map(async (van) => {
        const [{ count: confirmedCount }, { count: waitlistedCount }] = await Promise.all([
          client
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("van_id", van.id)
            .eq("status", "confirmed"),
          client
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("van_id", van.id)
            .eq("status", "waitlisted"),
        ]);

        return {
          ...van,
          confirmedCount: confirmedCount ?? 0,
          waitlistedCount: waitlistedCount ?? 0,
        };
      }),
    );

    return NextResponse.json({ vans: summaries });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load vans.",
      },
      { status: 500 },
    );
  }
}
