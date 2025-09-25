import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { attachVanToEvent, isValidEventVanStatus } from "@/lib/events-service";
import { logReservationEvent } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }
  try {
    const client = createServiceRoleClient();

    const { data: vans, error } = await client
      .from("vans")
      .select("id, name, capacity, departure_timestamp, default_event_id")
      .order("departure_timestamp", { ascending: true });

    if (error || !vans) {
      throw error ?? new Error("Nenhuma van encontrada");
    }

    const vanIds = vans.map((van) => van.id);

    const { data: eventAssociations } = vanIds.length
      ? await client
          .from("event_vans")
          .select(
            "van_id, status, van_cost, per_passenger_cost, event:events(id, name, status, total_cost, event_date)"
          )
          .in("van_id", vanIds)
        : { data: [] };

    const eventAssociationsData = eventAssociations ?? [];
    const eventMap = new Map<string, (typeof eventAssociationsData)[number]>();
    eventAssociationsData.forEach((row) => {
      eventMap.set(row.van_id, row);
    });

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

        const eventInfo = eventMap.get(van.id);

        return {
          ...van,
          confirmedCount: confirmedCount ?? 0,
          waitlistedCount: waitlistedCount ?? 0,
          event: eventInfo
            ? {
                id: eventInfo.event?.[0]?.id ?? null,
                name: eventInfo.event?.[0]?.name ?? null,
                status: eventInfo.event?.[0]?.status ?? null,
                vanStatus: eventInfo.status,
                perPassengerCost: eventInfo.per_passenger_cost,
                totalCost: eventInfo.event?.[0]?.total_cost ?? null,
                eventDate: eventInfo.event?.[0]?.event_date ?? null,
                vanCost: eventInfo.van_cost !== null && eventInfo.van_cost !== undefined ? Number(eventInfo.van_cost) : null,
              }
            : van.default_event_id
              ? { id: van.default_event_id, name: null, status: null, vanStatus: null, perPassengerCost: null, totalCost: null, eventDate: null, vanCost: null }
              : null,
        };
      }),
    );

    return NextResponse.json({ vans: summaries });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível carregar as vans.",
      },
      { status: 500 },
    );
  }
}

type CreateVanPayload = {
  name?: string;
  capacity?: number;
  departureTimestamp?: string;
  eventId?: string;
  eventStatus?: string;
};

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as CreateVanPayload | null;

  if (!body || !body.name) {
    return NextResponse.json({ message: "Informe um nome para a van." }, { status: 400 });
  }

  const capacity = typeof body.capacity === "number" ? body.capacity : null;
  if (capacity !== null && (capacity < 1 || capacity > 64)) {
    return NextResponse.json({ message: "A capacidade deve estar entre 1 e 64." }, { status: 422 });
  }

  const departureTimestamp = body.departureTimestamp
    ? new Date(body.departureTimestamp).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  try {
    const client = createServiceRoleClient();
    const insertResult = await client
      .from("vans")
      .insert({
        name: body.name.trim(),
        capacity: capacity ?? Number(process.env.MAX_SEATS ?? 15),
        departure_timestamp: departureTimestamp,
        default_event_id: body.eventId ?? null,
      })
      .select("id, name, capacity, departure_timestamp, default_event_id")
      .single();

    if (insertResult.error || !insertResult.data) {
      throw insertResult.error ?? new Error("Não foi possível criar a van.");
    }

    await logReservationEvent(client, "van_created", {
      van_id: insertResult.data.id,
      name: insertResult.data.name,
      capacity: insertResult.data.capacity,
    });

    if (body.eventId) {
      try {
        await attachVanToEvent(client, {
          eventId: body.eventId,
          vanId: insertResult.data.id,
          status:
            body.eventStatus && isValidEventVanStatus(body.eventStatus)
              ? body.eventStatus
              : undefined,
        });
      } catch (associationError) {
        console.error("Falha ao associar van ao evento:", associationError);
      }
    }

    return NextResponse.json(
      {
        van: {
          ...insertResult.data,
          confirmedCount: 0,
          waitlistedCount: 0,
          event: body.eventId
            ? {
                id: body.eventId,
                status: body.eventStatus ?? "aberta",
                name: null,
                vanStatus: body.eventStatus ?? "aberta",
                perPassengerCost: null,
                totalCost: null,
                eventDate: null,
              }
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível criar a van.",
      },
      { status: 500 },
    );
  }
}
