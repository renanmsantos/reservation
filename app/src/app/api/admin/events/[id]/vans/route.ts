import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { attachVanToEvent, isValidEventVanStatus } from "@/lib/events-service";
import { createServiceRoleClient } from "@/lib/supabase";

type AttachVanPayload = {
  vanId?: string;
  status?: string;
  cost?: number;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const { id: eventId } = await context.params;

  if (!eventId) {
    return NextResponse.json({ message: "Informe o identificador do evento." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as AttachVanPayload | null;

  if (!body?.vanId) {
    return NextResponse.json({ message: "Informe a van que deseja associar." }, { status: 400 });
  }

  if (body.cost === undefined) {
    return NextResponse.json({ message: "Informe o custo da van." }, { status: 400 });
  }

  const parsedCost = Number(body.cost);
  if (!Number.isFinite(parsedCost) || parsedCost < 0) {
    return NextResponse.json({ message: "O custo deve ser um valor numérico válido." }, { status: 422 });
  }

  if (body.status && !isValidEventVanStatus(body.status)) {
    return NextResponse.json({ message: "Status da van inválido." }, { status: 422 });
  }

  try {
    const client = createServiceRoleClient();

    const event = await client
      .from("events")
      .select("id, status")
      .eq("id", eventId)
      .maybeSingle();

    if (event.error || !event.data) {
      return NextResponse.json({ message: "Evento não encontrado." }, { status: 404 });
    }

    if (event.data.status === "finalizado") {
      return NextResponse.json({ message: "Não é possível alterar vans de um evento finalizado." }, { status: 422 });
    }

    const van = await client
      .from("vans")
      .select("id")
      .eq("id", body.vanId)
      .maybeSingle();

    if (van.error || !van.data) {
      return NextResponse.json({ message: "Van não encontrada." }, { status: 404 });
    }

    const association = await attachVanToEvent(client, {
      eventId,
      vanId: body.vanId,
      vanCost: parsedCost,
      status: body.status && isValidEventVanStatus(body.status) ? body.status : undefined,
    });

    return NextResponse.json({ association }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível associar a van ao evento.",
      },
      { status: 500 },
    );
  }
}
