"use client";

import * as React from "react";

import { QueueSection, type QueueReservation } from "@/components/queue-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/ui/notifications-provider";
import { useRouter } from "next/navigation";

type VanSummary = {
  id: string;
  name: string;
  capacity: number;
  departure_timestamp: string | null;
  confirmedCount: number;
  waitlistedCount: number;
  default_event_id?: string | null;
  event?: {
    id: string | null;
    name: string | null;
    status: string | null;
    vanStatus: string | null;
    perPassengerCost: number | null;
    totalCost: number | null;
    eventDate: string | null;
  } | null;
};

type ReservationRecord = QueueReservation & {
  joinedAt: string;
  releasedAt: string | null;
  chargedAmount: number;
  hasPaid: boolean;
};

type AdminReservationApiRecord = {
  id: string;
  fullName: string;
  position: number;
  status: QueueReservation["status"] | "cancelled";
  joinedAt: string;
  releasedAt: string | null;
};

const isActiveReservationStatus = (
  status: AdminReservationApiRecord["status"],
): status is QueueReservation["status"] => status === "confirmed" || status === "waitlisted";

type EventVanSummary = {
  id: string;
  status: string;
  vanCost: number;
  perPassengerCost: number | null;
  closedAt: string | null;
  van: {
    id: string;
    name: string;
    capacity: number;
    departureTimestamp: string | null;
  } | null;
};

// API payload types for admin events
type AdminEventVanApiRecord = {
  id: string;
  status: string;
  van_cost: number;
  per_passenger_cost: number | null;
  closed_at: string | null;
  van: {
    id: string;
    name: string;
    capacity: number;
    departure_timestamp: string | null;
  } | null;
};

type AdminEventApiRecord = {
  id: string;
  name: string;
  event_date: string;
  status: string;
  total_cost: number | null;
  event_vans: AdminEventVanApiRecord[] | null;
};

type AdminEventSummary = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  totalCost: number;
  vans: EventVanSummary[];
};

type StatusFilter = "all" | "confirmed" | "waitlisted";

const selectClassName =
  "w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const EVENT_STATUS_OPTIONS = [
  { value: "planejado", label: "Planejado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "finalizado", label: "Finalizado" },
];

const EVENT_VAN_STATUS_OPTIONS = [
  { value: "aberta", label: "Aberta" },
  { value: "em_espera", label: "Em espera" },
  { value: "fechada", label: "Fechada" },
];

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? numberFormatter.format(value) : "—";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("pt-BR");
};

const formatOnlyDate = (value: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("pt-BR");
};

