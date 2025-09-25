import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT_STATUSES = ["planejado", "em_andamento", "finalizado"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VAN_STATUSES = ["aberta", "fechada", "em_espera"] as const;
export type EventVanStatus = (typeof EVENT_VAN_STATUSES)[number];

export type EventRow = {
  id: string;
  name: string;
  event_date: string;
  status: EventStatus;
  total_cost: number;
  created_at: string;
  updated_at: string;
};

export type EventVanRow = {
  id: string;
  event_id: string;
  van_id: string;
  status: EventVanStatus;
  per_passenger_cost: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

const nextStatusMap: Record<EventStatus, EventStatus[]> = {
  planejado: ["planejado", "em_andamento"],
  em_andamento: ["em_andamento", "finalizado"],
  finalizado: ["finalizado"],
};

type InsertEventPayload = {
  name: string;
  eventDate: string;
  status: EventStatus;
  totalCost: number;
};

type AttachVanPayload = {
  eventId: string;
  vanId: string;
  status?: EventVanStatus;
};

export const isValidEventStatus = (value: string): value is EventStatus =>
  EVENT_STATUSES.includes(value as EventStatus);

export const isValidEventVanStatus = (value: string): value is EventVanStatus =>
  EVENT_VAN_STATUSES.includes(value as EventVanStatus);

export const canTransitionEventStatus = (current: EventStatus, next: EventStatus) =>
  nextStatusMap[current].includes(next);

export const createEvent = async (client: SupabaseClient, payload: InsertEventPayload) => {
  const result = await client
    .from("events")
    .insert({
      name: payload.name,
      event_date: payload.eventDate,
      status: payload.status,
      total_cost: payload.totalCost,
    })
    .select("id, name, event_date, status, total_cost, created_at, updated_at")
    .single<EventRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Não foi possível criar o evento.");
  }

  return result.data;
};

export const getEventById = async (client: SupabaseClient, eventId: string) => {
  const result = await client
    .from("events")
    .select("id, name, event_date, status, total_cost, created_at, updated_at")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? null;
};

type UpdateEventPayload = {
  eventId: string;
  status?: EventStatus;
  name?: string;
  eventDate?: string;
  totalCost?: number;
};

export const updateEvent = async (client: SupabaseClient, payload: UpdateEventPayload) => {
  const { eventId, ...updates } = payload;

  if (Object.keys(updates).length === 0) {
    throw new Error("Nenhuma alteração informada.");
  }

  const result = await client
    .from("events")
    .update({
      ...(updates.status ? { status: updates.status } : null),
      ...(updates.name ? { name: updates.name } : null),
      ...(updates.eventDate ? { event_date: updates.eventDate } : null),
      ...(typeof updates.totalCost === "number" ? { total_cost: updates.totalCost } : null),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("id, name, event_date, status, total_cost, created_at, updated_at")
    .single<EventRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Não foi possível atualizar o evento.");
  }

  return result.data;
};

export const attachVanToEvent = async (
  client: SupabaseClient,
  payload: AttachVanPayload,
) => {
  const status = payload.status ?? "aberta";

  const result = await client
    .from("event_vans")
    .insert({
      event_id: payload.eventId,
      van_id: payload.vanId,
      status,
      per_passenger_cost: null,
    })
    .select("id, event_id, van_id, status, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Não foi possível associar a van ao evento.");
  }

  await client
    .from("vans")
    .update({ default_event_id: payload.eventId, updated_at: new Date().toISOString() })
    .eq("id", payload.vanId);

  await client
    .from("reservations")
    .update({ event_id: payload.eventId })
    .eq("van_id", payload.vanId);

  return result.data;
};

type UpdateEventVanStatusPayload = {
  eventId: string;
  vanId: string;
  nextStatus: EventVanStatus;
};

type DetachVanPayload = {
  eventId: string;
  vanId: string;
};

const calculatePerPassengerCost = (totalCost: number, passengerCount: number) => {
  if (passengerCount <= 0) {
    throw new Error("Não há passageiros confirmados para calcular o rateio.");
  }
  return Number((totalCost / passengerCount).toFixed(2));
};

export const updateEventVanStatus = async (
  client: SupabaseClient,
  payload: UpdateEventVanStatusPayload,
) => {
  if (!isValidEventVanStatus(payload.nextStatus)) {
    throw new Error("Status da van inválido.");
  }

  const { data: event, error: eventError } = await client
    .from("events")
    .select("id, status, total_cost")
    .eq("id", payload.eventId)
    .maybeSingle();

  if (eventError || !event) {
    throw eventError ?? new Error("Evento não encontrado.");
  }

  if (event.status === "finalizado" && payload.nextStatus !== "fechada") {
    throw new Error("Evento finalizado não permite reabrir vans.");
  }

  const { data: vanAssoc, error: assocError } = await client
    .from("event_vans")
    .select("id, status, per_passenger_cost")
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .maybeSingle<EventVanRow>();

  if (assocError || !vanAssoc) {
    throw assocError ?? new Error("Van não associada ao evento.");
  }

  if (vanAssoc.status === payload.nextStatus) {
    return vanAssoc;
  }

  const now = new Date().toISOString();

  if (payload.nextStatus === "fechada") {
    const { data: confirmedReservations, error: reservationsError } = await client
      .from("reservations")
      .select("id")
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (reservationsError) {
      throw reservationsError;
    }

    const passengerCount = confirmedReservations?.length ?? 0;

    if (passengerCount === 0) {
      throw new Error("Não é possível fechar a van sem passageiros confirmados.");
    }

    const perPassengerCost = calculatePerPassengerCost(Number(event.total_cost ?? 0), passengerCount);

    const { data, error } = await client
      .from("event_vans")
      .update({
        status: payload.nextStatus,
        per_passenger_cost: perPassengerCost,
        closed_at: now,
        updated_at: now,
      })
      .eq("event_id", payload.eventId)
      .eq("van_id", payload.vanId)
      .select("id, event_id, van_id, status, per_passenger_cost, closed_at, created_at, updated_at")
      .single<EventVanRow>();

    if (error || !data) {
      throw error ?? new Error("Não foi possível atualizar o status da van.");
    }

    const updateReservations = await client
      .from("reservations")
      .update({ charged_amount: perPassengerCost, event_id: payload.eventId })
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (updateReservations.error) {
      throw updateReservations.error;
    }

    return data;
  }

  const { data, error } = await client
    .from("event_vans")
    .update({
      status: payload.nextStatus,
      per_passenger_cost: null,
      closed_at: null,
      updated_at: now,
    })
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .select("id, event_id, van_id, status, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível atualizar o status da van.");
  }

  const resetReservations = await client
    .from("reservations")
    .update({ charged_amount: 0, event_id: payload.eventId })
    .eq("van_id", payload.vanId)
    .eq("status", "confirmed");

  if (resetReservations.error) {
    throw resetReservations.error;
  }

  return data;
};

