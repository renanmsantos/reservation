"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import type { ReservationQueue, ReservationStatus } from "@/lib/reservations";

type JoinPayload = {
  fullName: string;
};

export type JoinQueueResult = {
  ok: boolean;
  status?: ReservationStatus;
  message: string;
  code?: string;
  highlightFullName?: string;
};

export type ReleaseResult = {
  ok: boolean;
  message: string;
  code?: string;
};

type FetchState = {
  data: ReservationQueue | null;
  loading: boolean;
  error: string | null;
};

const initialState: FetchState = {
  data: null,
  loading: true,
  error: null,
};

export const useReservationQueue = () => {
  const [state, setState] = useState<FetchState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightFullName, setHighlightFullName] = useState<string | null>(null);
  const [releasingIds, setReleasingIds] = useState<Set<string>>(new Set());

  const fetchQueue = useCallback(async ({ showSpinner = true }: { showSpinner?: boolean } = {}) => {
    setState((previous) => ({
      data: previous.data,
      loading: showSpinner ? true : previous.loading,
      error: null,
    }));
    try {
      const response = await fetch("/api/reservations", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { queue?: ReservationQueue; message?: string } | null;

      if (!response.ok || !payload?.queue) {
        throw new Error(payload?.message ?? "Não foi possível carregar a fila.");
      }

      setState({ data: payload.queue, loading: false, error: null });
    } catch (error) {
      setState((previous) => ({
        data: previous.data,
        loading: false,
        error: error instanceof Error ? error.message : "Não foi possível carregar a fila.",
      }));
    }
  }, []);

  const joinQueue = useCallback(
    async ({ fullName }: JoinPayload): Promise<JoinQueueResult> => {
      setIsSubmitting(true);
      setHighlightFullName(null);

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fullName }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload.message === "string" ? payload.message : "Não foi possível reservar uma vaga.";
          const result: JoinQueueResult = {
            ok: false,
            message,
            code: payload.code,
            highlightFullName: payload.existingReservation?.fullName,
          };

          if (payload.existingReservation) {
            setHighlightFullName(payload.existingReservation.fullName);
          }

          return result;
        }

        const queue = payload.queue as ReservationQueue | undefined;
        if (queue) {
          setState({ data: queue, loading: false, error: null });
        }

        setHighlightFullName(fullName);

        return {
          ok: true,
          status: payload.status,
          message: payload.message ?? "Reserva registrada.",
          highlightFullName: fullName,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Não foi possível reservar uma vaga.",
          code: "network_error",
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const releaseReservation = useCallback(
    async (reservationId: string): Promise<ReleaseResult> => {
      setReleasingIds((previous) => {
        const next = new Set(previous);
        next.add(reservationId);
        return next;
      });
      try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
          method: "DELETE",
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload.message === "string" ? payload.message : "Não foi possível liberar a vaga.";
          return { ok: false, message, code: payload.code };
        }

        const queue = payload.queue as ReservationQueue | undefined;
        if (queue) {
          setState({ data: queue, loading: false, error: null });
        }

        return { ok: true, message: payload.message ?? "Reserva liberada." };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Não foi possível liberar a vaga.",
          code: "network_error",
        };
      } finally {
        setReleasingIds((previous) => {
          const next = new Set(previous);
          next.delete(reservationId);
          return next;
        });
      }
    },
    [],
  );

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!state.data) {
      return;
    }

    try {
      const supabase = getBrowserSupabaseClient();
      const channel = supabase
        .channel("reservations-queue")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reservations",
            filter: `van_id=eq.${state.data.van.id}`,
          },
          () => {
            fetchQueue({ showSpinner: false });
          },
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } catch (subscriptionError) {
      console.warn("Realtime subscription skipped:", subscriptionError);
      return undefined;
    }
  }, [state.data, fetchQueue]);

  const confirmedCount = useMemo(() => state.data?.confirmed.length ?? 0, [state.data]);
  const waitlistCount = useMemo(() => state.data?.waitlisted.length ?? 0, [state.data]);

  return {
    queue: state.data,
    loading: state.loading,
    error: state.error,
    isSubmitting,
    joinQueue,
    refetch: fetchQueue,
    highlightFullName,
    confirmedCount,
    waitlistCount,
    releaseReservation,
    releasingIds,
  };
};
