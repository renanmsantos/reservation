import { NextResponse } from "next/server";

import { logReservationEvent } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: vanId } = await context.params;

  if (!vanId) {
    return NextResponse.json({ message: "Van id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { capacity?: number } | null;

  if (!body || typeof body.capacity !== "number") {
    return NextResponse.json({ message: "Capacity is required." }, { status: 400 });
  }

  if (body.capacity < 1 || body.capacity > 64) {
    return NextResponse.json({ message: "Capacity must be between 1 and 64." }, { status: 422 });
  }

  try {
    const client = createServiceRoleClient();

    const { data: van, error: vanError } = await client
      .from("vans")
      .update({ capacity: body.capacity })
      .eq("id", vanId)
      .select("id, name, capacity")
      .single();

    if (vanError || !van) {
      throw vanError ?? new Error("Failed to update van");
    }

    await logReservationEvent(client, "capacity_updated", {
      van_id: vanId,
      capacity: body.capacity,
    });

    return NextResponse.json({ van });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update capacity.",
      },
      { status: 500 },
    );
  }
}
