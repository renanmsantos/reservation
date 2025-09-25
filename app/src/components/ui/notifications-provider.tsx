"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationTone = "success" | "error" | "warning" | "info";

type Notification = {
  id: number;
  tone: NotificationTone;
  message: string;
};

type NotificationsContextValue = {
  notify: (notification: { tone: NotificationTone; message: string }) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const toneToVariant: Record<NotificationTone, "success" | "destructive" | "warning" | "default"> = {
  success: "success",
  error: "destructive",
  warning: "warning",
  info: "default",
};

const toneStyles: Record<NotificationTone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-50",
  error: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  warning: "border-amber-400/40 bg-amber-400/15 text-amber-100",
  info: "border-sky-400/40 bg-sky-400/15 text-sky-100",
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idRef = useRef(0);

  const removeNotification = useCallback((id: number) => {
    setNotifications((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ tone, message }: { tone: NotificationTone; message: string }) => {
      const id = ++idRef.current;
      setNotifications((previous) => [...previous, { id, tone, message }]);

      window.setTimeout(() => {
        removeNotification(id);
      }, 5000);
    },
    [removeNotification],
  );

  const value = useMemo<NotificationsContextValue>(() => ({ notify }), [notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-6 z-[9999] flex w-full max-w-sm -translate-x-1/2 flex-col gap-3">
        {notifications.map((notification) => (
          <Alert
            key={notification.id}
            variant={toneToVariant[notification.tone]}
            className={cn(
              "pointer-events-auto pr-10 backdrop-blur",
              toneStyles[notification.tone],
            )}
          >
            <AlertDescription>{notification.message}</AlertDescription>
            <Button
              aria-label="Fechar aviso"
              className="absolute right-2 top-2 h-6 w-6 rounded-full text-xs"
              onClick={() => removeNotification(notification.id)}
              type="button"
              variant="ghost"
            >
              X
            </Button>
          </Alert>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  return context ?? { notify: () => undefined };
};

export default NotificationsProvider;
