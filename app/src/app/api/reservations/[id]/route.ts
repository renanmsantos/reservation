import { NextResponse } from "next/server";

import {
  fetchQueue,
  getActiveReservationById,
  logReservationEvent,
  mapReservationRow,
} from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: reservationId } = await context.params;

  if (!reservationId) {
    return NextResponse.json({ message: "Reservation id is required." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const reservation = await getActiveReservationById(client, reservationId);

    if (!reservation) {
      return NextResponse.json({ message: "Reservation not found." }, { status: 404 });
    }

    const updateResult = await client
      .from("reservations")
      .update({
        status: "cancelled",
        released_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select("id, van_id, full_name, email, status, position, joined_at")
      .single();

    if (updateResult.error) {
      throw updateResult.error;
    }

    await logReservationEvent(client, "release", {
      reservation_id: reservation.id,
      van_id: reservation.vanId,
      full_name: reservation.fullName,
    });

    const queue = await fetchQueue(client, reservation.vanId);

    return NextResponse.json(
      {
        message: "Reservation released. The next person in line was promoted automatically.",
        releasedReservation: mapReservationRow(updateResult.data),
        queue,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to release reservation.",
        code: "unexpected_error",
      },
      { status: 500 },
    );
  }
}
