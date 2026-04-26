# Production Deployment

This guide runs Cloak as a Node.js app backed by PostgreSQL. It uses the existing production path: `REPOSITORY_DRIVER=postgres`, migrations, smoke checks, and the static `/admin` console.

## Prerequisites

- Docker with Docker Compose v2.
- A private server or deployment host where only the Cloak app port is exposed publicly.
- A strong `ADMIN_TOKEN`.
- A PostgreSQL password that is not reused anywhere else.

## 1. Create Production Env

Create an uncommitted `.env.production` file:

```bash
APP_PORT=3000
POSTGRES_DB=cloak
POSTGRES_USER=cloak
POSTGRES_PASSWORD=replace-with-a-long-random-password
ADMIN_TOKEN=replace-with-a-long-random-admin-token
MIN_CONFIDENCE=60
BOT_CONFIDENCE=80
BOT_IPS=66.249.66.1,66.249.66.2
```

`BOT_IPS` is a comma-separated list. Any request from one of those IPs is treated as bot-like by the default IP detector. Known crawler User-Agents, such as `Googlebot`, are also detected by the UA detector.

## 2. Start PostgreSQL

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
```

The production Compose file does not publish `5432` to the host. The app reaches PostgreSQL through the internal Compose network at `postgres:5432`.

## 3. Run Migrations

Run migrations from a one-off app container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate
```

Check migration status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate:status
```

Preview pending migrations without applying SQL:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate:dry-run
```

## 4. Run Smoke Checks

Run the readonly PostgreSQL smoke check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres
```

Run API smoke with health probing:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-api -- --check-health
```

Run Admin smoke with health probing:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-admin -- --check-health
```

The API smoke creates a temporary Campaign, visits `/c/:campaignId`, checks logs and analytics, then deletes the temporary logs and Campaign unless `--keep-campaign` is provided.

## 5. Start the App

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

Check health:

```bash
curl http://127.0.0.1:3000/health
```

Open the management console:

```text
http://127.0.0.1:3000/admin
```

Use the `ADMIN_TOKEN` from `.env.production` when the console asks for a token.

## 6. Reverse Proxy Notes

- Expose only the app port to the internet.
- Keep PostgreSQL private.
- Put TLS, domain routing, and request logging in your reverse proxy or hosting platform.
- Public ad traffic should hit `/c/:campaignId`.
- Management traffic should hit `/admin` and `/api/v1/*` with `Authorization: Bearer <ADMIN_TOKEN>`.

## 7. Update Flow

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-api -- --check-health
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

If a smoke check fails, leave the old running app in place, inspect the error output, and do not continue the rollout.
