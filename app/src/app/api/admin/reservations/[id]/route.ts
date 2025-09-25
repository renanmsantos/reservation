import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";

type UpdatePayload = {
  hasPaid?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ message: "Informe o identificador da reserva." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePayload | null;

  if (body?.hasPaid === undefined) {
    return NextResponse.json({ message: "Informe o status de pagamento." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const { data, error } = await client
      .from("reservations")
      .update({ has_paid: body.hasPaid })
      .eq("id", id)
      .select("id, has_paid, charged_amount")
      .maybeSingle<{ id: string; has_paid: boolean; charged_amount: number }>();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ message: "Reserva não encontrada." }, { status: 404 });
    }

    return NextResponse.json({
      reservation: {
        id: data.id,
        hasPaid: data.has_paid,
        chargedAmount: Number(data.charged_amount ?? 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível atualizar o status de pagamento.",
      },
      { status: 500 },
    );
  }
}
