# Observability & Reporting

## Analytics (Plausible)
- Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to the deployed domain in `.env.local`, then redeploy so `/admin` and the public app load the Plausible script (`src/app/layout.tsx`).
- Custom client events:
  - `reservation_joined` with reservation status and whether an override was used (`src/components/join-queue-form.tsx`).
  - `reservation_duplicate_blocked` whenever a duplicate attempt is rejected client-side.
  - `reservation_released` / `reservation_release_error` when seats are released from the dashboard (`src/components/reservation-dashboard.tsx`).
- In Plausible, create goals for the above event names to monitor conversion and duplicate rejection trends.

## Daily Utilization Summary
- Supabase Edge Function: `supabase/functions/daily-summary/index.ts` aggregates totals, 24h deltas, duplicate blocks, and override usage.
- Schedule the function via `supabase/schedules/daily-summary.sql`:
  ```sql
  insert into supabase_functions.schedules (name, cron, function_name)
  values ('daily-utilization-summary', '0 10 * * *', 'daily-summary')
  on conflict (name) do update set cron = excluded.cron, enabled = true;
  ```
- Environment variables used by the function (configure in Supabase project settings):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ANALYTICS_WEBHOOK_URL` (optional Google Apps Script or other webhook target)
  - `HEALTHCHECKS_PING_URL`, `HEALTHCHECKS_PING_URL_FAILED`
- Local runner: `npm run report:daily` executes the same aggregation and posts to the webhook. Pass `SUMMARY_SIMULATE_FAILURE=true` to exercise the failure path and ensure alerts fire.

## Alerting
- Configure a free [Healthchecks.io](https://healthchecks.io) endpoint and assign the success/failure URLs to `HEALTHCHECKS_PING_URL` / `HEALTHCHECKS_PING_URL_FAILED`.
- Trigger/test: `SUMMARY_SIMULATE_FAILURE=true npm run report:daily` or call the edge function with `?simulate=fail`. Confirm Healthchecks sends a failure notification, then rerun without the flag to clear the alert.

## Metrics Access for Organizers
- The webhook payload posted to Google Sheets contains:
  ```json
  {
    "generated_at": "2024-01-24T10:00:00.000Z",
    "totals": {
      "confirmed": 12,
      "waitlisted": 3,
      "cancelled": 5,
      "overrides_active": 1
    },
    "last_24h": {
      "reservations_created": 6,
      "duplicate_blocked": 2,
      "overrides_added": 1
    }
  }
  ```
- Pair this sheet with Plausible dashboards to provide both real-time and daily summaries to organizers.

## Test Log
- 2024-01-24: Ran `SUMMARY_SIMULATE_FAILURE=true npm run report:daily`; Healthchecks.io recorded the failure ping and alert email was received. Follow-up run without the flag cleared the alert.
