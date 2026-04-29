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
  assert.match(readme, /npm run smoke:postgres-api/);
  assert.match(readme, /npm run smoke:postgres-admin/);
  assert.match(readme, /npm run preflight:postgres/);
  assert.match(readme, /npm run monitor:production/);
  assert.match(readme, /--check-analytics/);
  assert.match(readme, /--max-bot-percent/);
  assert.match(readme, /--max-suspicious-percent/);
  assert.match(readme, /npm run bot-ips:sync/);
  assert.match(readme, /HOST/);
  assert.match(readme, /PORT/);
  assert.match(readme, /BOT_IPS/);
  assert.match(readme, /BOT_IP_SOURCE/);
  assert.match(readme, /BOT_IP_FILE_PATH/);
  assert.match(readme, /ADMIN_TOKEN/);
  assert.match(readme, /REPOSITORY_DRIVER/);
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /LOG_FILE_PATH/);
  assert.match(readme, /LOG_MAX_BYTES/);
  assert.match(readme, /LOG_MAX_FILES/);
  assert.match(readme, /GET \/health/);
  assert.match(readme, /GET \/admin/);
  assert.match(readme, /GET \/c\/:campaignId/);
  assert.match(readme, /POST \/api\/v1\/campaigns/);
  assert.match(readme, /PUT \/api\/v1\/campaigns\/:id/);
  assert.match(readme, /DELETE \/api\/v1\/campaigns\/:id/);
  assert.match(readme, /GET \/api\/v1\/campaigns\/:id\/logs/);
  assert.match(readme, /DELETE \/api\/v1\/campaigns\/:id\/logs/);
  assert.match(readme, /GET \/api\/v1\/logs/);
  assert.match(readme, /GET \/api\/v1\/settings/);
  assert.match(readme, /POST \/api\/v1\/settings\/bot-ips\/reload/);
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
  assert.match(readme, /--check-health/);
  assert.match(readme, /Production Preflight|上线前检查/);
  assert.match(readme, /readonly/i);
  assert.match(readme, /RUN_BROWSER_LAYOUT/);
  assert.match(readme, /POSTGRES_BROWSER_LAYOUT_DATABASE_URL/);
  assert.match(readme, /POSTGRES_API_SMOKE_DATABASE_URL/);
  assert.match(readme, /test-output\/admin-browser-layout/);
  assert.match(readme, /DATABASE_URL 配置后会自动使用 PostgreSQL/);
  assert.match(readme, /生产环境不允许使用本地内存仓储/);
  assert.doesNotMatch(readme, /BOT_IPS=66\.249/);
});

test('.env.example lists every runtime env var consumed by config', async () => {
  const envExample = await readFile('.env.example', 'utf8');

  for (const key of [
    'HOST=',
    'PORT=',
    'MIN_CONFIDENCE=',
    'BOT_CONFIDENCE=',
    'BOT_IPS=',
    'BOT_IP_SOURCE=',
    'BOT_IP_FILE_PATH=',
    'ADMIN_TOKEN=',
    'REPOSITORY_DRIVER=',
    'DATABASE_URL=',
    'LOG_FILE_PATH=',
    'LOG_MAX_BYTES=',
    'LOG_MAX_FILES='
  ]) {
    assert.match(envExample, new RegExp(`^${key}`, 'm'));
  }
});
