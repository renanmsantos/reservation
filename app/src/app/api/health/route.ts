import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

const HEALTH_VAN_NAME = "__health_check_van";
const HEALTH_RESERVATION_NAME = "Passageiro Teste de Saúde";

type HealthStatus =
  | {
      status: "ok";
      supabaseUrl: string | null;
      hasAnonKey: boolean;
      duplicateNameCheck: "enforced";
    }
  | {
      status: "degraded" | "not_configured";
      supabaseUrl: string | null;
      hasAnonKey: boolean;
      duplicateNameCheck: "skipped" | "failed";
      error: string;
    };

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasAnonKey = Boolean(supabaseAnonKey);

  if (!supabaseUrl || !hasAnonKey) {
    const payload: HealthStatus = {
      status: "not_configured",
      supabaseUrl,
      hasAnonKey,
      duplicateNameCheck: "skipped",
      error:
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar a conexão com o Supabase.",
    };

    return NextResponse.json(payload, { status: 500 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    const payload: HealthStatus = {
      status: "degraded",
      supabaseUrl,
      hasAnonKey,
      duplicateNameCheck: "skipped",
      error: "SUPABASE_SERVICE_ROLE_KEY não está configurada; validação de nomes duplicados ignorada.",
    };

    return NextResponse.json(payload, { status: 200 });
  }

  const client = createServiceRoleClient();
  const vanId = randomUUID();

  try {
    const departureTimestamp = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const insertVan = await client.from("vans").insert({
      id: vanId,
      name: HEALTH_VAN_NAME,
      departure_timestamp: departureTimestamp,
      capacity: 1,
    });

    if (insertVan.error) {
      throw insertVan.error;
    }

    const firstInsert = await client.from("reservations").insert({
      van_id: vanId,
      full_name: HEALTH_RESERVATION_NAME,
      status: "confirmed",
      position: 1,
    });

    if (firstInsert.error) {
      throw firstInsert.error;
    }

    const duplicateInsert = await client.from("reservations").insert({
      van_id: vanId,
      full_name: HEALTH_RESERVATION_NAME,
      status: "waitlisted",
      position: 2,
    });

    if (!duplicateInsert.error) {
      throw new Error("A inserção com nome duplicado inesperadamente funcionou.");
    }

    if (duplicateInsert.error.code !== "23505") {
      throw new Error(`Código de erro inesperado ao verificar duplicados: ${duplicateInsert.error.code ?? "unknown"}`);
    }

    const payload: HealthStatus = {
      status: "ok",
      supabaseUrl,
      hasAnonKey,
      duplicateNameCheck: "enforced",
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const payload: HealthStatus = {
      status: "degraded",
      supabaseUrl,
      hasAnonKey,
      duplicateNameCheck: "failed",
      error: error instanceof Error ? error.message : "Erro inesperado do Supabase",
    };

    return NextResponse.json(payload, { status: 500 });
  } finally {
    await client.from("reservations").delete().eq("van_id", vanId);
    await client.from("vans").delete().eq("id", vanId);
  }
}
