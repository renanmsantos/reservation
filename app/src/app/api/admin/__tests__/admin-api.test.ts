import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { PATCH as updateVan, DELETE as removeVan } from "@/app/api/admin/vans/[id]/route";
import { POST as createVan } from "@/app/api/admin/vans/route";
import { POST as createOverride } from "@/app/api/admin/overrides/route";
import { DELETE as deleteOverride } from "@/app/api/admin/overrides/[id]/route";
import { GET as exportReservations } from "@/app/api/admin/reservations/export/route";
import * as reservationsService from "@/lib/reservations-service";

let mockClient: unknown;

vi.mock("@/lib/auth", () => ({
  isAdminAuthenticated: vi.fn(async () => true),
}));

vi.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => mockClient,
}));

describe("Admin API", () => {
  beforeEach(() => {
    mockClient = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates van details and logs capacity changes", async () => {
    const selectMaybeSingle = vi.fn(async () => ({
      data: {
        id: "van-1",
        name: "Van Principal",
        capacity: 15,
        departure_timestamp: null,
      },
      error: null,
    }));

    const selectBuilder = vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: selectMaybeSingle })),
    }));

    const updateSingle = vi.fn(async () => ({
      data: {
        id: "van-1",
        name: "Van Atualizada",
        capacity: 20,
        departure_timestamp: "2024-01-01T10:00:00.000Z",
        default_event_id: null,
      },
      error: null,
    }));

    const updateBuilder = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ single: updateSingle })),
      })),
    }));

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "vans") {
          return {
            select: selectBuilder,
            update: updateBuilder,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const logSpy = vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await updateVan(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Van Atualizada",
          capacity: 20,
          departureTimestamp: "2024-01-01T07:00:00-03:00",
        }),
      }),
      { params: Promise.resolve({ id: "van-1" }) },
    );

    expect(response.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(mockClient, "capacity_updated", {
      capacity: 20,
      van_id: "van-1",
    });
  });

  it("creates a new van and logs the event", async () => {
    const insertBuilder = {
      insert: vi.fn(() => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "van-2",
              name: "Van Nova",
              capacity: 18,
              departure_timestamp: "2024-01-01T12:00:00.000Z",
            },
            error: null,
          }),
        }),
      })),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "vans") {
          return insertBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const logSpy = vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await createVan(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Van Nova", capacity: 18 }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.van.name).toBe("Van Nova");
    expect(logSpy).toHaveBeenCalledWith(mockClient, "van_created", {
      van_id: "van-2",
      name: "Van Nova",
      capacity: 18,
    });
  });

  it("creates a duplicate name override", async () => {
    const overrideUpsertBuilder = {
      upsert: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "override-1",
              full_name: "Jordan Carter",
              reason: "Family",
              expires_at: null,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "duplicate_name_overrides") {
          return overrideUpsertBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const logSpy = vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await createOverride(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ fullName: "Jordan Carter", reason: "Family" }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.override.full_name).toBe("Jordan Carter");
    expect(logSpy).toHaveBeenCalledWith(mockClient, "override_added", expect.any(Object));
  });

  it("removes a duplicate name override", async () => {
    const deleteBuilder = {
      delete: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { full_name: "Jordan Carter" }, error: null }),
          }),
        }),
      }),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "duplicate_name_overrides") {
          return deleteBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await deleteOverride(new Request("http://localhost"), {
      params: Promise.resolve({ id: "override-1" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
  });

  it("exports reservations as CSV", async () => {
    const reservationsBuilder = {
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                full_name: "Jordan Carter",
                status: "confirmed",
                position: 1,
                joined_at: "2024-01-01T00:00:00.000Z",
                released_at: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "reservations") {
          return reservationsBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const response = await exportReservations(new Request("http://localhost?vanId=van-1"));

    expect(response.headers.get("Content-Type")).toBe("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("van-van-1-roster.csv");
    const text = await response.text();
    expect(text).toContain("Jordan Carter");
  });

  it("removes a van without active passengers", async () => {
    const reservationsBuilder = {
      select: () => ({
        eq: () => ({
          in: async () => ({ count: 0, error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({ data: null, error: null }),
      }),
    };

    const vansBuilder = {
      delete: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { id: "van-1", name: "Van Principal", capacity: 20 },
              error: null,
            }),
          }),
        }),
      }),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "reservations") {
          return reservationsBuilder;
        }
        if (table === "vans") {
          return vansBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const logSpy = vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await removeVan(new Request("http://localhost"), {
      params: Promise.resolve({ id: "van-1" }),
    });

    expect(response.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(mockClient, "van_removed", {
      van_id: "van-1",
      name: "Van Principal",
    });
  });
});
