import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import JoinQueueForm from "@/components/join-queue-form";
import { NotificationsProvider } from "@/components/ui/notifications-provider";

const resolveAfter = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0));

const Wrapper = ({ children }: { children: ReactNode }) => <NotificationsProvider>{children}</NotificationsProvider>;

describe("JoinQueueForm", () => {
  it("requires a full name before submitting", async () => {
    const onJoin = vi.fn();

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: /reservar/i }));

    expect(await screen.findByText(/informe seu nome completo/i)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("shows success message and clears the form on successful join", async () => {
    const onJoin = vi
      .fn()
      .mockImplementation(() => resolveAfter({ ok: true, message: "Vaga confirmada!", status: "confirmed" }));

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText(/nome completo/i), "Taylor Swift");
    await userEvent.click(screen.getByRole("button", { name: /reservar/i }));

    expect(onJoin).toHaveBeenCalledWith({ fullName: "Taylor Swift" });
    expect(await screen.findByText(/vaga confirmada!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toHaveValue("");
  });

  it("surfaces duplicate errors inline", async () => {
    const onJoin = vi.fn().mockImplementation(() =>
      resolveAfter({
        ok: false,
        message: "Este nome completo já possui uma reserva ativa.",
        code: "duplicate_name",
      }),
    );

    render(<JoinQueueForm isSubmitting={false} onJoin={onJoin} />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText(/nome completo/i), "Jordan Carter");
    await userEvent.click(screen.getByRole("button", { name: /reservar/i }));

    expect(onJoin).toHaveBeenCalledWith({ fullName: "Jordan Carter" });
    expect(
      await screen.findByText(/este nome completo já possui uma reserva ativa/i),
    ).toBeInTheDocument();
  });
});
