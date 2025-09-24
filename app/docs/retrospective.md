# MVP Retrospective – Duplicate Enforcement

## Wins
- **Single-reservation guarantee held up** under live rider traffic; partial unique index plus trigger prevented double booking.
- **Override workflow** let admins handle legitimate edge-cases (family members, typos) quickly.
- **Daily summary + Plausible events** surfaced duplicate attempts in real time, guiding copy changes on the join form.

## Challenges & Lessons
- Riders often retry with slightly altered names (initials, nickname); messaging and inline guidance reduced support tickets.
- Manual override approval needs better audit tooling—adding reason field helped but filtered views are still required (tracked in roadmap).
- Healthcheck coverage initially missed the Supabase trigger; integrating the daily summary job with Healthchecks ensures future regressions are caught.

## Follow-ups
- Implement automated notification when a duplicate attempt is blocked more than twice for the same email.
- Ship rider self-service release flow so admins are not the bottleneck during peak hours.
- Schedule a guardrail test during the next load test to validate override expiry behaviour.

_Reviewed in stand-up on 2024-01-24; action items added to `docs/roadmap.md`._
