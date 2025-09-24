# Task 04 – Admin Configuration & Roster Export

## Objective
Provide light admin tooling to adjust van capacity, monitor demand, manage duplicate-name overrides, and export rider lists without redeploying code.

## Deliverables
- Admin-only page protected via simple access gate (basic auth or Supabase auth group).
- Form to update `MAX_SEATS` per `van_id`, persisting to Supabase config table and reflected across clients.
- Controls to view and optionally approve legitimate duplicate-name overrides, writing to an allowlist table consumed by the API.
- Display of active and waitlisted passengers with filters for date/van.
- CSV export endpoint for van rosters, respecting cancelled status, timestamps, and uniqueness state.
- Audit log panel showing join/leave events and blocked duplicate attempts pulled from Supabase.

## Acceptance Criteria
- Capacity change propagates to rider UI in real time and enforces the new limit on joins.
- Duplicate-name override toggles apply immediately and are logged for auditing.
- CSV export matches Supabase data schema and downloads in <1s for 200 entries, noting whether entries used an override.
- Admin route inaccessible to non-authenticated users (verified via incognito session).
- Auditing view shows chronological events (join, release, duplicate blocked, override change) and retains 30 days of history.
- Unit test covering capacity update flow plus smoke test for CSV generation and override toggle.
