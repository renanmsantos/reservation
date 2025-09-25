import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT_STATUSES = ["planejado", "em_andamento", "finalizado"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VAN_STATUSES = ["aberta", "cheia", "fechada", "em_espera"] as const;
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
  van_cost: number;
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
};

type AttachVanPayload = {
  eventId: string;
  vanId: string;
  vanCost: number;
  status?: EventVanStatus;
};

export const isValidEventStatus = (value: string): value is EventStatus =>
  EVENT_STATUSES.includes(value as EventStatus);

export const isValidEventVanStatus = (value: string): value is EventVanStatus =>
  EVENT_VAN_STATUSES.includes(value as EventVanStatus);

export const canTransitionEventStatus = (current: EventStatus, next: EventStatus) =>
  nextStatusMap[current].includes(next);

const recalculateEventTotal = async (client: SupabaseClient, eventId: string) => {
  const { data, error } = await client
    .from("event_vans")
    .select("van_cost")
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }

  const total = (data ?? []).reduce((sum, item) => sum + Number(item?.van_cost ?? 0), 0);

  const { error: updateError } = await client
    .from("events")
    .update({ total_cost: total, updated_at: new Date().toISOString() })
    .eq("id", eventId);

  if (updateError) {
    throw updateError;
  }

  return total;
};

export const createEvent = async (client: SupabaseClient, payload: InsertEventPayload) => {
  const result = await client
    .from("events")
    .insert({
      name: payload.name,
      event_date: payload.eventDate,
      status: payload.status,
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
      van_cost: payload.vanCost,
      per_passenger_cost: null,
    })
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Não foi possível associar a van ao evento.");
  }

  const now = new Date().toISOString();

  await client
    .from("vans")
    .update({ default_event_id: payload.eventId, updated_at: now })
    .eq("id", payload.vanId);

  await client
    .from("reservations")
    .update({ event_id: payload.eventId })
    .eq("van_id", payload.vanId);

  await recalculateEventTotal(client, payload.eventId);

  return result.data;
};

type UpdateEventVanStatusPayload = {
  eventId: string;
  vanId: string;
  nextStatus: EventVanStatus;
};

type UpdateEventVanCostPayload = {
  eventId: string;
  vanId: string;
  vanCost: number;
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
    .select("id, status")
    .eq("id", payload.eventId)
    .maybeSingle<{ id: string; status: EventStatus }>();

  if (eventError || !event) {
    throw eventError ?? new Error("Evento não encontrado.");
  }

  if (event.status === "finalizado" && payload.nextStatus !== "fechada") {
    throw new Error("Evento finalizado não permite reabrir vans.");
  }

  const { data: vanAssoc, error: assocError } = await client
    .from("event_vans")
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .maybeSingle<EventVanRow>();

  if (assocError || !vanAssoc) {
    throw assocError ?? new Error("Van não associada ao evento.");
  }

  if (vanAssoc.status === payload.nextStatus && payload.nextStatus !== "fechada") {
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

    if (Number(vanAssoc.van_cost ?? 0) <= 0) {
      throw new Error("Defina o custo da van antes de fechar.");
    }

    const perPassengerCost = calculatePerPassengerCost(Number(vanAssoc.van_cost ?? 0), passengerCount);

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
      .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
      .single<EventVanRow>();

    if (error || !data) {
      throw error ?? new Error("Não foi possível atualizar o status da van.");
    }

    const updateReservations = await client
      .from("reservations")
      .update({ charged_amount: perPassengerCost, event_id: payload.eventId, has_paid: false })
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (updateReservations.error) {
      throw updateReservations.error;
    }

    const { data: waitlistedPassengers, error: waitlistedError } = await client
      .from("reservations")
      .select("id")
      .eq("van_id", payload.vanId)
      .eq("status", "waitlisted")
      .order("position", { ascending: true })
      .returns<{ id: string }[]>();

    if (waitlistedError) {
      throw waitlistedError;
    }

    if (waitlistedPassengers && waitlistedPassengers.length > 0) {
      const { data: candidateVans, error: candidateError } = await client
        .from("event_vans")
        .select("status, van:vans (id, capacity)")
        .eq("event_id", payload.eventId)
        .neq("van_id", payload.vanId)
        .order("created_at", { ascending: true })
        .returns<Array<{ status: string; van: { id: string | null; capacity: number | null } | null }>>();

      if (candidateError) {
        throw candidateError;
      }

      const targetVan = (candidateVans ?? []).find((item) => item.status === "aberta" && item.van?.id);

      if (targetVan?.van?.id) {
        const targetVanId = targetVan.van.id;
        const targetCapacity = targetVan.van.capacity ?? 0;

        const { count: currentConfirmedCount, error: confirmedCountError } = await client
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("van_id", targetVanId)
          .eq("status", "confirmed");

        if (confirmedCountError) {
          throw confirmedCountError;
        }

        const { data: lastWaitPositionRow } = await client
          .from("reservations")
          .select("position")
          .eq("van_id", targetVanId)
          .eq("status", "waitlisted")
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle<{ position: number }>();

        let confirmedCount = currentConfirmedCount ?? 0;
        let nextConfirmedPosition = confirmedCount + 1;
        let nextWaitlistPosition = (lastWaitPositionRow?.position ?? 0) + 1;

        for (const passenger of waitlistedPassengers) {
          const shouldConfirm = confirmedCount < targetCapacity;
          const updateWaitlist = await client
            .from("reservations")
            .update({
              van_id: targetVanId,
              event_id: payload.eventId,
              status: shouldConfirm ? "confirmed" : "waitlisted",
              position: shouldConfirm ? nextConfirmedPosition : nextWaitlistPosition,
            })
            .eq("id", passenger.id);

          if (updateWaitlist.error) {
            throw updateWaitlist.error;
          }

          if (shouldConfirm) {
            confirmedCount += 1;
            nextConfirmedPosition += 1;
          } else {
            nextWaitlistPosition += 1;
          }
        }

        await syncEventVanStatusWithCapacity(client, targetVanId);
      }
    }

    return data;
  }

  const updates: Record<string, unknown> = {
    status: payload.nextStatus,
    updated_at: now,
  };

  if (payload.nextStatus !== "cheia") {
    updates.per_passenger_cost = null;
    updates.closed_at = null;
  }

  const { data, error } = await client
    .from("event_vans")
    .update(updates)
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível atualizar o status da van.");
  }

  if (payload.nextStatus !== "cheia") {
    const resetReservations = await client
      .from("reservations")
      .update({ charged_amount: 0, has_paid: false })
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (resetReservations.error) {
      throw resetReservations.error;
    }
  }

  return data;
};

