import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { mapReservationRow, type ReservationRow } from "@/lib/reservations-service";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  }
  const url = new URL(request.url);
  const vanId = url.searchParams.get("vanId");
  const status = url.searchParams.get("status");

  if (!vanId) {
    return NextResponse.json({ message: "É obrigatório informar o vanId." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();

    const { data, error } = await client
      .from("reservations")
      .select("id, van_id, event_id, full_name, status, position, joined_at, released_at, charged_amount, has_paid")
      .eq("van_id", vanId)
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    const normalized = (data ?? []).map((row) => {
      const mappedRow: ReservationRow = {
        id: row.id,
        van_id: row.van_id,
        event_id: row.event_id ?? null,
        full_name: row.full_name,
        status: row.status,
        position: row.position,
        joined_at: row.joined_at,
        charged_amount: Number(row.charged_amount ?? 0),
        has_paid: Boolean(row.has_paid),
      };

      return {
        ...mapReservationRow(mappedRow),
        releasedAt: row.released_at ?? null,
      };
    });

    const filtered = status ? normalized.filter((item) => item.status === status) : normalized;

    return NextResponse.json({ reservations: filtered });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível carregar as reservas.",
      },
      { status: 500 },
    );
  }
}
