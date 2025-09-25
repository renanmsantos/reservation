import { createReservationQueue } from "@/lib/reservations";
import type { ReservationQueue, ReservationRecord, ReservationStatus } from "@/lib/reservations";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CAPACITY = Number(process.env.MAX_SEATS ?? 15);

export type ReservationRow = {
  id: string;
  van_id: string;
  event_id: string | null;
  full_name: string;
  status: ReservationStatus;
  position: number;
  joined_at: string;
  charged_amount: number;
  has_paid: boolean;
};

type VanRow = {
  id: string;
  name: string;
  capacity: number;
  default_event_id: string | null;
};

type EventAssociationRow = {
  status: string;
  per_passenger_cost: number | null;
  van_cost: number | null;
  event: {
    id: string;
    name: string;
    event_date: string;
    status: string;
    total_cost: number;
  } | null;
};

type EventVanDetails = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  perPassengerCost: number | null;
  vanCost: number | null;
};

export const fetchQueue = async (client: SupabaseClient, vanId: string): Promise<ReservationQueue> => {
  const { data: van, error: vanError } = await client
    .from("vans")
    .select("id, name, capacity, default_event_id")
    .eq("id", vanId)
    .maybeSingle<VanRow>();

  if (vanError || !van) {
    throw new Error(vanError?.message ?? "Van não encontrada");
  }

  const { data: reservations, error: reservationsError } = await client
    .from("reservations")
    .select("id, van_id, event_id, full_name, status, position, joined_at, charged_amount, has_paid")
    .eq("van_id", van.id)
    .neq("status", "cancelled")
    .returns<ReservationRow[]>();

  if (reservationsError) {
    throw reservationsError;
  }

  const { data: eventAssociation } = await client
    .from("event_vans")
    .select("status, per_passenger_cost, van_cost, event:events(id, name, event_date, status, total_cost)")
    .eq("van_id", van.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EventAssociationRow>();

  let event: ReservationQueue["event"] = null;

  const loadEventVans = async (eventId: string): Promise<EventVanDetails[]> => {
    type EventVanQueryRow = {
      id: string;
      status: string;
      per_passenger_cost: string | number | null;
      van_cost: string | number | null;
      van: {
        id: string;
        name: string;
        capacity: number;
      } | null;
    };

    const { data } = await client
      .from("event_vans")
      .select("id, status, per_passenger_cost, van_cost, van:vans(id, name, capacity)")
      .eq("event_id", eventId);

    const rows = (data ?? []) as unknown as EventVanQueryRow[];

    return rows
      .map((item) =>
        item.van
          ? {
              id: item.van.id,
              name: item.van.name,
              capacity: item.van.capacity,
              status: item.status,
              perPassengerCost:
                item.per_passenger_cost !== undefined && item.per_passenger_cost !== null
                  ? Number(item.per_passenger_cost)
                  : null,
              vanCost:
                item.van_cost !== undefined && item.van_cost !== null
                  ? Number(item.van_cost)
                  : null,
            }
          : null,
      )
      .filter((value): value is EventVanDetails => Boolean(value));
  };

  const mapEvent = async (
    rawEvent: { id: string; name: string; event_date: string; status: string; total_cost: number | null },
    vanStatus: string | null,
    vanCost: number | null,
    perPassengerCost: number | null,
  ) => {
    if (!rawEvent || rawEvent.status !== "em_andamento") {
      return null;
    }

    const vansForEvent = await loadEventVans(rawEvent.id);

    return {
      id: rawEvent.id,
      name: rawEvent.name,
      eventDate: rawEvent.event_date,
      status: rawEvent.status,
      totalCost: Number(rawEvent.total_cost ?? 0),
      vanStatus,
      vans: vansForEvent,
      currentVanPerPassengerCost: perPassengerCost !== null ? Number(perPassengerCost) : null,
      currentVanCost: vanCost !== null ? Number(vanCost) : null,
    };
  };

  if (eventAssociation?.event) {
    event = await mapEvent(
      eventAssociation.event,
      eventAssociation.status ?? null,
      eventAssociation.van_cost ?? null,
      eventAssociation.per_passenger_cost ?? null,
    );
  } else if (van.default_event_id) {
    const { data: fallbackEvent } = await client
      .from("events")
      .select("id, name, event_date, status, total_cost")
      .eq("id", van.default_event_id)
      .maybeSingle();

    if (fallbackEvent) {
      event = await mapEvent(fallbackEvent, null, null, null);
    }
  }

  const mappedReservations: ReservationRecord[] = (reservations ?? []).map(mapReservationRow);

  return createReservationQueue({
    van,
    reservations: mappedReservations,
    event,
  });
};

export const ensureVanByName = async (client: SupabaseClient, options: { name: string }) => {
  const { data: existingVan } = await client
    .from("vans")
    .select("id, name, capacity, default_event_id")
    .eq("name", options.name)
    .maybeSingle<VanRow>();

  if (existingVan) {
    return existingVan;
  }

  const insertResult = await client
    .from("vans")
    .insert({
      name: options.name,
      departure_timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capacity: DEFAULT_CAPACITY,
    })
    .select("id, name, capacity, default_event_id")
    .single<VanRow>();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return insertResult.data;
};

export const getActiveReservationById = async (client: SupabaseClient, reservationId: string) => {
  const { data, error } = await client
    .from("reservations")
    .select("id, van_id, event_id, full_name, status, position, joined_at, charged_amount, has_paid")
    .eq("id", reservationId)
    .neq("status", "cancelled")
    .maybeSingle<ReservationRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapReservationRow(data);
};

export const mapReservationRow = (row: ReservationRow): ReservationRecord => ({
  id: row.id,
  vanId: row.van_id,
  eventId: row.event_id,
  fullName: row.full_name,
  status: row.status,
  position: row.position,
  joinedAt: row.joined_at,
  chargedAmount: Number(row.charged_amount ?? 0),
  hasPaid: Boolean(row.has_paid),
});

type ReservationEventType =
  | "join"
  | "waitlist"
  | "release"
  | "duplicate_blocked"
  | "override_added"
  | "override_removed"
  | "capacity_updated"
  | "van_created"
  | "van_removed";

export const logReservationEvent = async (
  client: SupabaseClient,
  eventType: ReservationEventType,
  payload: Record<string, unknown>,
) => {
  await client.from("reservation_events").insert({
    event_type: eventType,
    payload,
  });
};

type ErrorLike = {
  message?: string;
  code?: string;
  hint?: string;
  details?: string;
};

export const toPostgrestError = (error: unknown): PostgrestError | null => {
  if (error && typeof error === "object" && "message" in error) {
    const candidate = error as ErrorLike;
    if (typeof candidate.message === "string") {
      return {
        name: "",
        message: candidate.message,
        code: typeof candidate.code === "string" ? candidate.code : "",
        hint: typeof candidate.hint === "string" ? candidate.hint : "",
        details: typeof candidate.details === "string" ? candidate.details : "",
      } satisfies PostgrestError;
    }
  }

  return null;
};
