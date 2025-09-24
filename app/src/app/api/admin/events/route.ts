import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);

  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("reservation_events")
      .select("id, event_type, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load events.",
      },
      { status: 500 },
    );
  }
}
