import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import JoinQueueForm from "@/components/join-queue-form";

const resolveAfter = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0));

describe("JoinQueueForm", () => {
  it("requires a full name before submitting", async () => {
    const onJoin = vi.fn();

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />);

    await userEvent.click(screen.getByRole("button", { name: /reserve my seat/i }));

    expect(await screen.findByText(/please provide your full name/i)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("shows success message and clears the form on successful join", async () => {
    const onJoin = vi
      .fn()
      .mockImplementation(() => resolveAfter({ ok: true, message: "Seat confirmed!", status: "confirmed" }));

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Taylor Swift");
    await userEvent.type(screen.getByLabelText(/email/i), "taylor@example.com");
    await userEvent.click(screen.getByRole("button", { name: /reserve my seat/i }));

    expect(onJoin).toHaveBeenCalledWith({ email: "taylor@example.com", fullName: "Taylor Swift" });
    expect(await screen.findByText(/seat confirmed!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });

  it("surfaces duplicate errors inline", async () => {
    const onJoin = vi.fn().mockImplementation(() =>
      resolveAfter({
        ok: false,
        message: "This full name already holds an active reservation.",
        code: "duplicate_name",
      }),
    );

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Jordan Carter");
    await userEvent.click(screen.getByRole("button", { name: /reserve my seat/i }));

    expect(onJoin).toHaveBeenCalledWith({ email: undefined, fullName: "Jordan Carter" });
    expect(
      await screen.findByText(/this full name already holds an active reservation/i),
    ).toBeInTheDocument();
  });
});
