import * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "success" | "destructive" | "warning";

const variantClasses: Record<AlertVariant, string> = {
  default: "border-border/60 bg-card/80 text-foreground",
  success: "border-emerald-500/50 bg-emerald-500/15 text-emerald-50",
  destructive: "border-rose-500/50 bg-rose-500/15 text-rose-50",
  warning: "border-amber-500/50 bg-amber-500/15 text-amber-50",
};

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", role = "alert", ...props }, ref) => (
    <div
      ref={ref}
      role={role}
      className={cn(
        "relative w-full rounded-xl border p-4 text-sm shadow-sm backdrop-blur",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);

Alert.displayName = "Alert";

export const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn("mb-1 text-base font-semibold", className)} {...props} />
);

export const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <div className={cn("text-sm leading-relaxed", className)} {...props} />
);

export default Alert;
