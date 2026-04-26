# Production Deployment and Usage Design

## Context

Phase 2/3 already provides the runtime pieces needed for a deployable Cloak system: Node HTTP server, PostgreSQL repository mode, migrations, API smoke checks, Admin smoke checks, and a static `/admin` console. The remaining gap is operational: a user needs a clear way to run the system in production-like mode and understand how to verify that bot traffic sees the safe page while human traffic sees the money page.

## Goals

- Provide a small production deployment package that works with the existing Node.js app and PostgreSQL runtime.
- Document a repeatable deployment flow: configure env, start PostgreSQL, run migrations, run smoke checks, start the app, and check health.
- Document everyday usage for the Cloak system: open Admin UI, set `ADMIN_TOKEN`, create Campaigns, use `/c/:campaignId`, inspect logs and analytics.
- Document a concrete white-page / black-page verification recipe:
  - `safeUrl` is the white page shown to bot/suspicious traffic.
  - `moneyUrl` is the black/night page shown to human traffic.
  - A configured `BOT_IPS` value or known crawler User-Agent can be used to trigger bot verdicts.
  - A normal User-Agent and non-bot IP can be used to trigger human verdicts.

## Non-Goals

- No React/Vite rebuild of the admin console.
- No Kubernetes, managed cloud-specific config, or CI/CD pipeline.
- No automatic TLS certificate management.
- No real Redis service integration; the current Redis Bot IP source remains an adapter shape.

## Approach

Use a conservative Docker-based deployment package:

- `Dockerfile` builds the existing Node.js ESM app with production dependencies only.
- `.dockerignore` keeps local artifacts, dependency folders, `.git`, and generated test output out of the image context.
- `docker-compose.prod.yml` defines two services:
  - `postgres`, reachable only on the Compose network.
  - `app`, configured with `REPOSITORY_DRIVER=postgres`, `DATABASE_URL`, `ADMIN_TOKEN`, and healthcheck.
- `docs/DEPLOYMENT.md` explains production setup and verification commands.
- `docs/USAGE.md` explains how to use Admin UI and API, including the bot-white/human-black verification flow.
- `README.md` links to the deployment and usage guides so the repo has one obvious entry point.

## Validation

- Add tests that assert the deployment files and usage docs exist and include critical production markers.
- Run the deployment doc tests before implementation to verify they fail for missing files/content.
- Run targeted tests after implementation.
- Run `node --test` for full regression.
- Run `docker compose -f docker-compose.prod.yml config` when Docker Compose is available; if Docker is unavailable, record that as an environmental limitation.
- Run `.context` validation before claiming the project context is healthy.

## Security Notes

- `ADMIN_TOKEN` must be replaced in production and treated as a secret.
- PostgreSQL should not expose a public host port in the production Compose file.
- Public traffic uses `/c/:campaignId`; management operations require `Authorization: Bearer <ADMIN_TOKEN>`.
- `DATABASE_URL` examples use placeholders in docs; real credentials belong in an uncommitted `.env.production` file or the deployment platform secret store.
