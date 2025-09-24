import { NextResponse } from "next/server";

import { logReservationEvent } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("duplicate_name_overrides")
      .select("id, full_name, reason, expires_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ overrides: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load overrides.",
      },
      { status: 500 },
    );
  }
}

type OverridePayload = {
  fullName?: string;
  reason?: string;
  durationHours?: number | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as OverridePayload | null;

  if (!body?.fullName) {
    return NextResponse.json({ message: "Full name is required." }, { status: 400 });
  }

  const fullName = body.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 3) {
    return NextResponse.json({ message: "Full name must be at least 3 characters." }, { status: 422 });
  }

  const expiresAt = body.durationHours
    ? new Date(Date.now() + body.durationHours * 60 * 60 * 1000).toISOString()
    : null;

  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("duplicate_name_overrides")
      .upsert(
        {
          full_name: fullName,
          reason: body.reason ?? null,
          expires_at: expiresAt,
        },
        { onConflict: "full_name" },
      )
      .select("id, full_name, reason, expires_at, created_at")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to save override");
    }

    await logReservationEvent(client, "override_added", {
      full_name: fullName,
      expires_at: expiresAt,
    });

    return NextResponse.json({ override: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to save override.",
      },
      { status: 500 },
    );
  }
}
