"use client";

import { useMemo } from "react";

import JoinQueueForm from "@/components/join-queue-form";
import { QueueSection, type QueueReservation } from "@/components/queue-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/components/ui/notifications-provider";
import { useReservationQueue } from "@/hooks/use-reservation-queue";
import { trackEvent } from "@/lib/analytics";

const EVENT_STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
};

const VAN_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  em_espera: "Em espera",
};

const formatEventDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const LoadingState = () => (
  <Card className="bg-card/60 backdrop-blur">
    <CardContent className="flex h-48 items-center justify-center text-muted-foreground">Carregando…</CardContent>
  </Card>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <Card className="border border-rose-500/30 bg-rose-500/10 text-rose-200">
    <CardContent className="flex h-48 flex-col items-center justify-center space-y-4 text-center">
      <p className="text-sm font-medium">{message}</p>
      <Button variant="destructive" onClick={onRetry} type="button">
        Tentar novamente
      </Button>
    </CardContent>
  </Card>
);

const SummaryTile = ({ title, value }: { title: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/80 p-4">
    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">{title}</p>
    <p className="text-2xl font-semibold text-foreground">{value}</p>
  </div>
);

export const ReservationDashboard = () => {
  const {
    queue,
    loading,
    error,
    joinQueue,
    isSubmitting,
    refetch,
    highlightFullName,
    releaseReservation,
    releasingIds,
    confirmedCount,
    waitlistCount,
  } = useReservationQueue();
  const { notify } = useNotifications();

  const confirmed = useMemo(
    () =>
      (queue?.confirmed ?? []).map(
        (record): QueueReservation => ({
          id: record.id,
          fullName: record.fullName,
          position: record.position,
          status: "confirmed",
        }),
      ),
    [queue],
  );

  const waitlisted = useMemo(
    () =>
      (queue?.waitlisted ?? []).map(
        (record): QueueReservation => ({
          id: record.id,
          fullName: record.fullName,
          position: record.position,
          status: "waitlisted",
        }),
      ),
    [queue],
  );

  const capacity = queue?.van.capacity ?? 0;
  const availableSeats = Math.max(capacity - confirmedCount, 0);
  const occupancy = capacity ? Math.round((confirmedCount / capacity) * 100) : 0;

  const handleRelease = async (reservation: QueueReservation) => {
    if (!window.confirm(`Liberar ${reservation.fullName}?`)) {
      return;
    }

    const result = await releaseReservation(reservation.id);

    if (result.ok) {
      notify({ tone: "success", message: result.message });
      trackEvent("reservation_released", {
        van_id: queue?.van.id ?? "unknown",
        full_name: reservation.fullName,
      });
    } else {
      notify({ tone: "error", message: result.message });
      trackEvent("reservation_release_error", {
        van_id: queue?.van.id ?? "unknown",
        code: result.code ?? "unknown",
      });
    }
  };

  const eventInfo = queue?.event;
  const eventStatusLabel = eventInfo ? EVENT_STATUS_LABELS[eventInfo.status] ?? eventInfo.status : null;
  const vanStatusLabel = eventInfo?.vanStatus ? VAN_STATUS_LABELS[eventInfo.vanStatus] ?? eventInfo.vanStatus : null;

  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-10 px-4 pb-24 pt-12">
      <header className="space-y-3 text-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/20 text-primary-foreground/90">
            {eventStatusLabel ?? "Fila"}
          </Badge>
          {vanStatusLabel && (
            <Badge className="border-primary/40 bg-transparent text-primary/80">
              Van {vanStatusLabel}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {eventInfo?.name ?? "Status da fila"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {eventInfo
              ? `${formatEventDate(eventInfo.eventDate)} · ${capacity} lugares · ${availableSeats} vagas disponíveis`
              : "Acompanhe a fila em tempo real e reserve sua vaga."}
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <JoinQueueForm onJoin={joinQueue} isSubmitting={isSubmitting} />

        {queue && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile title="Confirmados" value={String(confirmedCount)} />
            <SummaryTile title="Fila" value={String(waitlistCount)} />
            <SummaryTile title="Vagas" value={String(availableSeats)} />
            <SummaryTile title="Lotação" value={`${occupancy}%`} />
          </div>
        )}
      </section>

      {loading && !queue && <LoadingState />}
      {error && !queue && <ErrorState message={error} onRetry={() => refetch()} />}

      {queue && (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Confirmados</h2>
            <QueueSection
              emptyState="Ninguém confirmado ainda."
              highlightedName={highlightFullName}
              releasingIds={releasingIds}
              onRelease={handleRelease}
              items={confirmed}
              title={null}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Lista de espera</h2>
            <QueueSection
              emptyState="Sem fila no momento."
              highlightedName={highlightFullName}
              releasingIds={releasingIds}
              onRelease={handleRelease}
              items={waitlisted}
              title={null}
            />
          </section>

          {eventInfo?.vans?.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                Vans deste evento
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {eventInfo.vans.map((van) => (
                  <div
                    key={van.id}
                    className="rounded-xl border border-border/50 bg-background/60 p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-foreground">{van.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {van.capacity} lugares · Status {VAN_STATUS_LABELS[van.status] ?? van.status}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

        </div>
      )}
    </div>
  );
};

export default ReservationDashboard;
