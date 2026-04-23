import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('README documents startup, tests, env vars, and available API routes', async () => {
  const readme = await readFile('README.md', 'utf8');

  assert.match(readme, /npm start/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm run migrate/);
  assert.match(readme, /npm run migrate:status/);
  assert.match(readme, /npm run migrate:dry-run/);
  assert.match(readme, /npm run smoke:postgres/);
  assert.match(readme, /HOST/);
  assert.match(readme, /PORT/);
  assert.match(readme, /BOT_IPS/);
  assert.match(readme, /ADMIN_TOKEN/);
  assert.match(readme, /REPOSITORY_DRIVER/);
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /GET \/health/);
  assert.match(readme, /GET \/admin/);
  assert.match(readme, /GET \/c\/:campaignId/);
  assert.match(readme, /POST \/api\/v1\/campaigns/);
  assert.match(readme, /PUT \/api\/v1\/campaigns\/:id/);
  assert.match(readme, /DELETE \/api\/v1\/campaigns\/:id/);
  assert.match(readme, /GET \/api\/v1\/campaigns\/:id\/logs/);
  assert.match(readme, /GET \/api\/v1\/logs/);
  assert.match(readme, /GET \/api\/v1\/analytics\/overview/);
  assert.match(readme, /PostgresCampaignRepository/);
  assert.match(readme, /PostgresAccessLogRepository/);
  assert.match(readme, /pg/);
  assert.match(readme, /REPOSITORY_DRIVER=postgres/);
  assert.match(readme, /连接池|Pool/);
  assert.match(readme, /schema_migrations/);
  assert.match(readme, /pending/i);
  assert.match(readme, /smoke-check|联调/i);
  assert.match(readme, /--database-url/);
  assert.match(readme, /--dry-run/);
  assert.match(readme, /--help/);
  assert.match(readme, /readonly/i);
});

test('.env.example lists every runtime env var consumed by config', async () => {
  const envExample = await readFile('.env.example', 'utf8');

  for (const key of [
    'HOST=',
    'PORT=',
    'MIN_CONFIDENCE=',
    'BOT_CONFIDENCE=',
    'BOT_IPS=',
    'ADMIN_TOKEN=',
    'REPOSITORY_DRIVER=',
    'DATABASE_URL='
  ]) {
    assert.match(envExample, new RegExp(`^${key}`, 'm'));
  }
});
