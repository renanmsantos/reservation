import { NextResponse } from "next/server";

import { logReservationEvent } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: overrideId } = await context.params;

  if (!overrideId) {
    return NextResponse.json({ message: "Override id is required." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("duplicate_name_overrides")
      .delete()
      .eq("id", overrideId)
      .select("full_name")
      .single();

    if (error) {
      throw error;
    }

    await logReservationEvent(client, "override_removed", {
      full_name: data?.full_name,
      override_id: overrideId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to remove override.",
      },
      { status: 500 },
    );
  }
}
