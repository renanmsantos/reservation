import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { PATCH as updateVanCapacity } from "@/app/api/admin/vans/[id]/route";
import { POST as createOverride } from "@/app/api/admin/overrides/route";
import { DELETE as deleteOverride } from "@/app/api/admin/overrides/[id]/route";
import { GET as exportReservations } from "@/app/api/admin/reservations/export/route";
import * as reservationsService from "@/lib/reservations-service";

let mockClient: unknown;

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

  it("updates van capacity and logs event", async () => {
    const vanBuilder = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: "van-1", name: "Main Van", capacity: 20 },
              error: null,
            })),
          })),
        })),
      })),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        if (table === "vans") {
          return vanBuilder;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const logSpy = vi.spyOn(reservationsService, "logReservationEvent").mockResolvedValue(undefined);

    const response = await updateVanCapacity(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ capacity: 20 }),
      }),
      { params: Promise.resolve({ id: "van-1" }) },
    );

    expect(response.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(mockClient, "capacity_updated", {
      capacity: 20,
      van_id: "van-1",
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
                email: "jordan@example.com",
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
});
