# Task 01 – Project & Infrastructure Setup (DONE)

## Objective
Establish the initial Next.js codebase, connect Supabase, and deliver a clickable UI skeleton that mirrors the reservation flow while enforcing the single-reservation-per-name rule.

## Deliverables
- New Next.js app scaffolded with TypeScript, Tailwind, ESLint, and Prettier configured.
- `.env.local.example` documenting Supabase URL/key, `MAX_SEATS`, and analytics toggles.
- Supabase project set up with `reservations` table (id, van_id, full_name, email, status, position, timestamps) plus unique index preventing multiple active records with the same `full_name`.
- Initial RLS policy for authenticated inserts/updates and database constraint or trigger reserving one active seat per name.
- Basic page layout showing sections for seat list, waitlist, and join form (static data placeholder) including inline copy about the one-seat-per-name policy.
- Continuous deployment pipeline targeting Vercel preview branch.

## Acceptance Criteria
- `npm run dev`, `npm run lint`, and `npm test` succeed locally.
- Environment variables pulled from `.env.local` without storing secrets in Git.
- Supabase connection test (simple API route) returns `200` with placeholder payload and validates duplicate-name rejection.
- UI skeleton responsive on mobile and desktop breakpoints via responsive devtools inspection.
- Documentation update in `README` covering setup steps, Supabase login, and explanation of the name uniqueness rule.
