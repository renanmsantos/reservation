import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { logReservationEvent } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }
  const { id: vanId } = await context.params;

  if (!vanId) {
    return NextResponse.json({ message: "É obrigatório informar o identificador da van." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const body = (await request.json().catch(() => null)) as {
      name?: string | null;
      capacity?: number | string | null;
      departureTimestamp?: string | null;
    } | null;

    if (!body || (!("name" in body) && !("capacity" in body) && !("departureTimestamp" in body))) {
      return NextResponse.json({ message: "Nenhuma alteração informada." }, { status: 400 });
    }

    const { data: currentVan, error: currentVanError } = await client
      .from("vans")
      .select("id, name, capacity, departure_timestamp")
      .eq("id", vanId)
      .maybeSingle();

    if (currentVanError) {
      throw currentVanError;
    }

    if (!currentVan) {
      return NextResponse.json({ message: "Van não encontrada." }, { status: 404 });
    }

    const updates: Record<string, string | number | null> = {};

    if ("name" in body) {
      const rawName = typeof body.name === "string" ? body.name : "";
      const trimmedName = rawName.trim();

      if (!trimmedName) {
        return NextResponse.json({ message: "Informe um nome válido para a van." }, { status: 422 });
      }

      if (trimmedName !== currentVan.name) {
        updates.name = trimmedName;
      }
    }

    if ("capacity" in body) {
      const capacityValue =
        typeof body.capacity === "number"
          ? body.capacity
          : typeof body.capacity === "string" && body.capacity.trim() !== ""
            ? Number(body.capacity)
            : null;

      if (capacityValue === null || Number.isNaN(capacityValue)) {
        return NextResponse.json({ message: "Informe uma capacidade válida." }, { status: 422 });
      }

      if (!Number.isInteger(capacityValue)) {
        return NextResponse.json({ message: "A capacidade deve ser um número inteiro." }, { status: 422 });
      }

      if (capacityValue < 1 || capacityValue > 64) {
        return NextResponse.json({ message: "A capacidade deve estar entre 1 e 64." }, { status: 422 });
      }

      if (capacityValue !== currentVan.capacity) {
        updates.capacity = capacityValue;
      }
    }

    if ("departureTimestamp" in body) {
      if (body.departureTimestamp === null || body.departureTimestamp === "") {
        if (currentVan.departure_timestamp !== null) {
          updates.departure_timestamp = null;
        }
      } else if (typeof body.departureTimestamp === "string") {
        const parsed = new Date(body.departureTimestamp);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ message: "Informe uma data de partida válida." }, { status: 422 });
        }

        const isoValue = parsed.toISOString();
        if (isoValue !== currentVan.departure_timestamp) {
          updates.departure_timestamp = isoValue;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "Nenhuma alteração informada." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: van, error: vanError } = await client
      .from("vans")
      .update(updates)
      .eq("id", vanId)
      .select("id, name, capacity, departure_timestamp, default_event_id")
      .single();

    if (vanError || !van) {
      throw vanError ?? new Error("Não foi possível atualizar a van");
    }

    if (Object.prototype.hasOwnProperty.call(updates, "capacity")) {
      await logReservationEvent(client, "capacity_updated", {
        van_id: vanId,
        capacity: van.capacity,
      });
    }

    return NextResponse.json({ van });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível atualizar a capacidade.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }
  const { id: vanId } = await context.params;

  if (!vanId) {
    return NextResponse.json({ message: "É obrigatório informar o identificador da van." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const { count: activeReservations, error: activeError } = await client
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("van_id", vanId)
      .in("status", ["confirmed", "waitlisted"]);

    if (activeError) {
      throw activeError;
    }

    if ((activeReservations ?? 0) > 0) {
      return NextResponse.json(
        {
          message: "Remova ou libere todos os passageiros antes de excluir a van.",
        },
        { status: 409 },
      );
    }

    await client.from("reservations").delete().eq("van_id", vanId);

    const { data: van, error: vanError } = await client
      .from("vans")
      .delete()
      .eq("id", vanId)
      .select("id, name, capacity")
      .single();

    if (vanError || !van) {
      throw vanError ?? new Error("Não foi possível remover a van.");
    }

    await logReservationEvent(client, "van_removed", {
      van_id: vanId,
      name: van.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível remover a van.",
      },
      { status: 500 },
    );
  }
}
