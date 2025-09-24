import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

const mockQueuePayload = {
  queue: {
    van: {
      id: "van-1",
      name: "Main Van",
      capacity: 15,
    },
    confirmed: [
      {
        id: "reservation-1",
        vanId: "van-1",
        fullName: "Jordan Carter",
        email: "jordan@example.com",
        status: "confirmed",
        position: 1,
        joinedAt: new Date().toISOString(),
      },
    ],
    waitlisted: [],
  },
};

describe("HomePage", () => {
  beforeEach(() => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => mockQueuePayload,
      });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the reservation headline and sections", async () => {
    render(<HomePage />);

    expect(
      await screen.findByRole("heading", { name: /reserve your spot for the next ride/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one active reservation per full name/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /confirmed passengers/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reserve my seat/i })).toBeInTheDocument();
  });

  it("releases a reservation and shows confirmation message", async () => {
    const releaseQueuePayload = {
      message: "Reservation released.",
      queue: {
        ...mockQueuePayload.queue,
        confirmed: [],
        waitlisted: [],
      },
      releasedReservation: {
        id: "reservation-1",
        van_id: "van-1",
        full_name: "Jordan Carter",
        email: "jordan@example.com",
        status: "cancelled",
        position: 1,
        joined_at: new Date().toISOString(),
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockQueuePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => releaseQueuePayload });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<HomePage />);

    const releaseButton = await screen.findByRole("button", { name: /release seat/i });
    await userEvent.click(releaseButton);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/reservations/reservation-1", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText(/reservation released/i)).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});
