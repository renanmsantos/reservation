# Task 02 – Passenger Join Flow (DONE)

## Objective
Implement the end-to-end path for a passenger to claim a seat or join the waitlist, from form submission to persistence and UI refresh, enforcing that each full name holds only one active reservation system-wide.

## Deliverables
- React form with full-name (required) and optional email fields, validating min length and duplicate entries with clear messaging.
- API route `POST /api/reservations` that creates a record, assigns next available position per `van_id`, and returns queue metadata while blocking submissions when the same name already has an active seat or waitlist spot.
- Server-side guard preventing a user from occupying multiple active seats across vans; return actionable error states with guidance to release existing reservation.
- UI list rendering confirmed seats and waitlist with real-time position numbers and indicator when a name is already registered.
- Supabase trigger or RPC ensuring waitlist promotion happens in consistent order when inserting, handling conflict errors gracefully.

## Acceptance Criteria
- Successful form submission updates the visible queue without manual refresh (Supabase Realtime or SWR revalidation).
- Duplicate-name attempt surfaces inline error, no new record inserted, and existing reservation highlighted.
- `reservations` table entries verified via Supabase dashboard for at least two vans, confirming single active record per name.
- Jest component test covering happy path, duplicate name rejection, and API error fallback.
- Postman/Thunder client collection or curl snippet documented in `docs/` for QA, including duplicate-name scenario.
