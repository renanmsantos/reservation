import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import { GET as listEvents, POST as createEventRoute } from "@/app/api/admin/events/route";
import { PATCH as updateEventRoute } from "@/app/api/admin/events/[id]/route";
import { POST as attachVanRoute } from "@/app/api/admin/events/[id]/vans/route";
import {
  PATCH as updateEventVanRoute,
  DELETE as detachEventVanRoute,
} from "@/app/api/admin/events/[id]/vans/[vanId]/route";

vi.mock("@/lib/auth", () => ({
  isAdminAuthenticated: vi.fn(async () => true),
}));

const fetchEventsWithVansMock = vi.hoisted(() => vi.fn());
const createEventMock = vi.hoisted(() => vi.fn());
const updateEventMock = vi.hoisted(() => vi.fn());
const attachVanToEventMock = vi.hoisted(() => vi.fn());
const updateEventVanStatusMock = vi.hoisted(() => vi.fn());
const getEventByIdMock = vi.hoisted(() => vi.fn());
const detachVanFromEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/events-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/events-service")>("@/lib/events-service");
  return {
    ...actual,
    fetchEventsWithVans: fetchEventsWithVansMock,
    createEvent: createEventMock,
    updateEvent: updateEventMock,
    attachVanToEvent: attachVanToEventMock,
    updateEventVanStatus: updateEventVanStatusMock,
    getEventById: getEventByIdMock,
    detachVanFromEvent: detachVanFromEventMock,
  };
});

const createServiceRoleClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

