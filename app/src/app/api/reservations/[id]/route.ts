import { NextResponse } from "next/server";

import {
  fetchQueue,
  getActiveReservationById,
  logReservationEvent,
  mapReservationRow,
  toPostgrestError,
} from "@/lib/reservations-service";
import { syncEventVanStatusWithCapacity } from "@/lib/events-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: reservationId } = await context.params;

  if (!reservationId) {
    return NextResponse.json({ message: "É obrigatório informar o identificador da reserva." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const reservation = await getActiveReservationById(client, reservationId);

    if (!reservation) {
      return NextResponse.json({ message: "Reserva não encontrada." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const releasingWaitlisted = reservation.status === "waitlisted";

    if (reservation.status === "confirmed") {
      const statusQuery = client
        .from("event_vans")
        .select("status")
        .eq("van_id", reservation.vanId)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: association, error: associationError } = reservation.eventId
        ? await statusQuery.eq("event_id", reservation.eventId).maybeSingle<{ status: string }>()
        : await statusQuery.maybeSingle<{ status: string }>();

      if (associationError) {
        throw associationError;
      }

      if (association?.status === "fechada") {
        return NextResponse.json(
          {
            message: "A van está fechada. Alterações não são mais permitidas.",
            code: "van_closed",
          },
          { status: 409 },
        );
      }
    }

    if (releasingWaitlisted) {
      const deleteResult = await client
        .from("reservations")
        .delete()
        .eq("id", reservationId)
        .select("id, van_id, event_id, full_name, status, position, joined_at")
        .single();

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      await logReservationEvent(client, "release", {
        reservation_id: reservation.id,
        van_id: reservation.vanId,
        full_name: reservation.fullName,
        waitlist: true,
      });

      const queue = await fetchQueue(client, reservation.vanId);

      return NextResponse.json(
        {
          message: "Pessoa removida da lista de espera.",
          releasedReservation: { ...reservation, status: "cancelled" as const },
          queue,
        },
        { status: 200 },
      );
    }

    const updateResult = await client
      .from("reservations")
      .update({
        status: "cancelled",
        released_at: now,
        charged_amount: 0,
      })
      .eq("id", reservationId)
      .select("id, van_id, event_id, full_name, status, position, joined_at")
      .single();

    if (updateResult.error) {
      throw updateResult.error;
    }

    await logReservationEvent(client, "release", {
      reservation_id: reservation.id,
      van_id: reservation.vanId,
      full_name: reservation.fullName,
      waitlist: false,
    });

    await syncEventVanStatusWithCapacity(client, reservation.vanId);

    const queue = await fetchQueue(client, reservation.vanId);

    return NextResponse.json(
      {
        message: "Reserva liberada. A próxima pessoa da fila foi promovida automaticamente.",
        releasedReservation: mapReservationRow(updateResult.data),
        queue,
      },
      { status: 200 },
    );
  } catch (error) {
    const supabaseError = toPostgrestError(error);

    console.error(`DELETE /api/reservations/${reservationId}`, error);

    return NextResponse.json(
      {
        message: supabaseError?.hint ?? supabaseError?.message ?? "Não foi possível liberar a reserva.",
        code: supabaseError?.code || "unexpected_error",
      },
      { status: 500 },
    );
  }
}
