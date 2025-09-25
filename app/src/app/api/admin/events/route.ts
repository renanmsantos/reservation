import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { createEvent, fetchEventsWithVans, isValidEventStatus } from "@/lib/events-service";
import { createServiceRoleClient } from "@/lib/supabase";

const parseBrDate = (value: string) => {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return null;
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

type CreateEventPayload = {
  name?: string;
  date?: string;
  status?: string;
  totalCost?: number;
};

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const client = createServiceRoleClient();
    const events = await fetchEventsWithVans(client);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível carregar os eventos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateEventPayload | null;

  if (!body?.name || !body.date) {
    return NextResponse.json(
      { message: "Informe nome e data do evento (dd/mm/aaaa)." },
      { status: 400 },
    );
  }

  const isoDate = parseBrDate(body.date);
  if (!isoDate || Number.isNaN(Date.parse(isoDate))) {
    return NextResponse.json({ message: "Data inválida. Use o formato dd/mm/aaaa." }, { status: 422 });
  }

  const status = body.status ?? "planejado";
  if (!isValidEventStatus(status)) {
    return NextResponse.json({ message: "Status do evento inválido." }, { status: 422 });
  }

  if (body.totalCost !== undefined && Number(body.totalCost) < 0) {
    return NextResponse.json({ message: "O custo total não pode ser negativo." }, { status: 422 });
  }

  try {
    const client = createServiceRoleClient();
    const event = await createEvent(client, {
      name: body.name,
      eventDate: isoDate,
      status,
      totalCost: Number(body.totalCost ?? 0),
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível criar o evento.",
      },
      { status: 500 },
    );
  }
}
