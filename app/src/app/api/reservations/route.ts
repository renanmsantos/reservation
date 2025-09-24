import { NextResponse } from "next/server";

import { DEFAULT_VAN_NAME, sanitizeFullName, type ReservationStatus } from "@/lib/reservations";
import {
  fetchQueue,
  ensureVanByName,
  logReservationEvent,
  mapReservationRow,
} from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

const ACTIVE_STATUSES: ReservationStatus[] = ["confirmed", "waitlisted"];

export async function GET() {
  try {
    const client = createServiceRoleClient();
    const van = await ensureVanByName(client, { name: DEFAULT_VAN_NAME });
    const queue = await fetchQueue(client, van.id);
    return NextResponse.json({ queue });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to fetch reservations queue.",
      },
      { status: 500 },
    );
  }
}

type PostPayload = {
  fullName?: string;
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostPayload | null;

  if (!body || !body.fullName) {
    return NextResponse.json({ message: "Full name is required." }, { status: 400 });
  }

  const fullName = sanitizeFullName(body.fullName);

  if (fullName.length < 3) {
    return NextResponse.json({ message: "Full name must be at least 3 characters." }, { status: 422 });
  }

  const email = body.email?.trim() || null;

  try {
    const client = createServiceRoleClient();
    const van = await ensureVanByName(client, { name: DEFAULT_VAN_NAME });

    const { data: existingReservation, error: existingError } = await client
      .from("reservations")
      .select("id, van_id, full_name, email, status, position, joined_at")
      .eq("full_name", fullName)
      .in("status", ACTIVE_STATUSES)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingReservation) {
      const { data: override } = await client
        .from("duplicate_name_overrides")
        .select("id, full_name, expires_at, reason")
        .eq("full_name", fullName)
        .maybeSingle();

      const overrideActive =
        override && (!override.expires_at || new Date(override.expires_at).getTime() > Date.now());

      if (!overrideActive) {
        await logReservationEvent(client, "duplicate_blocked", {
          full_name: fullName,
          van_id: van.id,
          existing_reservation_id: existingReservation.id,
        });

        return NextResponse.json(
          {
            message: "This full name already holds an active reservation.",
            code: "duplicate_name",
            existingReservation: mapReservationRow(existingReservation),
          },
          { status: 409 },
        );
      }

    }

    const { count: confirmedCount, error: confirmedError } = await client
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("van_id", van.id)
      .eq("status", "confirmed");

    if (confirmedError) {
      throw confirmedError;
    }

    const confirmedSeats = confirmedCount ?? 0;
    const hasCapacity = confirmedSeats < van.capacity;

    const status: ReservationStatus = hasCapacity ? "confirmed" : "waitlisted";
    let position = hasCapacity ? confirmedSeats + 1 : 1;

    if (!hasCapacity) {
      const { data: waitlistPositionResult, error: waitlistError } = await client
        .from("reservations")
        .select("position")
        .eq("van_id", van.id)
        .eq("status", "waitlisted")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (waitlistError) {
        throw waitlistError;
      }

      position = waitlistPositionResult ? waitlistPositionResult.position + 1 : 1;
    }

    const insertResult = await client
      .from("reservations")
      .insert({
        van_id: van.id,
        full_name: fullName,
        email,
        status,
        position,
      })
      .select("id, van_id, full_name, email, status, position, joined_at")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "P0001") {
        await logReservationEvent(client, "duplicate_blocked", {
          full_name: fullName,
          van_id: van.id,
        });

        return NextResponse.json(
          {
            message: "This full name already holds an active reservation.",
            code: "duplicate_name",
          },
          { status: 409 },
        );
      }

      throw insertResult.error;
    }

    await logReservationEvent(client, status === "confirmed" ? "join" : "waitlist", {
      reservation_id: insertResult.data.id,
      van_id: van.id,
      full_name: fullName,
      status,
    });

    const queue = await fetchQueue(client, van.id);

    return NextResponse.json(
      {
        message:
          status === "confirmed"
            ? "Seat confirmed! You are on the passenger list."
            : "All seats are taken—you're on the waitlist and will auto-promote when a spot opens.",
        status,
        queue,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create reservation.",
        code: "unexpected_error",
      },
      { status: 500 },
    );
  }
}
