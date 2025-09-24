"use client";

import { useMemo, useState } from "react";

import JoinQueueForm from "@/components/join-queue-form";
import { QueueSection, type QueueReservation } from "@/components/queue-section";
import { useReservationQueue } from "@/hooks/use-reservation-queue";
import { trackEvent } from "@/lib/analytics";

const LoadingState = () => (
  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-slate-500">
    Loading reservation queue...
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-12 text-rose-800">
    <p>{message}</p>
    <button
      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
      onClick={onRetry}
      type="button"
    >
      Try again
    </button>
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
  } = useReservationQueue();
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);

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

  const handleRelease = async (reservation: QueueReservation) => {
    const confirmedRelease = window.confirm(
      `Release ${reservation.fullName}? They will lose their current spot and need to join again if plans change.`,
    );
    if (!confirmedRelease) {
      return;
    }

    setReleaseMessage(null);
    const result = await releaseReservation(reservation.id);
    setReleaseMessage(result.message);

    if (result.ok) {
      trackEvent("reservation_released", {
        van_id: queue?.van.id ?? "unknown",
        full_name: reservation.fullName,
      });
    } else {
      trackEvent("reservation_release_error", {
        van_id: queue?.van.id ?? "unknown",
        code: result.code ?? "unknown",
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-12 md:flex-row">
      <div className="flex-1 space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Van Reservation Queue</p>
          <h1 className="text-3xl font-bold text-slate-900">Reserve your spot for the next ride</h1>
          <p className="text-base text-slate-600">
            Seats are assigned in order of arrival. Each rider can hold only one active reservation per full name—release
            your seat if plans change so the next person advances automatically.
          </p>
        </header>

        {loading && !queue && <LoadingState />}
        {error && !queue && <ErrorState message={error} onRetry={() => refetch()} />}

        {queue && (
          <div className="grid gap-6 lg:grid-cols-2">
            <QueueSection
              emptyState="No one has joined yet. Be the first to claim a seat."
              highlightedName={highlightFullName}
              releasingIds={releasingIds}
              onRelease={handleRelease}
              items={confirmed}
              title="Confirmed passengers"
            />
            <QueueSection
              emptyState="There are currently no riders waiting."
              highlightedName={highlightFullName}
              releasingIds={releasingIds}
              onRelease={handleRelease}
              items={waitlisted}
              title="Waitlist"
            />
          </div>
        )}
      </div>

      <div className="md:w-96">
        <JoinQueueForm onJoin={joinQueue} isSubmitting={isSubmitting} />

        {releaseMessage && (
          <p className="mt-4 text-sm text-slate-600">{releaseMessage}</p>
        )}
      </div>
    </div>
  );
};

export default ReservationDashboard;