describe("Admin Events API", () => {
  beforeEach(() => {
    fetchEventsWithVansMock.mockReset();
    createEventMock.mockReset();
    updateEventMock.mockReset();
    attachVanToEventMock.mockReset();
    updateEventVanStatusMock.mockReset();
    getEventByIdMock.mockReset();
    detachVanFromEventMock.mockReset();
    createServiceRoleClientMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists events", async () => {
    const mockClient = {};
    createServiceRoleClientMock.mockReturnValue(mockClient);
    fetchEventsWithVansMock.mockResolvedValue([{ id: "event-1" }]);

    const response = await listEvents();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchEventsWithVansMock).toHaveBeenCalledWith(mockClient);
    expect(payload.events).toHaveLength(1);
  });

  it("creates event with parsed date", async () => {
    const mockClient = {};
    createServiceRoleClientMock.mockReturnValue(mockClient);
    createEventMock.mockResolvedValue({
      id: "event-1",
      name: "Excursão",
      event_date: "2025-12-10",
      status: "planejado",
      total_cost: 500,
      created_at: "",
      updated_at: "",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        name: "Excursão",
        date: "10/12/2025",
        totalCost: 500,
      }),
    });

    const response = await createEventRoute(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createEventMock).toHaveBeenCalledWith(mockClient, {
      name: "Excursão",
      eventDate: "2025-12-10",
      status: "planejado",
      totalCost: 500,
    });
    expect(payload.event.id).toBe("event-1");
  });

  it("rejects invalid event date", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Excursão", date: "2025-12-10" }),
    });

    const response = await createEventRoute(request);
    expect(response.status).toBe(422);
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("updates event status when transition is allowed", async () => {
    const mockClient = { from: vi.fn() };
    createServiceRoleClientMock.mockReturnValue(mockClient);
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      name: "Excursão",
      event_date: "2025-12-10",
      status: "planejado",
      total_cost: 0,
      created_at: "",
      updated_at: "",
    });
    updateEventMock.mockResolvedValue({
      id: "event-1",
      name: "Excursão",
      event_date: "2025-12-10",
      status: "em_andamento",
      total_cost: 0,
      created_at: "",
      updated_at: "",
    });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "em_andamento" }),
    });

    const response = await updateEventRoute(request, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateEventMock).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      eventId: "event-1",
      status: "em_andamento",
    }));
    expect(payload.event.status).toBe("em_andamento");
  });

  it("blocks status regression", async () => {
    const mockClient = { from: vi.fn() };
    createServiceRoleClientMock.mockReturnValue(mockClient);
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      name: "Excursão",
      event_date: "2025-12-10",
      status: "em_andamento",
      total_cost: 0,
      created_at: "",
      updated_at: "",
    });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "planejado" }),
    });

    const response = await updateEventRoute(request, { params: Promise.resolve({ id: "event-1" }) });

    expect(response.status).toBe(422);
    expect(updateEventMock).not.toHaveBeenCalled();
  });

  it("impede atualizar evento finalizado", async () => {
    const mockClient = { from: vi.fn() };
    createServiceRoleClientMock.mockReturnValue(mockClient);
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      name: "Excursão",
      event_date: "2025-12-10",
      status: "finalizado",
      total_cost: 0,
      created_at: "",
      updated_at: "",
    });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ totalCost: 1000 }),
    });

    const response = await updateEventRoute(request, { params: Promise.resolve({ id: "event-1" }) });

    expect(response.status).toBe(422);
    expect(updateEventMock).not.toHaveBeenCalled();
  });

  it("associa van a evento", async () => {
    const maybeSingleEvent = vi.fn().mockResolvedValue({ data: { id: "event-1", status: "em_andamento" }, error: null });
    const maybeSingleVan = vi.fn().mockResolvedValue({ data: { id: "van-1" }, error: null });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "events") {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleEvent })) })),
          };
        }
        if (table === "vans") {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleVan })) })),
          };
        }
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })),
        };
      }),
    };

    createServiceRoleClientMock.mockReturnValue(mockClient);
    attachVanToEventMock.mockResolvedValue({ id: "assoc-1" });

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ vanId: "van-1" }),
    });

    const response = await attachVanRoute(request, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(attachVanToEventMock).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      eventId: "event-1",
      vanId: "van-1",
    }));
    expect(payload.association.id).toBe("assoc-1");
  });

  it("impede anexar van quando evento finalizado", async () => {
    const maybeSingleEvent = vi.fn().mockResolvedValue({ data: { id: "event-1", status: "finalizado" }, error: null });
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleEvent })) })),
      })),
    };
    createServiceRoleClientMock.mockReturnValue(mockClient);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ vanId: "van-1" }),
    });

    const response = await attachVanRoute(request, { params: Promise.resolve({ id: "event-1" }) });
    expect(response.status).toBe(422);
    expect(attachVanToEventMock).not.toHaveBeenCalled();
  });

  it("atualiza status da van dentro do evento", async () => {
    const mockClient = {};
    createServiceRoleClientMock.mockReturnValue(mockClient);
    updateEventVanStatusMock.mockResolvedValue({ id: "assoc-1", status: "fechada" });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "fechada" }),
    });

    const response = await updateEventVanRoute(request, {
      params: Promise.resolve({ id: "event-1", vanId: "van-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateEventVanStatusMock).toHaveBeenCalledWith(mockClient, {
      eventId: "event-1",
      vanId: "van-1",
      nextStatus: "fechada",
    });
    expect(payload.association.status).toBe("fechada");
  });

  it("valida status da van", async () => {
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalido" }),
    });

    const response = await updateEventVanRoute(request, {
      params: Promise.resolve({ id: "event-1", vanId: "van-1" }),
    });

    expect(response.status).toBe(422);
    expect(updateEventVanStatusMock).not.toHaveBeenCalled();
  });

  it("remove van associada a evento", async () => {
    const maybeSingleEvent = vi.fn().mockResolvedValue({ data: { status: "em_andamento" }, error: null });
    const mockClient = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: maybeSingleEvent })),
        })),
      })),
    };

    createServiceRoleClientMock.mockReturnValue(mockClient);
    detachVanFromEventMock.mockResolvedValue({ id: "assoc-1" });

    const response = await detachEventVanRoute(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: "event-1", vanId: "van-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toMatch(/desassociada/);
    expect(detachVanFromEventMock).toHaveBeenCalledWith(mockClient, {
      eventId: "event-1",
      vanId: "van-1",
    });
  });

  it("bloqueia remoção quando evento finalizado", async () => {
    const maybeSingleEvent = vi.fn().mockResolvedValue({ data: { status: "finalizado" }, error: null });
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: maybeSingleEvent })),
        })),
      })),
    };

    createServiceRoleClientMock.mockReturnValue(mockClient);

    const response = await detachEventVanRoute(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: "event-1", vanId: "van-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.message).toMatch(/finalizado/);
    expect(detachVanFromEventMock).not.toHaveBeenCalled();
  });
});
