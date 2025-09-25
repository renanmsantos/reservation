"use client";

import { useMemo } from "react";

import JoinQueueForm from "@/components/join-queue-form";
import { QueueSection, type QueueReservation } from "@/components/queue-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/components/ui/notifications-provider";
import { useReservationQueue } from "@/hooks/use-reservation-queue";
import { trackEvent } from "@/lib/analytics";

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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

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

  const activeEvent = queue?.event && queue.event.status === "em_andamento" ? queue.event : null;
  const title = activeEvent?.name ? activeEvent.name : "Status da fila";
  const currentVanLabel = queue?.van.name ? `${queue.van.name} · ` : "";
  const subtitle = activeEvent
    ? `${formatEventDate(activeEvent.eventDate)} · ${currentVanLabel}${capacity} lugares · ${availableSeats} vagas disponíveis`
    : "Acompanhe a fila em tempo real e reserve sua vaga.";

  const queueVanId = queue?.van.id ?? null;

  const activeEventVan = useMemo(() => {
    if (!activeEvent || !queueVanId) {
      return null;
    }
    return activeEvent.vans.find((van) => van.id === queueVanId) ?? null;
  }, [activeEvent, queueVanId]);

  const isVanClosed = activeEvent?.vanStatus === "fechada";
  const isVanFull = activeEvent?.vanStatus === "cheia";
  const perPassengerCost = activeEvent?.currentVanPerPassengerCost ?? activeEventVan?.perPassengerCost ?? null;
  const vanCost = activeEvent?.currentVanCost ?? activeEventVan?.vanCost ?? null;
  const nextOpenVans = useMemo(
    () => (activeEvent && queueVanId ? activeEvent.vans.filter((van) => van.id !== queueVanId && van.status === "aberta") : []),
    [activeEvent, queueVanId],
  );
  const closedVans = useMemo(
    () => (activeEvent ? activeEvent.vans.filter((van) => van.status === "fechada") : []),
    [activeEvent],
  );
  const joinDisabled = isVanClosed && nextOpenVans.length === 0;
  const joinDisabledReason = joinDisabled
    ? nextOpenVans.length > 0
      ? `Reservas desta van foram encerradas. Próxima van: ${nextOpenVans
          .map((van) => van.name)
          .join(", ")}. Aguarde a confirmação do organizador.`
      : "Reservas encerradas para esta van. Siga as orientações do organizador para o embarque."
    : undefined;

  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-10 px-4 pb-24 pt-12">
      <header className="space-y-3 text-foreground">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      {isVanClosed && (
        <section className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary-foreground/90">
          <p className="font-medium">Esta van está fechada. As vagas foram confirmadas.</p>
          <ul className="mt-2 space-y-1 text-xs text-primary-foreground/80">
            <li>
              Valor por passageiro: {perPassengerCost !== null ? currencyFormatter.format(perPassengerCost) : "aguardando cálculo"}
            </li>
            {vanCost !== null ? <li>Custo total da van: {currencyFormatter.format(vanCost)}</li> : null}
            <li>Saída dos integrantes está bloqueada para preservar a lista final.</li>
            {nextOpenVans.length > 0 ? (
              <li>
                Próxima van em abertura: {nextOpenVans.map((van) => van.name).join(", ")}. Aguarde instruções para
                embarcar nela.
              </li>
            ) : null}
          </ul>
        </section>
      )}

      {!isVanClosed && isVanFull && (
        <section className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 text-sm text-amber-100">
          <p className="font-medium">Esta van está cheia.</p>
          <p className="mt-1 text-xs">
            Novas reservas entram automaticamente na lista de espera ou serão direcionadas para as próximas vans
            disponíveis.
          </p>
          {nextOpenVans.length > 0 ? (
            <p className="mt-1 text-xs">Próximas vans abertas: {nextOpenVans.map((van) => van.name).join(", ")}.</p>
          ) : null}
        </section>
      )}

      <section className="space-y-6">
        <JoinQueueForm
          onJoin={joinQueue}
          isSubmitting={isSubmitting}
          disabled={joinDisabled}
          disabledReason={joinDisabledReason}
        />

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
              releaseDisabled={isVanClosed}
              releaseDisabledLabel={isVanClosed ? "Van fechada - alterações bloqueadas" : undefined}
              items={confirmed}
              title={null}
              perPassengerCost={perPassengerCost}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Lista de espera</h2>
            <QueueSection
              emptyState="Sem fila no momento."
              highlightedName={highlightFullName}
              releasingIds={releasingIds}
              onRelease={handleRelease}
              releaseDisabled={isVanClosed}
              releaseDisabledLabel={isVanClosed ? "Van fechada - alterações bloqueadas" : undefined}
              items={waitlisted}
              title={null}
              perPassengerCost={perPassengerCost}
            />
          </section>

          {closedVans.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Vans já fechadas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {closedVans.map((van) => (
                  <div
                    key={van.id}
                    className="space-y-2 rounded-xl border border-border/50 bg-background/60 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{van.name}</p>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary-foreground/80">
                        Fechada
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Capacidade: {van.capacity} passageiros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valor por integrante: {van.perPassengerCost !== null ? currencyFormatter.format(van.perPassengerCost) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Custo total da van: {van.vanCost !== null ? currencyFormatter.format(van.vanCost) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservationDashboard;
