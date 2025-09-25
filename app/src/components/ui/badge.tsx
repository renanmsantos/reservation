import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/40 bg-secondary/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
