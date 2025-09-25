import { NextResponse } from "next/server";

import { createAdminSessionCookie, destroyAdminSessionCookie, ensureAdminToken } from "@/lib/auth";

type SessionPayload = {
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SessionPayload | null;

  if (!body?.password) {
    return NextResponse.json({ message: "Informe a senha administrativa." }, { status: 400 });
  }

  if (!ensureAdminToken(body.password)) {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401 });
  }
  const response = NextResponse.json({ message: "Acesso liberado." });
  response.cookies.set(createAdminSessionCookie());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ message: "Sessão encerrada." });
  response.cookies.set(destroyAdminSessionCookie());
  return response;
}
