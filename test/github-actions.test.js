import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('CI workflow runs tests, compose validation, and context validation', async () => {
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  const readme = await readFile('README.md', 'utf8');

  assert.match(ci, /name: CI/);
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:/);
  assert.match(ci, /actions\/checkout@v6/);
  assert.match(ci, /actions\/setup-node@v6/);
  assert.match(ci, /pnpm\/action-setup@v5/);
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.match(ci, /node --test/);
  assert.match(ci, /npm run monitor:production -- --help/);
  assert.match(ci, /npm run bot-ips:sync -- --help/);
  assert.match(ci, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(ci, /validate_context\.py --project-root \./);
  assert.match(readme, /GitHub Actions/);
  assert.match(readme, /ci\.yml/);
});

test('release smoke workflow runs postgres migration, smoke checks, and preflight manually', async () => {
  const workflow = await readFile('.github/workflows/release-smoke.yml', 'utf8');
  const deployment = await readFile('docs/DEPLOYMENT.md', 'utf8');

  assert.match(workflow, /name: Release Smoke/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /postgres:16-alpine/);
  assert.match(workflow, /pg_isready -U cloak -d cloak/);
  assert.match(workflow, /npm run migrate/);
  assert.match(workflow, /npm run smoke:postgres/);
  assert.match(workflow, /npm run smoke:postgres-api -- --check-health/);
  assert.match(workflow, /npm run smoke:postgres-admin -- --check-health/);
  assert.match(workflow, /npm run preflight:postgres/);
  assert.match(workflow, /DATABASE_URL: postgres:\/\/cloak:cloak_ci_password@127\.0\.0\.1:5432\/cloak/);
  assert.match(workflow, /ADMIN_TOKEN: cloak-ci-admin-token/);
  assert.match(deployment, /release-smoke\.yml/);
});
