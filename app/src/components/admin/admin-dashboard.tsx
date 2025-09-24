"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { QueueSection, type QueueReservation } from "@/components/queue-section";

type VanSummary = {
  id: string;
  name: string;
  capacity: number;
  departure_timestamp: string | null;
  confirmedCount: number;
  waitlistedCount: number;
};

type OverrideRecord = {
  id: string;
  full_name: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
};

type ReservationRecord = QueueReservation & {
  email: string | null;
  joinedAt: string;
  releasedAt: string | null;
};

type AdminReservationApiRecord = {
  id: string;
  fullName: string;
  position: number;
  status: "confirmed" | "waitlisted" | "cancelled";
  email: string | null;
  joinedAt: string;
  releasedAt: string | null;
};

type AuditEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type StatusFilter = "all" | "confirmed" | "waitlisted";

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const DEFAULT_EVENT_LIMIT = 50;

const AdminDashboard = () => {
  const [vans, setVans] = useState<VanSummary[]>([]);
  const [selectedVanId, setSelectedVanId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [capacityDraft, setCapacityDraft] = useState<number | null>(null);
  const [overrideForm, setOverrideForm] = useState({ fullName: "", reason: "", durationHours: "" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedVan = useMemo(() => vans.find((van) => van.id === selectedVanId) ?? null, [selectedVanId, vans]);

  const loadVans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/vans", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to load vans");
      }
      setVans(payload.vans);
      if (!selectedVanId && payload.vans.length > 0) {
        setSelectedVanId(payload.vans[0].id);
        setCapacityDraft(payload.vans[0].capacity);
      }
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : "Failed to load vans.");
    } finally {
      setLoading(false);
    }
  }, [selectedVanId]);

  const loadOverrides = useCallback(async () => {
    const response = await fetch("/api/admin/overrides", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setOverrides(payload.overrides);
    }
  }, []);

  const loadReservations = useCallback(async (vanId: string, status: StatusFilter = "all") => {
    const url = new URL("/api/admin/reservations", window.location.origin);
    url.searchParams.set("vanId", vanId);
    if (status !== "all") {
      url.searchParams.set("status", status);
    }

    const response = await fetch(url.toString(), { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      const activeReservations = (payload.reservations as AdminReservationApiRecord[]).filter((item) =>
        item.status === "confirmed" || item.status === "waitlisted",
      );

      setReservations(
        activeReservations.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          position: item.position,
          status: item.status === "confirmed" ? "confirmed" : "waitlisted",
          email: item.email,
          joinedAt: item.joinedAt,
          releasedAt: item.releasedAt ?? null,
        })),
      );
    }
  }, []);

  const loadEvents = useCallback(async () => {
    const response = await fetch(`/api/admin/events?limit=${DEFAULT_EVENT_LIMIT}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setEvents(payload.events);
    }
  }, []);

  useEffect(() => {
    loadVans();
    loadOverrides();
    loadEvents();
  }, [loadEvents, loadOverrides, loadVans]);

  useEffect(() => {
    if (selectedVanId) {
      loadReservations(selectedVanId, statusFilter);
      const van = vans.find((item) => item.id === selectedVanId);
      if (van) {
        setCapacityDraft(van.capacity);
      }
    }
  }, [selectedVanId, statusFilter, vans, loadReservations]);

  const handleCapacitySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVanId || capacityDraft === null) {
      return;
    }

    const response = await fetch(`/api/admin/vans/${selectedVanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ capacity: capacityDraft }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.message ?? "Failed to update capacity.");
      return;
    }

    setFeedback("Capacity updated successfully.");
    await Promise.all([loadVans(), loadReservations(selectedVanId, statusFilter)]);
  };

  const handleOverrideSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const durationHours = overrideForm.durationHours ? Number(overrideForm.durationHours) : null;

    const response = await fetch("/api/admin/overrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: overrideForm.fullName,
        reason: overrideForm.reason || undefined,
        durationHours,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.message ?? "Failed to save override.");
      return;
    }

    setFeedback("Override saved.");
    setOverrideForm({ fullName: "", reason: "", durationHours: "" });
    await loadOverrides();
  };

  const handleOverrideDelete = async (overrideId: string) => {
    if (!window.confirm("Remove this override?")) {
      return;
    }

    const response = await fetch(`/api/admin/overrides/${overrideId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      setFeedback(payload.message ?? "Failed to remove override.");
      return;
    }

    setFeedback("Override removed.");
    await loadOverrides();
  };

  const handleExport = async () => {
    if (!selectedVanId) {
      return;
    }

    const response = await fetch(`/api/admin/reservations/export?vanId=${selectedVanId}`);
    if (!response.ok) {
      const payload = await response.json();
      setFeedback(payload.message ?? "Failed to export reservations.");
      return;
    }

    const blob = await response.blob();
    downloadBlob(blob, `van-${selectedVanId}-roster.csv`);
    setFeedback("CSV exported.");
  };

  const confirmed = reservations.filter((reservation) => reservation.status === "confirmed");
  const waitlisted = reservations.filter((reservation) => reservation.status === "waitlisted");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Admin Controls</h1>
        <p className="text-sm text-slate-600">Monitor van capacity, manage overrides, and audit reservation activity.</p>
      </header>

      {feedback && <p className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700">{feedback}</p>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-slate-700" htmlFor="vanSelect">
            Active van
          </label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="vanSelect"
            value={selectedVanId ?? ""}
            onChange={(event) => setSelectedVanId(event.target.value || null)}
          >
            {vans.map((van) => (
              <option key={van.id} value={van.id}>
                {van.name} – capacity {van.capacity} (confirmed: {van.confirmedCount}, waitlist: {van.waitlistedCount})
              </option>
            ))}
          </select>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={loadVans}
            type="button"
          >
            Refresh vans
          </button>
        </div>

        {selectedVan && (
          <form className="flex flex-wrap items-center gap-3" onSubmit={handleCapacitySubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="capacityInput">
                Capacity for {selectedVan.name}
              </label>
              <input
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                id="capacityInput"
                min={1}
                max={64}
                type="number"
                value={capacityDraft ?? ""}
                onChange={(event) => setCapacityDraft(event.target.value ? Number(event.target.value) : null)}
              />
            </div>
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              type="submit"
            >
              Update capacity
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Duplicate name overrides</h2>
            <p className="text-sm text-slate-600">Approve legitimate cases where riders share the same name.</p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={loadOverrides}
            type="button"
          >
            Refresh
          </button>
        </header>

        <form className="flex flex-wrap gap-3" onSubmit={handleOverrideSubmit}>
          <input
            className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Full name"
            value={overrideForm.fullName}
            onChange={(event) => setOverrideForm((prev) => ({ ...prev, fullName: event.target.value }))}
          />
          <input
            className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reason (optional)"
            value={overrideForm.reason}
            onChange={(event) => setOverrideForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
          <input
            className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Duration hours"
            type="number"
            value={overrideForm.durationHours}
            onChange={(event) => setOverrideForm((prev) => ({ ...prev, durationHours: event.target.value }))}
          />
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            type="submit"
          >
            Save override
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Full name</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Reason</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Expires</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overrides.map((override) => (
                <tr key={override.id}>
                  <td className="px-4 py-2 text-slate-800">{override.full_name}</td>
                  <td className="px-4 py-2 text-slate-600">{override.reason ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(override.expires_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:bg-rose-50"
                      onClick={() => handleOverrideDelete(override.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-center text-slate-500" colSpan={4}>
                    No overrides configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reservations</h2>
            <p className="text-sm text-slate-600">Filter by status and export rosters for operational use.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="waitlisted">Waitlisted</option>
            </select>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => selectedVanId && loadReservations(selectedVanId, statusFilter)}
              type="button"
            >
              Refresh list
            </button>
            <button
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              onClick={handleExport}
              type="button"
            >
              Export CSV
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <QueueSection
            emptyState="No confirmed passengers."
            highlightedName={null}
            items={confirmed}
            title="Confirmed"
          />
          <QueueSection
            emptyState="Waitlist is empty."
            highlightedName={null}
            items={waitlisted}
            title="Waitlist"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Joined</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Released</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td className="px-4 py-2 text-slate-800">{reservation.fullName}</td>
                  <td className="px-4 py-2 text-slate-600">{reservation.email ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600 capitalize">{reservation.status}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(reservation.joinedAt)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(reservation.releasedAt)}</td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-center text-slate-500" colSpan={5}>
                    No reservations found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Audit log</h2>
            <p className="text-sm text-slate-600">Recent reservation activity including joins, releases, and overrides.</p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={loadEvents}
            type="button"
          >
            Refresh log
          </button>
        </header>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Timestamp</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Event</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-2 text-slate-600">{formatDate(event.created_at)}</td>
                  <td className="px-4 py-2 text-slate-800">{event.event_type}</td>
                  <td className="px-4 py-2 text-slate-600">
                    <pre className="whitespace-pre-wrap text-xs text-slate-500">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-center text-slate-500" colSpan={3}>
                    No events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
    </div>
  );
};

export default AdminDashboard;
