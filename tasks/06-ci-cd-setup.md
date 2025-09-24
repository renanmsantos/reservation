# Task 06 – CI/CD Pipeline Automation

## Objective
Establish continuous integration and delivery using GitHub Actions so every push validates the Next.js app, applies migrations safely, and publishes preview deployments to Vercel.

## Deliverables
- Workflow file in `.github/workflows/` executing lint, test, and type-check steps on pull requests and default branch pushes.
- Reusable job or composite action configuring Node.js cache, installing dependencies, and exposing results via job summaries.
- Secret-managed Vercel deployment step that creates preview builds on pull requests and promotes the default branch automatically when checks succeed.
- Documentation in `webapp/README.md` explaining required GitHub secrets and how to trigger manual redeploys.
- Fallback plan for Supabase migrations in CI (dry-run verification or guarded `npm run db:apply`).

## Acceptance Criteria
- GitHub Actions runs succeed for lint, test, and type checks before deployment occurs, blocking merges on failure.
- Preview deployment URLs appear in pull request comments or summaries, sourced from the workflow output.
- Default branch pushes update the Vercel production deployment only after all checks pass.
- Secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, database URI if needed) are documented and referenced via `secrets.*` in the workflow—no plaintext values committed.
- Workflow supports local smoke testing by allowing `act` or similar runner with documented environment variable overrides.
