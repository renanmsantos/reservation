# Van Reservation Queue

Van reservation queue MVP built with Next.js App Router, Tailwind CSS, and Supabase. Riders join a first-come, first-served list, keep one active seat per full name, and organizers can monitor capacity across vans.

## Prerequisites
- Node.js 20+
- npm 10+
- Supabase project (free tier is sufficient)
- Vercel account for deployment (optional during local development)

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in real values:
   ```bash
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from Supabase project settings.
   - `SUPABASE_SERVICE_ROLE_KEY` is used for privileged operations (keep it server-side only).
   - `MAX_SEATS` governs default van capacity; exposing `NEXT_PUBLIC_MAX_SEATS` keeps UI hints in sync.
3. Run the local dev server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) to view the skeleton UI.

## Available Scripts
- `npm run dev` – start the Next.js dev server with Turbopack
- `npm run db:apply` – apply `supabase/schema.sql` to the configured Supabase instance using `SUPABASE_DB_URL`.
- `npm run build` – generate an optimized production build.
- `npm start` – run the compiled build locally.
- `npm run lint` – lint the project with ESLint + Prettier settings.
- `npm test` – execute the Vitest test suite.
- `npm run format` / `npm run format:check` – apply or verify Prettier formatting.

## Supabase Setup
1. Enable the `pgcrypto` extension and run `supabase/schema.sql` to create tables, partial unique index, and waitlist trigger.
2. Create a service role JWT within the Supabase dashboard for server-side operations.
3. Configure Row Level Security policies to match your authentication model (samples included in the SQL file).
4. Hit `GET /api/health` locally or in Vercel to confirm Supabase environment variables are detected (returns 200 when configured).

## Architecture Snapshot
- `src/app/` – App Router entry point and route components.
- `src/components/` – Reusable UI primitives used by pages.
- `src/lib/supabase.ts` – Supabase client factories for browser and privileged contexts.
- `supabase/` – SQL migration bootstrap (tables, indexes, triggers, policies).
- `tasks/` – Work breakdown files driving implementation steps.

## Single-Reservation Rule
- The UI communicates the one-seat-per-name policy to riders.
- `supabase/schema.sql` adds a partial unique index enforcing only one active reservation or waitlist entry per full name.
- Future API routes will surface actionable errors and point users to release their current seat before rejoining.

## Deployment Notes
- Deploy to Vercel using the default Next.js build output; set environment variables in the Vercel dashboard.
- Supabase Realtime and Postgres operate comfortably on the free tier for early usage (<10,000 monthly active riders).
- Plan to add production logging and analytics hooks as described in `tasks/05-observability-analytics.md`.

## CI/CD
- GitHub Actions workflow at `.github/workflows/ci-cd.yml` runs linting, type-checks, unit tests, and an optional Supabase schema dry run on every pull request and push to `main`.
- Configure the following repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and (optionally) `SUPABASE_DB_URL` for the schema dry run.
- Preview deployments are published to Vercel for pull requests; pushes to `main` trigger production deploys after checks succeed.
- Use `npm run db:apply -- --dry-run` locally or in CI to validate the SQL migration without committing changes to the database.
- Manual redeploys: run `vercel pull`, `vercel build`, and `vercel deploy --prebuilt --prod` with the same environment variables when you need to promote a hotfix outside of CI—the workflow mirrors these commands.
- Local smoke tests: install [`act`](https://github.com/nektos/act) and run `act pull_request -j checks --workflows .github/workflows/ci-cd.yml --env-file .env.ci` (create `.env.ci` exporting the secrets listed above).

## API & QA Notes
- `POST /api/reservations` creates a new reservation or waitlist entry and returns the refreshed queue payload. Duplicate active names respond with HTTP 409 and the existing reservation metadata.
- `GET /api/reservations` returns the current van roster segmented into confirmed passengers and waitlist.
- `DELETE /api/reservations/{id}` cancels an active reservation, frees the seat, and returns the updated queue after waitlist promotion.
- Sample HTTP requests for manual QA (including duplicate check) live in `docs/reservations.http`.

## Admin Dashboard
- Access `/admin` (and the `/api/admin/*` endpoints) via HTTP basic auth using `ADMIN_USERNAME` / `ADMIN_PASSWORD` defined in `.env.local`.
- From the dashboard you can adjust van capacity, review active/waitlisted riders, approve duplicate-name overrides (with optional expiry windows), export CSV rosters, and inspect the audit log.
- Capacity updates, overrides, and reservation lifecycle events emit records to the `reservation_events` table for historical review.
- To validate access control, open `/admin` in an incognito window without credentials—expect `401` with a basic-auth challenge. Provide the configured username/password to continue.

## Observability & Reporting
- Optional Plausible analytics: set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` and redeploy to enable event tracking for joins, duplicate rejections, and releases (`src/lib/analytics.ts`).
- Supabase Edge Function `daily-summary` aggregates utilization stats and posts them to `ANALYTICS_WEBHOOK_URL`; schedule via `supabase/schedules/daily-summary.sql` and configure secrets in the Supabase dashboard.
- Local dry run: `npm run report:daily` (set `SUMMARY_SIMULATE_FAILURE=true` to test the failure alert path).
- Healthchecks.io monitoring: success pings use `HEALTHCHECKS_PING_URL`, failure pings use `HEALTHCHECKS_PING_URL_FAILED`—both wired into the edge function and local runner.
- Detailed setup steps and webhook payload samples live in `docs/observability.md`.

## Roadmap & Retrospective
- Prioritized backlog items: `docs/roadmap.md`.
- MVP lessons learned and follow-ups: `docs/retrospective.md` (reviewed in team stand-up).
