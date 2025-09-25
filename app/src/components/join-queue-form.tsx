"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/ui/notifications-provider";
import { trackEvent } from "@/lib/analytics";

import type { JoinQueueResult } from "@/hooks/use-reservation-queue";

const DEFAULT_MAX_SEATS = Number(process.env.NEXT_PUBLIC_MAX_SEATS ?? 15);

type JoinQueueFormProps = {
  onJoin: (payload: { fullName: string }) => Promise<JoinQueueResult>;
  isSubmitting: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export const JoinQueueForm = ({ onJoin, isSubmitting, disabled = false, disabledReason }: JoinQueueFormProps) => {
  const [fullName, setFullName] = useState("");
  const { notify } = useNotifications();
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      notify({ tone: "error", message: "Informe seu nome completo para reservar uma vaga." });
      return;
    }

    const result = await onJoin({ fullName: normalizedName });

    if (result.ok) {
      trackEvent("reservation_joined", {
        status: result.status ?? "unknown",
        duplicate_override: result.code === "override_applied",
      });
      notify({ tone: "success", message: result.message });
      setFullName("");
      return;
    }

    if (result.code === "duplicate_name") {
      trackEvent("reservation_duplicate_blocked", {
        full_name: normalizedName,
      });
    } else {
      trackEvent("reservation_join_error", {
        code: result.code ?? "unknown",
      });
    }

    notify({ tone: "error", message: result.message });
  };

  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">Reservar vaga</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Digite apenas o nome completo. {DEFAULT_MAX_SEATS} lugares no total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80" htmlFor="fullName">
              Nome completo
            </Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Alex Silva"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={disabled || isSubmitting}
            />
          </div>

          <Button className="w-full" disabled={disabled || isSubmitting} type="submit">
            {disabled ? "Reservas encerradas" : isSubmitting ? "Enviando…" : "Reservar"}
          </Button>
          {disabled && disabledReason ? (
            <p className="text-xs text-muted-foreground">{disabledReason}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};

export default JoinQueueForm;
