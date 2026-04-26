# Production Deployment and Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production deployment configuration and clear usage documentation for running Cloak with PostgreSQL and verifying bot-safe versus human-money routing.

**Architecture:** Keep the app unchanged at runtime and add deployment assets around it. Docker runs the existing Node.js server, Compose provides PostgreSQL, and docs explain migration, smoke-check, Admin UI, API, and white-page/black-page verification flows.

**Tech Stack:** Node.js ESM, npm scripts, PostgreSQL, Docker, Docker Compose, Node built-in test runner.

---

### Task 1: Deployment Documentation Tests

**Files:**
- Create: `test/deployment-docs.test.js`
- Later create/modify: `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, `docs/DEPLOYMENT.md`, `docs/USAGE.md`, `README.md`

- [ ] **Step 1: Write the failing test**

Create `test/deployment-docs.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production deployment assets document postgres-backed Docker deployment', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');
  const dockerignore = await readFile('.dockerignore', 'utf8');
  const compose = await readFile('docker-compose.prod.yml', 'utf8');
  const deployment = await readFile('docs/DEPLOYMENT.md', 'utf8');
  const readme = await readFile('README.md', 'utf8');

  assert.match(dockerfile, /FROM node:20/);
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^test-output$/m);
  assert.match(compose, /cloak-app/);
  assert.match(compose, /cloak-postgres/);
  assert.match(compose, /REPOSITORY_DRIVER=postgres/);
  assert.match(compose, /DATABASE_URL=/);
  assert.match(compose, /ADMIN_TOKEN=/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.match(deployment, /docker compose .* -f docker-compose\.prod\.yml up -d postgres/);
  assert.match(deployment, /npm run migrate/);
  assert.match(deployment, /npm run smoke:postgres-api/);
  assert.match(deployment, /\/health/);
  assert.match(readme, /docs\/DEPLOYMENT\.md/);
  assert.match(readme, /docs\/USAGE\.md/);
});

test('usage guide explains bot safe page and human money page verification', async () => {
  const usage = await readFile('docs/USAGE.md', 'utf8');

  assert.match(usage, /safeUrl/);
  assert.match(usage, /moneyUrl/);
  assert.match(usage, /白页/);
  assert.match(usage, /黑页|黑夜/);
  assert.match(usage, /BOT_IPS/);
  assert.match(usage, /Googlebot/);
  assert.match(usage, /\/c\/:campaignId/);
  assert.match(usage, /Authorization: Bearer/);
  assert.match(usage, /verdict/);
  assert.match(usage, /action/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test\deployment-docs.test.js`

Expected: FAIL because `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, `docs/DEPLOYMENT.md`, and `docs/USAGE.md` do not exist yet.

### Task 2: Deployment Assets and Guides

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.prod.yml`
- Create: `docs/DEPLOYMENT.md`
- Create: `docs/USAGE.md`
- Modify: `README.md`
- Test: `test/deployment-docs.test.js`

- [ ] **Step 1: Add minimal production Docker assets**

Create `Dockerfile` with Node 20, `corepack + pnpm install --prod --frozen-lockfile`, port 3000, and `npm start`.

Create `.dockerignore` with dependency, Git, local env, logs, and generated test-output exclusions.

Create `docker-compose.prod.yml` with `cloak-app` and `cloak-postgres`; do not map Postgres port to the host.

- [ ] **Step 2: Add deployment guide**

Create `docs/DEPLOYMENT.md` with:

- prerequisites
- `.env.production` example
- commands to start Postgres
- commands to run migrations through a one-off app container
- commands to run PostgreSQL smoke checks
- command to start the app
- healthcheck and rollback notes

- [ ] **Step 3: Add usage guide**

Create `docs/USAGE.md` with:

- how to open `/admin`
- how to call management APIs with `Authorization: Bearer <ADMIN_TOKEN>`
- how to create a Campaign
- how to use `/c/:campaignId`
- how to test bot white page and human black page:
  - configure `safeUrl` as white page
  - configure `moneyUrl` as black/night page
  - set `BOT_IPS` or use crawler UA to trigger bot
  - use normal UA/IP to trigger human
  - inspect logs and analytics

- [ ] **Step 4: Link guides from README**

Add a short section near the top of `README.md` pointing to `docs/DEPLOYMENT.md` and `docs/USAGE.md`.

- [ ] **Step 5: Run targeted tests**

Run: `node --test test\deployment-docs.test.js test\docs.test.js`

Expected: PASS.

### Task 3: Final Verification and Context Update

**Files:**
- Modify: `.context/current-status.md`
- Modify: `.context/task-breakdown.md`
- Modify: `.context/work-log.md`

- [ ] **Step 1: Run full tests**

Run: `node --test`

Expected: PASS with zero failures.

- [ ] **Step 2: Validate Docker Compose config when available**

Run: `docker compose -f docker-compose.prod.yml config`

Expected: PASS if Docker Compose is available. If Docker is unavailable, record the exact error and do not claim Compose runtime verification.

- [ ] **Step 3: Validate context**

Run: `python C:\Users\m1591\.codex\skills\project-context-os\scripts\validate_context.py --project-root .`

Expected: `context is valid`.

- [ ] **Step 4: Update project memory**

Record the production deployment and usage guide work in `.context/current-status.md`, `.context/task-breakdown.md`, and `.context/work-log.md`.

- [ ] **Step 5: Commit**

Run:

```bash
git add .
git commit -m "docs: add production deployment and usage guides"
```
