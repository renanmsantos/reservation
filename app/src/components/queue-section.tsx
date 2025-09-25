import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export type QueueStatus = "confirmed" | "waitlisted";

export type QueueReservation = {
  id: string;
  fullName: string;
  position: number;
  status: QueueStatus;
};

type QueueSectionProps = {
  title?: string | null;
  items: QueueReservation[];
  emptyState: string;
  highlightedName?: string | null;
  onRelease?: (reservation: QueueReservation) => void;
  releasingIds?: Set<string>;
  releaseDisabled?: boolean;
  releaseDisabledLabel?: string;
  perPassengerCost?: number | null;
};

const normalize = (value: string) => value.trim().toLowerCase();

const seatTone = (status: QueueStatus) =>
  status === "confirmed"
    ? "border-emerald-400/60 bg-emerald-400/20"
    : "border-amber-300/50 bg-amber-300/15";

const PassengerIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
  </svg>
);

export const QueueSection = ({
  title,
  items,
  emptyState,
  highlightedName,
  onRelease,
  releasingIds,
  releaseDisabled = false,
  releaseDisabledLabel,
  perPassengerCost,
}: QueueSectionProps) => (
  <Card className="bg-card/80 backdrop-blur">
    {title ? (
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "pessoa" : "pessoas"}
        </CardDescription>
      </CardHeader>
    ) : null}
    <CardContent className="space-y-6">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border/40 bg-gradient-to-br from-secondary/70 via-secondary/40 to-secondary/60 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-y-6 left-1/2 hidden w-12 -translate-x-1/2 rounded-full bg-background/10 ring-1 ring-border/30 sm:block" />
        {items.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyState}</div>
        ) : (
          <div className="grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((reservation) => {
              const releasing = Boolean(releasingIds?.has(reservation.id));
              const isHighlighted =
                highlightedName && normalize(reservation.fullName) === normalize(highlightedName);

              return (
                <div key={reservation.id} className="flex w-full max-w-[160px] flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      "group relative flex h-16 w-16 items-center justify-center rounded-[1.4rem] border bg-background/60 text-primary-foreground shadow-md transition",
                      seatTone(reservation.status),
                      isHighlighted ? "ring-2 ring-primary/70" : null,
                      releasing ? "opacity-60" : null,
                    )}
                    title={reservation.fullName}
                  >
                    <PassengerIcon className="h-6 w-6" />
                    <span className="absolute -right-2 -top-2 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground shadow">
                      #{reservation.position}
                    </span>
                  </div>
                  <span className="line-clamp-2 text-sm font-medium text-foreground/90">
                    {reservation.fullName}
                  </span>
                  {perPassengerCost !== null ? (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {currencyFormatter.format(perPassengerCost)}
                    </span>
                  ) : null}
                  <Badge className="bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary-foreground/80">
                    {reservation.status === "confirmed" ? "Confirmado" : "Espera"}
                  </Badge>
                  {onRelease && (
                    <Button
                      variant="outline"
                      className="flex w-full items-center justify-center gap-2 border-emerald-400/70 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/25"
                      disabled={releasing || releaseDisabled}
                      onClick={() => onRelease(reservation)}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.6"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 11V7a5 5 0 0 1 10 0" />
                        <rect width="14" height="10" x="5" y="11" rx="2" />
                        <path d="M10 16h4" />
                      </svg>
                      <span>
                        {releasing
                          ? "Liberando…"
                          : releaseDisabled
                            ? releaseDisabledLabel ?? "Indisponível"
                            : "Liberar"}
                      </span>
                    </Button>
                  )}
                  {releaseDisabled && !releasing && releaseDisabledLabel ? (
                    <p className="text-[11px] text-muted-foreground">{releaseDisabledLabel}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default QueueSection;
