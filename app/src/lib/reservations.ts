export type ReservationStatus = "confirmed" | "waitlisted" | "cancelled";

export type ReservationRecord = {
  id: string;
  vanId: string;
  eventId: string | null;
  fullName: string;
  status: ReservationStatus;
  position: number;
  joinedAt: string;
};

export type ReservationQueue = {
  van: {
    id: string;
    name: string;
    capacity: number;
    defaultEventId: string | null;
  };
  event: {
    id: string;
    name: string;
    eventDate: string;
    status: string;
    totalCost: number;
    vanStatus: string | null;
    vans: Array<{
      id: string;
      name: string;
      capacity: number;
      status: string;
    }>;
  } | null;
  confirmed: ReservationRecord[];
  waitlisted: ReservationRecord[];
};

export type ReservationErrorPayload = {
  message: string;
  code: string;
  existingReservation?: ReservationRecord;
};

export const DEFAULT_VAN_NAME = process.env.DEFAULT_VAN_NAME ?? "Van Principal";

export const sanitizeFullName = (fullName: string) => fullName.trim().replace(/\s+/g, " ");

export const isActiveStatus = (status: ReservationStatus) => status === "confirmed" || status === "waitlisted";

export const createReservationQueue = (args: {
  van: { id: string; name: string; capacity: number; default_event_id: string | null };
  reservations: ReservationRecord[];
  event: ReservationQueue["event"];
}): ReservationQueue => {
  const confirmed = args.reservations
    .filter((reservation) => reservation.status === "confirmed")
    .sort((a, b) => a.position - b.position);

  const waitlisted = args.reservations
    .filter((reservation) => reservation.status === "waitlisted")
    .sort((a, b) => a.position - b.position);

  return {
    van: {
      id: args.van.id,
      name: args.van.name,
      capacity: args.van.capacity,
      defaultEventId: args.van.default_event_id,
    },
    event: args.event,
    confirmed,
    waitlisted,
  };
};
