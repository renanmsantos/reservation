import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";

const escapeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vanId = url.searchParams.get("vanId");

  if (!vanId) {
    return NextResponse.json({ message: "vanId is required." }, { status: 400 });
  }

  try {
    const client = createServiceRoleClient();
    const { data: reservations, error } = await client
      .from("reservations")
      .select("full_name, email, status, position, joined_at, released_at")
      .eq("van_id", vanId)
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = [
      ["Full Name", "Email", "Status", "Position", "Joined At", "Released At"],
      ...(reservations ?? []).map((row) => [
        row.full_name,
        row.email,
        row.status,
        row.position,
        row.joined_at,
        row.released_at,
      ]),
    ];

    const csv = rows.map((line) => line.map(escapeCsvValue).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=van-${vanId}-roster.csv`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to export reservations.",
      },
      { status: 500 },
    );
  }
}
