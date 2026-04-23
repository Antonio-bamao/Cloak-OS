import test from 'node:test';
import assert from 'node:assert/strict';

import { databaseSchema } from '../src/database/schema.js';

test('database schema draft keeps tenant and audit fields on core tables', () => {
  const campaigns = databaseSchema.tables.campaigns;
  const accessLogs = databaseSchema.tables.accessLogs;

  for (const table of [campaigns, accessLogs]) {
    assert.equal(table.columns.id.type, 'uuid');
    assert.equal(table.columns.tenantId.type, 'uuid');
    assert.equal(table.columns.createdAt.type, 'timestamptz');
    assert.equal(table.columns.updatedAt.type, 'timestamptz');
  }
});

test('campaign schema captures redirect configuration and indexed tenant lookups', () => {
  const campaigns = databaseSchema.tables.campaigns;

  assert.deepEqual(Object.keys(campaigns.columns), [
    'id',
    'tenantId',
    'name',
    'safeUrl',
    'moneyUrl',
    'redirectMode',
    'createdAt',
    'updatedAt'
  ]);
  assert.deepEqual(campaigns.indexes, [
    { name: 'idx_campaigns_tenant_created', columns: ['tenantId', 'createdAt'] }
  ]);
});

test('access log schema captures decision, request, and monthly partition guidance', () => {
  const accessLogs = databaseSchema.tables.accessLogs;

  assert.equal(accessLogs.partitionBy, 'createdAt monthly');
  assert.deepEqual(accessLogs.indexes, [
    { name: 'idx_access_logs_campaign_created', columns: ['campaignId', 'createdAt'] },
    { name: 'idx_access_logs_ip', columns: ['ipAddress'] }
  ]);
  assert.equal(accessLogs.columns.verdict.type, 'enum(bot,human,suspicious)');
  assert.equal(accessLogs.columns.action.type, 'enum(safe,money,block)');
});
