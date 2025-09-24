# Van Reservation Queue PRD

## Product Summary
Create a lightweight web app that lets riders reserve seats on scheduled vans. Riders join a first-come, first-served queue, see their position, and release the seat when they cancel. Admins configure van capacity and monitor demand across fully booked trips. Each rider may hold at most one active reservation under the same full name across all vans at a time.

## Goals & Success Metrics
- Fill vans efficiently: >90% average seat utilization per trip.
- Reduce manual coordination time for organizers by 75% in month one.
- Ensure <2 min average time for users to register, confirm, or cancel their seat.
- Maintain uptime >99% during operating hours.

## Target Users & Jobs-To-Be-Done
- **Passengers**: secure a confirmed seat quickly, check their position, free their seat when plans change.
- **Organizers**: configure van capacity, view passenger list, track overflow demand beyond the first van, and prevent duplicate bookings.

## User Stories & Flows
1. As a passenger, I enter my full name, select a van departure, and claim the next available seat; if the van is full, I enter the waitlist for the next van.
2. As a passenger, I revisit the page to release my seat and automatically notify the next person in line, freeing my name to book again later.
3. As an organizer, I adjust the van capacity (default 15) without redeploying code and export the roster, with optional overrides for legitimate duplicate names.

## Functional Requirements
- Simple responsive UI with clear seat count indicators and list ordering.
- Enforce at most one active reservation or waitlist spot per full name across all vans unless an admin override is granted.
- Waitlist automatically promotes the next passenger when a seat is freed.
- Allow configuration of van capacity via environment variable or admin control.
- Support multiple concurrent vans/departures.

## Non-Functional Requirements
- Deploy on a low-cost platform (Vercel + Supabase free tier) with <=500ms median API latency.
- Data retention is minimal (store name, timestamp, optional contact email).
- Audit log of join/leave events (including rejected duplicate attempts) for 30 days.

## Technical Approach
- Frontend: Next.js with Tailwind CSS for rapid UI, form validation with React Hook Form enforcing unique name rule feedback.
- Backend: Serverless API routes persisting to Supabase Postgres with unique composite constraint on `full_name` and active status; use row-level security to prevent unauthorized writes.
- Real-time updates via Supabase Realtime subscription and transactional waitlist promotion logic.

## Release Plan & Timeline
- **Day 0**: Finalize UI mockups, set up repo scaffolding, connect Supabase, define unique-reservation constraint.
- **Day 1**: Implement join queue flow, waitlist promotion logic, release seat flow, and duplicate-name enforcement. Ship MVP.
- **Post-launch**: Add basic admin view, analytics dashboard, and controlled overrides for legitimate duplicate identities.

