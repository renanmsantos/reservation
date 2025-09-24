export type ReservationStatus = "confirmed" | "waitlisted" | "cancelled";

export type ReservationRecord = {
  id: string;
  vanId: string;
  fullName: string;
  email: string | null;
  status: ReservationStatus;
  position: number;
  joinedAt: string;
};

export type ReservationQueue = {
  van: {
    id: string;
    name: string;
    capacity: number;
  };
  confirmed: ReservationRecord[];
  waitlisted: ReservationRecord[];
};

export type ReservationErrorPayload = {
  message: string;
  code: string;
  existingReservation?: ReservationRecord;
};

export const DEFAULT_VAN_NAME = process.env.DEFAULT_VAN_NAME ?? "Main Van";

export const sanitizeFullName = (fullName: string) => fullName.trim().replace(/\s+/g, " ");

export const isActiveStatus = (status: ReservationStatus) => status === "confirmed" || status === "waitlisted";

export const createReservationQueue = (args: {
  van: { id: string; name: string; capacity: number };
  reservations: ReservationRecord[];
}): ReservationQueue => {
  const confirmed = args.reservations
    .filter((reservation) => reservation.status === "confirmed")
    .sort((a, b) => a.position - b.position);

  const waitlisted = args.reservations
    .filter((reservation) => reservation.status === "waitlisted")
    .sort((a, b) => a.position - b.position);

  return {
    van: args.van,
    confirmed,
    waitlisted,
  };
};
