import { NextResponse } from "next/server";

import { mapReservationRow } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vanId = url.searchParams.get("vanId");
  const status = url.searchParams.get("status");

  if (!vanId) {
    return NextResponse.json({ message: "vanId is required." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const { data, error } = await client
      .from("reservations")
      .select("id, van_id, full_name, email, status, position, joined_at, released_at")
      .eq("van_id", vanId)
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    const normalized = (data ?? []).map((row) => ({
      ...mapReservationRow(row),
      releasedAt: (row as { released_at?: string | null }).released_at ?? null,
    }));

    const filtered = status ? normalized.filter((item) => item.status === status) : normalized;

    return NextResponse.json({ reservations: filtered });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load reservations.",
      },
      { status: 500 },
    );
  }
}