const toDateTimeLocalInput = (value: string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocalInput = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const AdminDashboard = () => {
  const [vans, setVans] = React.useState<VanSummary[]>([]);
  const [activeVanId, setActiveVanId] = React.useState<string | null>(null);
  const [reservations, setReservations] = React.useState<ReservationRecord[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [newVanForm, setNewVanForm] = React.useState({ name: "", capacity: "", departure: "" });
  const [vanEditForm, setVanEditForm] = React.useState({ name: "", capacity: "", departure: "" });
  const [savingVan, setSavingVan] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const [events, setEvents] = React.useState<AdminEventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const [newEventForm, setNewEventForm] = React.useState({
    name: "",
    date: "",
    status: "planejado",
  });
  const [savingEvent, setSavingEvent] = React.useState(false);
  const [updatingEventId, setUpdatingEventId] = React.useState<string | null>(null);
  const [attachForm, setAttachForm] = React.useState({ vanId: "", status: "aberta", cost: "" });
  const [attachingVan, setAttachingVan] = React.useState(false);
  const [updatingVanStatuses, setUpdatingVanStatuses] = React.useState<Set<string>>(new Set());
  const [detachingVanAssociations, setDetachingVanAssociations] = React.useState<Set<string>>(new Set());
  const [vanCostInputs, setVanCostInputs] = React.useState<Record<string, string>>({});
  const [updatingVanCosts, setUpdatingVanCosts] = React.useState<Set<string>>(new Set());
  const [updatingPayments, setUpdatingPayments] = React.useState<Set<string>>(new Set());

  const { notify } = useNotifications();
  const router = useRouter();

  const activeVan = React.useMemo(() => vans.find((van) => van.id === activeVanId) ?? null, [activeVanId, vans]);
  const [editingVanId, setEditingVanId] = React.useState<string | null>(null);
  const editingVan = React.useMemo(() => vans.find((van) => van.id === editingVanId) ?? null, [editingVanId, vans]);
  const selectedEvent = React.useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  React.useEffect(() => {
    if (editingVan) {
      setVanEditForm({
        name: editingVan.name,
        capacity: String(editingVan.capacity ?? ""),
        departure: toDateTimeLocalInput(editingVan.departure_timestamp ?? null),
      });
    } else {
      setVanEditForm({ name: "", capacity: "", departure: "" });
    }
  }, [editingVan]);

  const resetVanEditForm = React.useCallback(() => {
    if (editingVan) {
      setVanEditForm({
        name: editingVan.name,
        capacity: String(editingVan.capacity ?? ""),
        departure: toDateTimeLocalInput(editingVan.departure_timestamp ?? null),
      });
    } else {
      setVanEditForm({ name: "", capacity: "", departure: "" });
    }
  }, [editingVan]);

  const availableVans = React.useMemo(() => {
    if (!selectedEvent) {
      return vans;
    }
    const assignedIds = new Set(selectedEvent.vans.map((item) => item.van?.id).filter(Boolean) as string[]);
    return vans.filter((van) => !assignedIds.has(van.id));
  }, [selectedEvent, vans]);

  const loadVans = React.useCallback(
    async (options?: { preferVanId?: string }) => {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/vans", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "Não foi possível carregar as vans.");
        }

        const list = (payload.vans as VanSummary[]).map((van) => ({
          ...van,
          confirmedCount: Number(van.confirmedCount ?? 0),
          waitlistedCount: Number(van.waitlistedCount ?? 0),
        }));

        setVans(list);

        const preferVanId = options?.preferVanId;
        const ids = new Set(list.map((van) => van.id));
        let nextActive: string | null = null;

        if (preferVanId && ids.has(preferVanId)) {
          nextActive = preferVanId;
        } else if (activeVanId && ids.has(activeVanId)) {
          nextActive = activeVanId;
        } else if (list.length > 0) {
          nextActive = list[0].id;
        }

        setActiveVanId(nextActive);
        setEditingVanId((current) => (current && ids.has(current) ? current : null));
      } catch (error: unknown) {
        notify({
          tone: "error",
          message: error instanceof Error ? error.message : "Não foi possível carregar as vans.",
        });
      } finally {
        setLoading(false);
      }
    },
    [notify, activeVanId],
  );

  const loadReservations = React.useCallback(
    async (vanId: string, status: StatusFilter = "all") => {
      try {
        const url = new URL("/api/admin/reservations", window.location.origin);
        url.searchParams.set("vanId", vanId);
        if (status !== "all") {
          url.searchParams.set("status", status);
        }

        const response = await fetch(url.toString(), { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "Não foi possível carregar as reservas.");
        }

        const activeReservations = (payload.reservations as AdminReservationApiRecord[]).filter(
          (item): item is AdminReservationApiRecord & { status: QueueReservation["status"] } =>
            isActiveReservationStatus(item.status),
        );

        setReservations(
          activeReservations.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            position: item.position,
            status: item.status,
            joinedAt: item.joinedAt,
            releasedAt: item.releasedAt ?? null,
          })),
        );
      } catch (error: unknown) {
        notify({
          tone: "error",
          message: error instanceof Error ? error.message : "Não foi possível carregar as reservas.",
        });
        setReservations([]);
      }
    },
    [notify],
  );

  const loadAdminEvents = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível carregar os eventos.");
      }

      const mapped: AdminEventSummary[] = (payload.events as AdminEventApiRecord[]).map((event) => ({
        id: event.id,
        name: event.name,
        eventDate: event.event_date,
        status: event.status,
        totalCost: Number(event.total_cost ?? 0),
        vans: (event.event_vans ?? []).map((item: AdminEventVanApiRecord) => ({
          id: item.id,
          status: item.status,
          vanCost: item.van_cost !== null && item.van_cost !== undefined ? Number(item.van_cost) : 0,
          perPassengerCost: item.per_passenger_cost !== null ? Number(item.per_passenger_cost) : null,
          closedAt: item.closed_at ?? null,
          van: item.van
            ? {
                id: item.van.id,
                name: item.van.name,
                capacity: item.van.capacity,
                departureTimestamp: item.van.departure_timestamp ?? null,
              }
            : null,
        })),
      }));

      setEvents(mapped);
      setSelectedEventId((current) => {
        if (current && mapped.some((event) => event.id === current)) {
          return current;
        }
        return mapped[0]?.id ?? null;
      });
    } catch (error: unknown) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível carregar os eventos.",
      });
      setEvents([]);
      setSelectedEventId(null);
    }
  }, [notify]);

  React.useEffect(() => {
    loadVans();
    loadAdminEvents();
  }, [loadAdminEvents, loadVans]);

  React.useEffect(() => {
    if (activeVanId) {
      loadReservations(activeVanId, statusFilter);
    } else {
      setReservations([]);
    }
  }, [activeVanId, statusFilter, loadReservations]);

  React.useEffect(() => {
    if (selectedEvent) {
      const nextInputs: Record<string, string> = Object.fromEntries(
        selectedEvent.vans.map((item) => [item.id, item.vanCost ? item.vanCost.toFixed(2) : ""])
      );
      setVanCostInputs(nextInputs);
      setAttachForm((previous) => ({ ...previous, vanId: "", cost: "" }));
    } else {
      setVanCostInputs({});
      setAttachForm({ vanId: "", status: "aberta", cost: "" });
    }
  }, [selectedEvent]);

  const handleVanCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newVanForm.name.trim()) {
      notify({ tone: "error", message: "Informe um nome para a van." });
      return;
    }

    const payload = {
      name: newVanForm.name,
      capacity: newVanForm.capacity ? Number(newVanForm.capacity) : undefined,
      departureTimestamp: newVanForm.departure || undefined,
      eventId: selectedEvent?.id,
      eventStatus: selectedEvent?.status,
    };

    const response = await fetch("/api/admin/vans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify({ tone: "error", message: body.message ?? "Não foi possível criar a van." });
      return;
    }

    const createdVan = body.van as VanSummary | undefined;
    notify({ tone: "success", message: "Van criada com sucesso." });
    setNewVanForm({ name: "", capacity: "", departure: "" });
    await loadVans({ preferVanId: createdVan?.id });
    await loadAdminEvents();
    if (createdVan?.id) {
      await loadReservations(createdVan.id, statusFilter);
    }
  };

  const handleVanUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingVan) {
      notify({ tone: "error", message: "Selecione uma van para editar." });
      return;
    }

    const targetVanId = editingVan.id;

    const trimmedName = vanEditForm.name.trim();
    if (!trimmedName) {
      notify({ tone: "error", message: "Informe um nome válido para a van." });
      return;
    }

    const updates: { name?: string; capacity?: number; departureTimestamp?: string | null } = {};

    if (trimmedName !== editingVan.name) {
      updates.name = trimmedName;
    }

    const capacityInput = vanEditForm.capacity.trim();
    if (capacityInput !== "") {
      const parsedCapacity = Number(capacityInput);
      if (!Number.isFinite(parsedCapacity)) {
        notify({ tone: "error", message: "Informe uma capacidade válida." });
        return;
      }

      if (!Number.isInteger(parsedCapacity)) {
        notify({ tone: "error", message: "A capacidade deve ser um número inteiro." });
        return;
      }

      if (parsedCapacity < 1 || parsedCapacity > 64) {
        notify({ tone: "error", message: "A capacidade deve estar entre 1 e 64." });
        return;
      }

      if (parsedCapacity !== editingVan.capacity) {
        updates.capacity = parsedCapacity;
      }
    }

    const departureInput = vanEditForm.departure.trim();
    if (departureInput) {
      const iso = fromDateTimeLocalInput(departureInput);
      if (!iso) {
        notify({ tone: "error", message: "Informe uma data de partida válida." });
        return;
      }

      const currentTimestamp = editingVan.departure_timestamp
        ? new Date(editingVan.departure_timestamp).getTime()
        : null;
      const nextTimestamp = new Date(iso).getTime();

      if (currentTimestamp !== nextTimestamp) {
        updates.departureTimestamp = iso;
      }
    } else if (editingVan.departure_timestamp) {
      updates.departureTimestamp = null;
    }

    if (Object.keys(updates).length === 0) {
      notify({ tone: "info", message: "Nenhuma alteração detectada." });
      return;
    }

    setSavingVan(true);
    try {
      const response = await fetch(`/api/admin/vans/${targetVanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível atualizar a van." });
        return;
      }

      notify({ tone: "success", message: "Dados da van atualizados." });
      await Promise.all([
        loadVans({ preferVanId: targetVanId }),
        loadAdminEvents(),
      ]);
      setEditingVanId(targetVanId);
      if (activeVanId === targetVanId) {
        await loadReservations(targetVanId, statusFilter);
      }
    } catch (error: unknown) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível atualizar a van.",
      });
    } finally {
      setSavingVan(false);
    }
  };

  const handleVanDelete = async (vanId: string) => {
    if (!window.confirm("Excluir esta van? Passageiros ativos precisam ser removidos antes.")) {
      return;
    }

    const response = await fetch(`/api/admin/vans/${vanId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      notify({ tone: "error", message: payload.message ?? "Não foi possível remover a van." });
      return;
    }

    notify({ tone: "success", message: "Van removida." });
    if (activeVanId === vanId) {
      setActiveVanId(null);
      setReservations([]);
    }
    if (editingVanId === vanId) {
      setEditingVanId(null);
    }
    await loadVans();
    await loadAdminEvents();
  };

  const handleEventCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newEventForm.name.trim() || !newEventForm.date.trim()) {
      notify({ tone: "error", message: "Informe nome e data do evento." });
      return;
    }

    setSavingEvent(true);
    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEventForm.name.trim(),
          date: newEventForm.date.trim(),
          totalCost: newEventForm.totalCost ? Number(newEventForm.totalCost) : 0,
          status: newEventForm.status,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível criar o evento." });
        return;
      }

      notify({ tone: "success", message: "Evento criado com sucesso." });
      setNewEventForm({ name: "", date: "", status: "planejado" });
      await loadAdminEvents();
    } catch (error: unknown) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível criar o evento.",
      });
    } finally {
      setSavingEvent(false);
    }
  };

  const handleEventStatusChange = async (eventId: string, status: string) => {
    setUpdatingEventId(eventId);
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível atualizar o evento." });
        return;
      }
      notify({ tone: "success", message: "Status do evento atualizado." });
      await loadAdminEvents();
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao atualizar o evento." });
    } finally {
      setUpdatingEventId(null);
    }
  };

  const handleAttachVan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvent) {
      notify({ tone: "error", message: "Selecione um evento antes de associar vans." });
      return;
    }
    if (!attachForm.vanId) {
      notify({ tone: "error", message: "Escolha uma van para associar." });
      return;
    }

    if (!attachForm.cost.trim()) {
      notify({ tone: "error", message: "Informe o custo da van." });
      return;
    }

    const normalizedCost = attachForm.cost.replace(/\s+/g, "").replace(",", ".");
    const parsedCost = Number(normalizedCost);

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      notify({ tone: "error", message: "Informe um custo válido (>= 0)." });
      return;
    }

    setAttachingVan(true);
    try {
      const response = await fetch(`/api/admin/events/${selectedEvent.id}/vans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vanId: attachForm.vanId, status: attachForm.status, cost: parsedCost }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível associar a van." });
        return;
      }
      notify({ tone: "success", message: "Van associada ao evento." });
      setAttachForm({ vanId: "", status: "aberta", cost: "" });
      await Promise.all([loadAdminEvents(), loadVans()]);
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao associar a van." });
    } finally {
      setAttachingVan(false);
    }
  };

  const handleEventVanStatusChange = async (eventId: string, vanAssociationId: string, vanId: string, status: string) => {
    setUpdatingVanStatuses((prev) => new Set(prev).add(vanAssociationId));
    try {
      const response = await fetch(`/api/admin/events/${eventId}/vans/${vanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível atualizar o status da van." });
        return;
      }
      notify({ tone: "success", message: "Status da van atualizado." });
      await Promise.all([loadAdminEvents(), loadVans()]);
      if (activeVanId === vanId) {
        await loadReservations(vanId, statusFilter);
      }
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao atualizar a van." });
    } finally {
      setUpdatingVanStatuses((prev) => {
        const next = new Set(prev);
        next.delete(vanAssociationId);
        return next;
      });
    }
  };

  const handleVanCostInputChange = React.useCallback((associationId: string, value: string) => {
    setVanCostInputs((previous) => ({ ...previous, [associationId]: value }));
  }, []);

  const handleVanCostSave = async (eventId: string, association: EventVanSummary) => {
    const vanId = association.van?.id;
    if (!vanId) {
      notify({ tone: "error", message: "Van inválida para atualizar custo." });
      return;
    }

    const rawValue = vanCostInputs[association.id] ?? "";
    const normalized = rawValue.replace(/\s+/g, "").replace(',', '.');
    const parsedCost = Number(normalized);

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      notify({ tone: "error", message: "Informe um custo válido (>= 0)." });
      return;
    }

    setUpdatingVanCosts((prev) => {
      const next = new Set(prev);
      next.add(association.id);
      return next;
    });

    try {
      const response = await fetch(`/api/admin/events/${eventId}/vans/${vanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost: parsedCost }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível atualizar o custo." });
        return;
      }

      notify({ tone: "success", message: "Custo da van atualizado." });
      setVanCostInputs((previous) => ({ ...previous, [association.id]: parsedCost.toFixed(2) }));
      await Promise.all([loadAdminEvents(), loadVans()]);
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao atualizar custo." });
    } finally {
      setUpdatingVanCosts((prev) => {
        const next = new Set(prev);
        next.delete(association.id);
        return next;
      });
    }
  };

  const handleTogglePayment = async (reservationId: string, nextValue: boolean) => {
    setUpdatingPayments((prev) => {
      const next = new Set(prev);
      next.add(reservationId);
      return next;
    });

    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasPaid: nextValue }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível atualizar o pagamento." });
        return;
      }

      setReservations((previous) =>
        previous.map((reservation) =>
          reservation.id === reservationId ? { ...reservation, hasPaid: nextValue } : reservation,
        ),
      );
      notify({
        tone: "success",
        message: nextValue ? "Pagamento confirmado." : "Pagamento marcado como pendente.",
      });
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao atualizar pagamento." });
    } finally {
      setUpdatingPayments((prev) => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
    }
  };

  const handleEventVanDetach = async (eventId: string, vanAssociationId: string, vanId: string) => {
    setDetachingVanAssociations((prev) => new Set(prev).add(vanAssociationId));
    if (!vanId) {
      notify({ tone: "error", message: "Van inválida para desassociar." });
      setDetachingVanAssociations((prev) => {
        const next = new Set(prev);
        next.delete(vanAssociationId);
        return next;
      });
      return;
    }
    try {
      const response = await fetch(`/api/admin/events/${eventId}/vans/${vanId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify({ tone: "error", message: payload.message ?? "Não foi possível desassociar a van." });
        return;
      }
      notify({ tone: "success", message: "Van desassociada do evento." });
      await Promise.all([loadAdminEvents(), loadVans()]);
      if (activeVanId === vanId) {
        await loadReservations(vanId, statusFilter);
      }
    } catch (error: unknown) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao desassociar a van." });
    } finally {
      setDetachingVanAssociations((prev) => {
        const next = new Set(prev);
        next.delete(vanAssociationId);
        return next;
      });
    }
  };

  const handleExport = async () => {
    if (!activeVanId) {
      return;
    }

    const response = await fetch(`/api/admin/reservations/export?vanId=${activeVanId}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      notify({ tone: "error", message: payload.message ?? "Não foi possível exportar as reservas." });
      return;
    }

    const blob = await response.blob();
    const filename = activeVan?.name
      ? `${activeVan.name.toLowerCase().replace(/\s+/g, "-")}.csv`
      : `van-${activeVanId}-roster.csv`;
    const downloadName = filename.startsWith("van") ? filename : `evento-${filename}`;
    const finalName = downloadName.endsWith(".csv") ? downloadName : `${downloadName}.csv`;
    downloadBlob(blob, finalName);
    notify({ tone: "success", message: "Relatório CSV exportado." });
  };

  const confirmed = reservations.filter((reservation) => reservation.status === "confirmed");
  const waitlisted = reservations.filter((reservation) => reservation.status === "waitlisted");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Badge className="bg-primary/20 text-primary-foreground/80">Painel administrativo</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Administrar filas, eventos e passageiros</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              setSigningOut(true);
              try {
                const response = await fetch("/api/admin/session", { method: "DELETE" });
                const payload = await response.json().catch(() => ({}));
                notify({ tone: response.ok ? "success" : "error", message: payload.message ?? "Sessão encerrada." });
                router.replace("/admin/login");
                router.refresh();
              } catch (error: unknown) {
                notify({
                  tone: "error",
                  message: error instanceof Error ? error.message : "Não foi possível encerrar a sessão.",
                });
              } finally {
                setSigningOut(false);
              }
            }}
            disabled={signingOut}
          >
            {signingOut ? "Saindo…" : "Sair"}
          </Button>
        </div>
        <div className="space-y-1.5">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Gerencie eventos, associe vans, acompanhe reservas em tempo real e exporte relatórios operacionais sem sair da tela.
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Eventos</CardTitle>
            <CardDescription>Cadastre eventos, defina custos e acompanhe vans associadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleEventCreate}>
              <Input
                placeholder="Nome do evento"
                value={newEventForm.name}
                onChange={(event) => setNewEventForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <Input
                placeholder="Data (dd/mm/aaaa)"
                value={newEventForm.date}
                onChange={(event) => setNewEventForm((prev) => ({ ...prev, date: event.target.value }))}
              />
              <select
                className={selectClassName}
                value={newEventForm.status}
                onChange={(event) => setNewEventForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                {EVENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button className="md:col-span-3" disabled={savingEvent} type="submit">
                {savingEvent ? "Salvando…" : "Criar evento"}
              </Button>
            </form>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Eventos cadastrados</h3>
                <div className="space-y-2">
                  {events.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum evento cadastrado até o momento.</p>
                  )}
                  {events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedEventId === event.id
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{event.name}</span>
                        <Badge className="bg-primary/15 text-[11px] uppercase tracking-wide text-primary-foreground/80">
                          {event.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatOnlyDate(event.eventDate)} · {formatCurrency(event.totalCost)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedEvent
                ? (() => {
                    const eventLocked = selectedEvent.status === "finalizado";

                    return (
                      <div className="space-y-4 rounded-lg border border-border/60 bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{selectedEvent.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {formatOnlyDate(selectedEvent.eventDate)} · {formatCurrency(selectedEvent.totalCost)}
                            </p>
                          </div>
                          <select
                            className="w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-auto"
                            value={selectedEvent.status}
                            onChange={(event) => handleEventStatusChange(selectedEvent.id, event.target.value)}
                            disabled={updatingEventId === selectedEvent.id || eventLocked}
                          >
                            {EVENT_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
<form
                          className="space-y-3 rounded-lg border border-border/60 bg-background/50 p-3"
                          onSubmit={handleAttachVan}
                        >
                          <h4 className="text-sm font-semibold text-foreground">Associar vans</h4>
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                            <select
                              className={selectClassName}
                              value={attachForm.vanId}
                              onChange={(event) => setAttachForm((prev) => ({ ...prev, vanId: event.target.value }))}
                              disabled={attachingVan || availableVans.length === 0 || eventLocked}
                            >
                              <option value="">Selecione uma van disponível</option>
                              {availableVans.map((van) => (
                                <option key={van.id} value={van.id}>
                                  {van.name} · {van.capacity} lugares
                                </option>
                              ))}
                            </select>
                            <Input
                              placeholder="Custo da van"
                              value={attachForm.cost}
                              onChange={(event) => setAttachForm((prev) => ({ ...prev, cost: event.target.value }))}
                              disabled={attachingVan || eventLocked}
                            />
                            <select
                              className={selectClassName}
                              value={attachForm.status}
                              onChange={(event) => setAttachForm((prev) => ({ ...prev, status: event.target.value }))}
                              disabled={attachingVan || eventLocked}
                            >
                              {EVENT_VAN_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button
                            className="w-full sm:w-auto"
                            disabled={attachingVan || availableVans.length === 0 || eventLocked}
                            type="submit"
                          >
                            {attachingVan ? "Associando…" : "Associar van"}
                          </Button>
                          {availableVans.length === 0 && (
                            <p className="text-xs text-muted-foreground">Todas as vans já estão vinculadas a este evento.</p>
                          )}
                          {eventLocked && (
                            <p className="text-xs text-muted-foreground">
                              Evento finalizado - alterações desativadas.
                            </p>
                          )}
                        </form>

                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Vans deste evento</h4>
                          <div className="space-y-3">
                            {selectedEvent.vans.length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhuma van vinculada até o momento.</p>
                            )}
                            {selectedEvent.vans.map((item) => {
                              const van = item.van;
                              const vanId = van?.id ?? "";
                              const isUpdatingStatus = updatingVanStatuses.has(item.id);
                              const isDetaching = detachingVanAssociations.has(item.id);
                              const isUpdatingCost = updatingVanCosts.has(item.id);
                              const costInputValue = vanCostInputs[item.id] ?? "";
                              const statusLabel = item.status.replace("_", " ");
                              const canEdit = Boolean(van) && !eventLocked;

                              return (
                                <div
                                  key={item.id}
                                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/50 p-3"
                                >
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-foreground">
                                          {van?.name ?? "Van removida"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {van
                                            ? `${van.capacity} lugares · Saída ${formatDate(van.departureTimestamp)}`
                                            : "—"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Custo da van: {formatCurrency(item.vanCost)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Valor por integrante: {formatCurrency(item.perPassengerCost)}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-2">
                                        <Badge className="bg-primary/15 text-[11px] uppercase tracking-wide text-primary-foreground/80">
                                          {statusLabel}
                                        </Badge>
                                        <div className="flex flex-wrap justify-end gap-2">
                                          {item.status === "fechada" ? (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="text-xs uppercase tracking-wide"
                                              onClick={() =>
                                                handleEventVanStatusChange(selectedEvent.id, item.id, vanId, "aberta")
                                              }
                                              disabled={!canEdit || !vanId || isUpdatingStatus || isDetaching}
                                            >
                                              {isUpdatingStatus ? "Reabrindo…" : "Reabrir van"}
                                            </Button>
                                          ) : (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="text-xs uppercase tracking-wide"
                                              onClick={() =>
                                                handleEventVanStatusChange(selectedEvent.id, item.id, vanId, "fechada")
                                              }
                                              disabled={!canEdit || !vanId || isUpdatingStatus || isDetaching}
                                            >
                                              {isUpdatingStatus ? "Fechando…" : "Fechar van"}
                                            </Button>
                                          )}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="text-xs uppercase tracking-wide"
                                            onClick={() => handleEventVanDetach(selectedEvent.id, item.id, vanId)}
                                            disabled={!vanId || eventLocked || isDetaching || isUpdatingStatus}
                                          >
                                            {isDetaching ? "Removendo…" : "Desassociar"}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <Input
                                        className="w-full sm:w-48"
                                        placeholder="Atualizar custo"
                                        value={costInputValue}
                                        onChange={(event) => handleVanCostInputChange(item.id, event.target.value)}
                                        disabled={!canEdit || !vanId || isUpdatingCost}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleVanCostSave(selectedEvent.id, item)}
                                        disabled={!canEdit || !vanId || isUpdatingCost}
                                      >
                                        {isUpdatingCost ? "Salvando…" : "Salvar custo"}
                                      </Button>
                                    </div>
                                    {item.status === "cheia" && (
                                      <p className="text-xs text-muted-foreground">
                                        Van cheia — novas reservas entram na lista de espera automaticamente.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : (
                <div className="flex items-center justify-center rounded-lg border border-border/60 bg-background/50 p-6 text-sm text-muted-foreground">
                  Selecione um evento para visualizar detalhes.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Gerenciar vans</CardTitle>
            <CardDescription>Edite dados operacionais, cadastre novas saídas e mantenha a frota organizada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Editar van</h4>
              {editingVan ? (
                <form
                  className="space-y-4 rounded-lg border border-border/40 bg-background/50 p-4"
                  onSubmit={handleVanUpdate}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{editingVan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ajuste nome, capacidade ou horário de saída desta van.
                      </p>
                    </div>
                    <Button
                      disabled={savingVan}
                      onClick={() => setEditingVanId(null)}
                      type="button"
                      variant="ghost"
                    >
                      Fechar edição
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80" htmlFor="vanName">
                        Nome
                      </Label>
                      <Input
                        id="vanName"
                        value={vanEditForm.name}
                        onChange={(event) => setVanEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        disabled={savingVan}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80" htmlFor="vanCapacity">
                        Capacidade
                      </Label>
                      <Input
                        id="vanCapacity"
                        type="number"
                        value={vanEditForm.capacity}
                        onChange={(event) => setVanEditForm((prev) => ({ ...prev, capacity: event.target.value }))}
                        disabled={savingVan}
                        min={1}
                        max={64}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80" htmlFor="vanDeparture">
                        Partida
                      </Label>
                      <Input
                        id="vanDeparture"
                        type="datetime-local"
                        value={vanEditForm.departure}
                        onChange={(event) => setVanEditForm((prev) => ({ ...prev, departure: event.target.value }))}
                        disabled={savingVan}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={savingVan} type="submit">
                      {savingVan ? "Salvando…" : "Salvar alterações"}
                    </Button>
                    <Button disabled={savingVan} onClick={resetVanEditForm} type="button" variant="ghost">
                      Descartar mudanças
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed border-border/40 bg-background/40 p-4 text-xs text-muted-foreground">
                  Escolha &quot;Editar&quot; em uma das vans abaixo para modificar os dados.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Vans cadastradas</h4>
              <div className="overflow-hidden rounded-2xl border border-border/50">
                <table className="min-w-full divide-y divide-border/40 text-sm">
                  <thead className="bg-background/40 text-muted-foreground">
                    <tr>
                    <th className="px-4 py-2 text-left font-medium">Nome</th>
                    <th className="px-4 py-2 text-left font-medium">Capacidade</th>
                    <th className="px-4 py-2 text-left font-medium">Evento</th>
                    <th className="px-4 py-2 text-left font-medium">Status da van</th>
                    <th className="px-4 py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {vans.map((van) => (
                    <tr key={van.id}>
                      <td className="px-4 py-2 text-foreground">{van.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{van.capacity}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {van.event?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground capitalize">
                        {van.event?.vanStatus?.replace("_", " ") ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant={activeVanId === van.id ? "secondary" : "outline"}
                            className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                            onClick={() => setActiveVanId(van.id)}
                          >
                            {activeVanId === van.id ? "Fila ativa" : "Ver fila"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                            onClick={() => setEditingVanId(van.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                            onClick={() => handleVanDelete(van.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vans.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-center text-muted-foreground" colSpan={5}>
                        Nenhuma van cadastrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Vans com passageiros ativos não podem ser excluídas. Libere ou mova todo mundo antes de remover.
            </p>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Cadastrar nova van</h4>
              <form className="grid gap-3 md:grid-cols-3" onSubmit={handleVanCreate}>
                <Input
                  className="md:col-span-1"
                  placeholder="Nome da van"
                  value={newVanForm.name}
                  onChange={(event) => setNewVanForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Input
                  placeholder="Capacidade (opcional)"
                  type="number"
                  value={newVanForm.capacity}
                  onChange={(event) => setNewVanForm((prev) => ({ ...prev, capacity: event.target.value }))}
                />
                <Input
                  placeholder="Partida (opcional)"
                  type="datetime-local"
                  value={newVanForm.departure}
                  onChange={(event) => setNewVanForm((prev) => ({ ...prev, departure: event.target.value }))}
                />
                <Button className="md:col-span-3" type="submit">
                  Criar van
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Reservas em tempo real</CardTitle>
            <CardDescription>Visualize a ocupação atual e exporte relatórios para a operação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">
                {activeVan
                  ? `Fila atual: ${activeVan.name} · ${activeVan.capacity} lugares`
                  : "Selecione uma van na tabela acima para visualizar a fila."}
              </div>
              <select
                className="w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-auto"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">Todos os status</option>
                <option value="confirmed">Apenas confirmados</option>
                <option value="waitlisted">Somente lista de espera</option>
              </select>
              <Button
                disabled={!activeVanId}
                onClick={() => activeVanId && loadReservations(activeVanId, statusFilter)}
                type="button"
                variant="outline"
              >
                Atualizar lista
              </Button>
              <Button disabled={!activeVanId} onClick={handleExport} type="button" variant="secondary">
                Exportar CSV
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Pagamentos dos confirmados</h3>
                  <span className="text-xs text-muted-foreground">{confirmed.length} passageiros</span>
                </div>
                <div className="space-y-2">
                  {confirmed.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum passageiro confirmado no momento.</p>
                  ) : (
                    confirmed.map((reservation) => {
                      const isUpdating = updatingPayments.has(reservation.id);
                      const amountLabel = reservation.chargedAmount > 0 ? formatCurrency(reservation.chargedAmount) : "Valor pendente";
                      return (
                        <div
                          key={reservation.id}
                          className="flex flex-col gap-2 rounded-md border border-border/50 bg-background/40 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{reservation.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                Posição {reservation.position} · {amountLabel}
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border/60 bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                checked={reservation.hasPaid}
                                onChange={(event) => handleTogglePayment(reservation.id, event.target.checked)}
                                disabled={isUpdating}
                              />
                              {reservation.hasPaid ? "Pago" : "Pendente"}
                            </label>
                          </div>
                          {!reservation.hasPaid && reservation.chargedAmount > 0 && (
                            <p className="text-xs text-muted-foreground">Aguardando pagamento de {formatCurrency(reservation.chargedAmount)}.</p>
                          )}
                          {reservation.hasPaid && (
                            <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70">Pagamento confirmado</p>
                          )}
                          {isUpdating && (
                            <p className="text-[11px] text-muted-foreground">Atualizando…</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <QueueSection
                emptyState="A lista de espera está vazia."
                highlightedName={null}
                items={waitlisted}
                title="Lista de espera"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/50">
              <table className="min-w-full divide-y divide-border/40 text-sm">
                <thead className="bg-background/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nome</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Entrada</th>
                    <th className="px-4 py-2 text-left font-medium">Liberação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="px-4 py-2 text-foreground">{reservation.fullName}</td>
                      <td className="px-4 py-2 capitalize text-muted-foreground">{reservation.status}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(reservation.joinedAt)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(reservation.releasedAt)}</td>
                    </tr>
                  ))}
                  {reservations.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-center text-muted-foreground" colSpan={4}>
                        Nenhuma reserva encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Carregando dados atualizados…</p>}
    </div>
  );
};

export default AdminDashboard;
