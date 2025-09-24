"use client";

import { FormEvent, useState } from "react";

import { trackEvent } from "@/lib/analytics";

import type { JoinQueueResult } from "@/hooks/use-reservation-queue";

const DEFAULT_MAX_SEATS = Number(process.env.NEXT_PUBLIC_MAX_SEATS ?? 15);

type MessageState = {
  tone: "success" | "error";
  text: string;
};

type JoinQueueFormProps = {
  onJoin: (payload: { fullName: string; email?: string }) => Promise<JoinQueueResult>;
  isSubmitting: boolean;
};

export const JoinQueueForm = ({ onJoin, isSubmitting }: JoinQueueFormProps) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setMessage({ tone: "error", text: "Please provide your full name to reserve a seat." });
      return;
    }

    const result = await onJoin({ fullName: normalizedName, email: email.trim() || undefined });

    if (result.ok) {
      trackEvent("reservation_joined", {
        status: result.status ?? "unknown",
        duplicate_override: result.code === "override_applied",
      });
      setMessage({ tone: "success", text: result.message });
      setFullName("");
      setEmail("");
      return;
    }

    if (result.code === "duplicate_name") {
      trackEvent("reservation_duplicate_blocked", {
        full_name: normalizedName,
      });
    } else {
      trackEvent("reservation_join_error", {
        code: result.code ?? "unknown",
      });
    }

    setMessage({ tone: "error", text: result.message });
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Join the Next Van</h2>
        <p className="text-sm text-slate-500">
          Seats are allocated first-come, first-served up to {DEFAULT_MAX_SEATS} passengers. Each full name can
          hold only one active reservation across all vans.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            id="fullName"
            name="fullName"
            placeholder="Alex Johnson"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email (optional)
          </label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            id="email"
            name="email"
            placeholder="alex@email.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Submitting…" : "Reserve my seat"}
        </button>
      </form>

      <div className="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
        <p>Reservation basics:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>One seat per full name at a time—release your spot to rejoin later.</li>
          <li>Waitlisted riders promote automatically when a seat opens.</li>
          <li>Admins can approve legitimate duplicate names in special cases.</li>
        </ul>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.tone === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
};

export default JoinQueueForm;
