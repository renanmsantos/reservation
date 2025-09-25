"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/ui/notifications-provider";
import { useRouter } from "next/navigation";

const AdminLoginForm = () => {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { notify } = useNotifications();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password.trim()) {
      notify({ tone: "error", message: "Informe a senha de acesso." });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível iniciar a sessão." });
        return;
      }

      notify({ tone: "success", message: payload.message ?? "Sessão iniciada com sucesso." });
      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Não foi possível iniciar a sessão." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold">Entrar no painel</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Use a senha administrativa para liberar o painel de vans e reservas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="adminPassword" className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
              Senha
            </Label>
            <Input
              id="adminPassword"
              type="password"
              autoComplete="current-password"
              value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          disabled={submitting}
        />
      </div>
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "Entrando…" : "Entrar"}
      </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminLoginForm;
