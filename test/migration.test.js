import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createInitialMigrationSql } from '../src/database/migrations.js';

test('initial migration SQL creates campaign and access log tables with indexes', () => {
  const sql = createInitialMigrationSql();

  assert.match(sql, /CREATE TABLE campaigns/);
  assert.match(sql, /tenant_id UUID NOT NULL/);
  assert.match(sql, /redirect_mode TEXT NOT NULL/);
  assert.match(sql, /CREATE TABLE access_logs/);
  assert.match(sql, /ip_address INET NOT NULL/);
  assert.match(sql, /detection_reasons JSONB NOT NULL/);
  assert.match(sql, /PARTITION BY RANGE \(created_at\)/);
  assert.match(sql, /CREATE INDEX idx_campaigns_tenant_created/);
  assert.match(sql, /CREATE INDEX idx_access_logs_campaign_created/);
  assert.match(sql, /CREATE INDEX idx_access_logs_ip/);
});

test('checked-in initial migration matches generated SQL', async () => {
  const migration = await readFile('migrations/001_initial.sql', 'utf8');

  assert.equal(migration.trim(), createInitialMigrationSql().trim());
});
