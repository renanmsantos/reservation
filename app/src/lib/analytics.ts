export type AnalyticsEventPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: AnalyticsEventPayload }) => void;
  }
}

export const trackEvent = (eventName: string, props?: AnalyticsEventPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  const plausible = window.plausible;

  if (typeof plausible === "function") {
    plausible(eventName, props ? { props } : undefined);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", eventName, props ?? {});
  }
};

export const ANALYTICS_ENABLED = Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN);
