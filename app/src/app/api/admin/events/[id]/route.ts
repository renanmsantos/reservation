import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import {
  canTransitionEventStatus,
  EventStatus,
  getEventById,
  isValidEventStatus,
  updateEvent,
} from "@/lib/events-service";
import { createServiceRoleClient } from "@/lib/supabase";

const parseBrDate = (value: string | undefined) => {
  if (!value) {
    return null;
  }
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return null;
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

type UpdateEventPayload = {
  name?: string;
  date?: string;
  status?: string;
  totalCost?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ message: "Informe o identificador do evento." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as UpdateEventPayload | null;

  if (!body) {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const existing = await getEventById(client, id);

    if (!existing) {
      return NextResponse.json({ message: "Evento não encontrado." }, { status: 404 });
    }

    if (existing.status === "finalizado") {
      return NextResponse.json(
        { message: "Evento finalizado não pode ser alterado." },
        { status: 422 },
      );
    }

    const updates: { status?: EventStatus; name?: string; eventDate?: string; totalCost?: number } = {};

    if (body.status) {
      if (!isValidEventStatus(body.status)) {
        return NextResponse.json({ message: "Status do evento inválido." }, { status: 422 });
      }
      if (!canTransitionEventStatus(existing.status, body.status as EventStatus)) {
        return NextResponse.json(
          { message: "Transição de status não permitida." },
          { status: 422 },
        );
      }
      updates.status = body.status as EventStatus;
    }

    if (body.name) {
      updates.name = body.name.trim();
    }

    if (body.date) {
      const isoDate = parseBrDate(body.date);
      if (!isoDate || Number.isNaN(Date.parse(isoDate))) {
        return NextResponse.json({ message: "Data inválida. Use o formato dd/mm/aaaa." }, { status: 422 });
      }
      updates.eventDate = isoDate;
    }

    if (body.totalCost !== undefined) {
      if (Number(body.totalCost) < 0) {
        return NextResponse.json({ message: "O custo total não pode ser negativo." }, { status: 422 });
      }
      updates.totalCost = Number(body.totalCost);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "Nenhuma alteração informada." }, { status: 400 });
    }

    const event = await updateEvent(client, {
      eventId: id,
      ...updates,
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível atualizar o evento.",
      },
      { status: 500 },
    );
  }
}
