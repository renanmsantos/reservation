import { createReservationQueue } from "@/lib/reservations";
import type { ReservationQueue, ReservationRecord, ReservationStatus } from "@/lib/reservations";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CAPACITY = Number(process.env.MAX_SEATS ?? 15);

export type ReservationRow = {
  id: string;
  van_id: string;
  full_name: string;
  email: string | null;
  status: ReservationStatus;
  position: number;
  joined_at: string;
};

type VanRow = {
  id: string;
  name: string;
  capacity: number;
};

export const fetchQueue = async (client: SupabaseClient, vanId: string): Promise<ReservationQueue> => {
  const { data: van, error: vanError } = await client
    .from("vans")
    .select("id, name, capacity")
    .eq("id", vanId)
    .maybeSingle<VanRow>();

  if (vanError || !van) {
    throw new Error(vanError?.message ?? "Van not found");
  }

  const { data: reservations, error: reservationsError } = await client
    .from("reservations")
    .select("id, van_id, full_name, email, status, position, joined_at")
    .eq("van_id", van.id)
    .neq("status", "cancelled")
    .returns<ReservationRow[]>();

  if (reservationsError) {
    throw reservationsError;
  }

  const mappedReservations: ReservationRecord[] = (reservations ?? []).map(mapReservationRow);

  return createReservationQueue({
    van,
    reservations: mappedReservations,
  });
};

export const ensureVanByName = async (client: SupabaseClient, options: { name: string }) => {
  const { data: existingVan } = await client
    .from("vans")
    .select("id, name, capacity")
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
    .select("id, name, capacity")
    .single<VanRow>();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return insertResult.data;
};

export const getActiveReservationById = async (client: SupabaseClient, reservationId: string) => {
  const { data, error } = await client
    .from("reservations")
    .select("id, van_id, full_name, email, status, position, joined_at")
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
  fullName: row.full_name,
  email: row.email,
  status: row.status,
  position: row.position,
  joinedAt: row.joined_at,
});

type ReservationEventType =
  | "join"
  | "waitlist"
  | "release"
  | "duplicate_blocked"
  | "override_added"
  | "override_removed"
  | "capacity_updated";

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
