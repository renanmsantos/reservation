import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { detachVanFromEvent, isValidEventVanStatus, updateEventVanCost, updateEventVanStatus } from "@/lib/events-service";
import { createServiceRoleClient } from "@/lib/supabase";

type UpdatePayload = {
  status?: string;
  cost?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; vanId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const { id: eventId, vanId } = await context.params;

  if (!eventId || !vanId) {
    return NextResponse.json({ message: "Identificadores de evento e van são obrigatórios." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePayload | null;

  if (!body || (body.status === undefined && body.cost === undefined)) {
    return NextResponse.json({ message: "Informe dados para atualizar a van." }, { status: 400 });
  }

  let association = null;

  try {
    const client = createServiceRoleClient();

    if (body.cost !== undefined) {
      const parsedCost = Number(body.cost);
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        return NextResponse.json({ message: "O custo deve ser um valor numérico válido." }, { status: 422 });
      }
      association = await updateEventVanCost(client, {
        eventId,
        vanId,
        vanCost: parsedCost,
      });
    }

    if (body.status !== undefined) {
      if (!isValidEventVanStatus(body.status)) {
        return NextResponse.json({ message: "Status da van inválido." }, { status: 422 });
      }

      association = await updateEventVanStatus(client, {
        eventId,
        vanId,
        nextStatus: body.status,
      });
    }

    return NextResponse.json({ association });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar dados da van.";
    const statusCode = message.includes("sem passageiros confirmados") || message.includes("Defina o custo")
      ? 422
      : 500;

    return NextResponse.json(
      {
        message,
      },
      { status: statusCode },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; vanId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const { id: eventId, vanId } = await context.params;

  if (!eventId || !vanId) {
    return NextResponse.json({ message: "Identificadores de evento e van são obrigatórios." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const event = await client
      .from("events")
      .select("status")
      .eq("id", eventId)
      .maybeSingle<{ status: string }>();

    if (event.error) {
      throw event.error;
    }

    if (!event.data) {
      return NextResponse.json({ message: "Evento não encontrado." }, { status: 404 });
    }

    if (event.data.status === "finalizado") {
      return NextResponse.json(
        { message: "Evento finalizado não permite remover vans." },
        { status: 422 },
      );
    }

    await detachVanFromEvent(client, { eventId, vanId });

    return NextResponse.json({ message: "Van desassociada do evento." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível desassociar a van do evento.",
      },
      { status: 500 },
    );
  }
}
