# Task 03 – Seat Release & Waitlist Promotion (DONE)

## Objective
Allow passengers to relinquish their seat and automatically advance the next participant in line, keeping the UI and data consistent while unlocking the ability for that name to book again.

## Deliverables
- UI affordance (button/link) per reservation to release a seat after confirmation dialog and reminder that rebooking requires releasing first.
- API route `DELETE /api/reservations/{id}` that transitions the record to `cancelled`, clears name-level locks, and triggers waitlist promotion.
- Database function or trigger that updates positions for remaining riders, activates the next waitlisted passenger, and ensures there are zero active records per name post-transaction.
- Real-time updates pushing the new queue state to all connected clients.
- Unit/integration tests for promotion logic (happy path + edge cases: last seat, empty waitlist, simultaneous release/join with same name).

## Acceptance Criteria
- Releasing a seat removes it from the active list and promotes the first waitlisted rider within 1 second.
- No duplicate active seats after concurrent release/join scenarios (confirmed via Supabase logs or tests), and the releasing name can immediately rejoin.
- Toast/alert communicates success or failure to the releasing passenger.
- API returns standardized JSON schema for success and error responses, including flag when a name remains blocked due to race conditions.
- Documentation snippet describing rollback strategy if promotion trigger fails and how name uniqueness is maintained.