export const syncEventVanStatusWithCapacity = async (
  client: SupabaseClient,
  vanId: string,
) => {
  const { data: association, error: assocError } = await client
    .from("event_vans")
    .select("event_id, status, van:vans (id, capacity)")
    .eq("van_id", vanId)
    .maybeSingle<{ event_id: string; status: EventVanStatus; van: { id: string; capacity: number } | null }>();

  if (assocError) {
    throw assocError;
  }

  if (!association || !association.van) {
    return null;
  }

  if (association.status === "fechada" || association.status === "em_espera") {
    return null;
  }

  const { count: confirmedCount, error: countError } = await client
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("van_id", vanId)
    .eq("status", "confirmed");

  if (countError) {
    throw countError;
  }

  const capacity = association.van.capacity ?? 0;
  const confirmed = confirmedCount ?? 0;
  const targetStatus: EventVanStatus = confirmed >= capacity && capacity > 0 ? "cheia" : "aberta";

  if (targetStatus === association.status) {
    return null;
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await client
    .from("event_vans")
    .update({ status: targetStatus, updated_at: now })
    .eq("van_id", vanId)
    .eq("event_id", association.event_id)
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (updateError || !updated) {
    throw updateError ?? new Error("Não foi possível atualizar o status da van.");
  }

  return updated;
};

export const updateEventVanCost = async (
  client: SupabaseClient,
  payload: UpdateEventVanCostPayload,
) => {
  if (Number.isNaN(payload.vanCost) || payload.vanCost < 0) {
    throw new Error("O custo da van deve ser maior ou igual a zero.");
  }

  const { data: association, error: assocError } = await client
    .from("event_vans")
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .maybeSingle<EventVanRow>();

  if (assocError || !association) {
    throw assocError ?? new Error("Van não associada ao evento.");
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    van_cost: payload.vanCost,
    updated_at: now,
  };

  let perPassengerCost: number | null | undefined = association.per_passenger_cost;

  if (association.status === "fechada") {
    const { data: confirmedReservations, error: reservationsError } = await client
      .from("reservations")
      .select("id")
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (reservationsError) {
      throw reservationsError;
    }

    const passengerCount = confirmedReservations?.length ?? 0;
    if (passengerCount > 0) {
      perPassengerCost = calculatePerPassengerCost(payload.vanCost, passengerCount);
    } else {
      perPassengerCost = null;
    }

    updates.per_passenger_cost = perPassengerCost;
  }

  const { data, error } = await client
    .from("event_vans")
    .update(updates)
    .eq("event_id", payload.eventId)
    .eq("van_id", payload.vanId)
    .select("id, event_id, van_id, status, van_cost, per_passenger_cost, closed_at, created_at, updated_at")
    .single<EventVanRow>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível atualizar o custo da van.");
  }

  if (association.status === "fechada") {
    const updateReservations = await client
      .from("reservations")
      .update({ charged_amount: perPassengerCost ?? 0 })
      .eq("van_id", payload.vanId)
      .eq("status", "confirmed");

    if (updateReservations.error) {
      throw updateReservations.error;
    }
  }

  await recalculateEventTotal(client, payload.eventId);

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
    .update({ event_id: null, charged_amount: 0, has_paid: false })
    .eq("van_id", payload.vanId);

  await recalculateEventTotal(client, payload.eventId);

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
         van_cost,
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

  return data.map((event) => {
    const eventVans = (event.event_vans ?? []).map((item) => ({
      ...item,
      van_cost: Number(item?.van_cost ?? 0),
    }));
    const totalCost = eventVans.reduce((sum, item) => sum + Number(item.van_cost ?? 0), 0);

    return {
      ...event,
      total_cost: totalCost,
      event_vans: eventVans,
    };
  });
};