export const detachVanFromEvent = async (client: SupabaseClient, payload: DetachVanPayload) => {
  const association = await client
    .from("event_vans")
    .select("id")
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .maybeSingle<{ id: string }>();

  if (association.error) {
    throw association.error;
  }

  if (!association.data) {
    throw new Error("Van não associada ao evento informado.");
  }

  const { error: deleteError } = await client
    .from("event_vans")
    .delete()
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId);

  if (deleteError) {
    throw deleteError;
  }

  const now = new Date().toISOString();

  await client
    .from("vans")
    .update({ default_event_id: null, updated_at: now })
    .eq("id", payload.vanId)
    .eq("default_event_id", payload.eventId);

  await client
    .from("reservations")
    .update({ event_id: null, charged_amount: 0 })
    .eq("van_id", payload.vanId);

  return { id: association.data.id };
};

export const fetchEventsWithVans = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from("events")
    .select(
      `id, name, event_date, status, total_cost, created_at, updated_at,
       event_vans (
         id,
         status,
         per_passenger_cost,
         closed_at,
         created_at,
         updated_at,
         van:vans (id, name, capacity, departure_timestamp, default_event_id)
       )`
    )
    .order("event_date", { ascending: true });

  if (error || !data) {
    throw error ?? new Error("Não foi possível carregar os eventos.");
  }

  return data;
};
