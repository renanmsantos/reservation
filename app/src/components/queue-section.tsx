import clsx from "clsx";

export type QueueStatus = "confirmed" | "waitlisted";

export type QueueReservation = {
  id: string;
  fullName: string;
  position: number;
  status: QueueStatus;
};

type QueueSectionProps = {
  title: string;
  items: QueueReservation[];
  emptyState: string;
  highlightedName?: string | null;
  onRelease?: (reservation: QueueReservation) => void;
  releasingIds?: Set<string>;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const QueueSection = ({ title, items, emptyState, highlightedName, onRelease, releasingIds }: QueueSectionProps) => (
  <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <header className="space-y-1">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">
        {items.length} {items.length === 1 ? "person" : "people"}
      </p>
    </header>

    <ol className="space-y-2">
      {items.length === 0 && (
        <li className="text-sm text-slate-500">{emptyState}</li>
      )}

      {items.map((reservation) => {
        const releasing = Boolean(releasingIds?.has(reservation.id));

        return (
          <li
            key={`${reservation.status}-${reservation.position}-${reservation.fullName}`}
            className={clsx(
              "flex flex-col gap-2 rounded-lg border px-4 py-3 md:flex-row md:items-center md:justify-between",
              reservation.status === "confirmed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
              highlightedName && normalize(reservation.fullName) === normalize(highlightedName)
                ? "ring-2 ring-emerald-500"
                : null,
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{reservation.fullName}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-700">
                #{reservation.position}
              </span>
            </div>

            {onRelease && (
              <button
                className="rounded-md border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide text-current transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2"
                disabled={releasing}
                onClick={() => onRelease(reservation)}
                type="button"
              >
                {releasing ? "Releasing…" : "Release seat"}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  </section>
);

export default QueueSection;
