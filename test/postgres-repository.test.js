import test from 'node:test';
import assert from 'node:assert/strict';

import { PostgresAccessLogRepository } from '../src/repositories/postgres/access-log.repo.js';
import { PostgresCampaignRepository } from '../src/repositories/postgres/campaign.repo.js';

test('PostgresCampaignRepository stores tenant-scoped campaigns through parameterized SQL', async () => {
  const client = createFakePostgresClient();
  const repository = new PostgresCampaignRepository({
    client,
    now: () => '2026-04-23T10:00:00.000Z'
  });

  const campaign = await repository.create({
    tenantId: 'tenant-1',
    name: 'DB Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'iframe'
  });

  assert.match(client.calls[0].text, /INSERT INTO campaigns/);
  assert.match(client.calls[0].text, /\$1/);
  assert.equal(campaign.tenantId, 'tenant-1');
  assert.equal(campaign.createdAt, '2026-04-23T10:00:00.000Z');
  assert.deepEqual(await repository.findById(campaign.id, 'tenant-1'), campaign);
  assert.equal(await repository.findById(campaign.id, 'tenant-2'), null);
});

test('PostgresCampaignRepository updates and deletes campaigns by tenant', async () => {
  const times = ['2026-04-23T10:00:00.000Z', '2026-04-23T10:05:00.000Z'];
  const repository = new PostgresCampaignRepository({
    client: createFakePostgresClient(),
    now: () => times.shift()
  });
  const campaign = await repository.create({
    tenantId: 'tenant-1',
    name: 'Before',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  assert.equal(await repository.update(campaign.id, 'tenant-2', { name: 'Wrong' }), null);

  const updated = await repository.update(campaign.id, 'tenant-1', {
    name: 'After',
    redirectMode: 'loading'
  });

  assert.equal(updated.name, 'After');
  assert.equal(updated.safeUrl, 'https://safe.example');
  assert.equal(updated.redirectMode, 'loading');
  assert.equal(updated.updatedAt, '2026-04-23T10:05:00.000Z');
  assert.equal(await repository.delete(campaign.id, 'tenant-2'), false);
  assert.equal(await repository.delete(campaign.id, 'tenant-1'), true);
  assert.equal(await repository.findById(campaign.id, 'tenant-1'), null);
});

test('PostgresAccessLogRepository paginates tenant logs with filters', async () => {
  const client = createFakePostgresClient();
  const repository = new PostgresAccessLogRepository({ client });
  const first = await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    ipAddress: '66.249.66.1',
    userAgent: 'UA 1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['static: known bot'],
    createdAt: '2026-04-23T10:00:00.000Z'
  });
  const second = await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-2',
    ipAddress: '66.249.66.1',
    userAgent: 'UA 2',
    verdict: 'bot',
    action: 'safe',
    confidence: 90,
    detectionReasons: [],
    createdAt: '2026-04-23T10:01:00.000Z'
  });
  await repository.create({
    tenantId: 'tenant-2',
    campaignId: 'campaign-3',
    ipAddress: '66.249.66.1',
    userAgent: 'UA 3',
    verdict: 'bot',
    action: 'safe',
    confidence: 88,
    detectionReasons: [],
    createdAt: '2026-04-23T10:02:00.000Z'
  });

  assert.deepEqual(
    await repository.findPageByTenant('tenant-1', {
      page: 1,
      pageSize: 2,
      filters: {
        verdict: 'bot',
        action: 'safe',
        ipAddress: '66.249.66.1',
        from: '2026-04-23T00:00:00.000Z',
        to: '2026-04-23T23:59:59.999Z'
      }
    }),
    {
      items: [second, first],
      total: 2,
      page: 1,
      pageSize: 2
    }
  );

  assert.deepEqual(
    await repository.findPageByTenant('tenant-1', {
      page: 2,
      pageSize: 1,
      filters: {
        verdict: 'bot',
        action: 'safe',
        ipAddress: '66.249.66.1'
      }
    }),
    {
      items: [first],
      total: 2,
      page: 2,
      pageSize: 1
    }
  );
});

test('PostgresAccessLogRepository lists campaign logs without exposing stored rows', async () => {
  const repository = new PostgresAccessLogRepository({ client: createFakePostgresClient() });
  const log = await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    ipAddress: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: [],
    createdAt: '2026-04-23T10:00:00.000Z'
  });

  const logs = await repository.findByCampaign('campaign-1', 'tenant-1');
  logs[0].verdict = 'bot';

  assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-1'), [log]);
  assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-2'), []);
});

test('PostgresAccessLogRepository deletes campaign logs by tenant', async () => {
  const repository = new PostgresAccessLogRepository({ client: createFakePostgresClient() });
  await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    ipAddress: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });
  await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-2',
    ipAddress: '203.0.113.11',
    userAgent: 'Mozilla/5.0',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });
  await repository.create({
    tenantId: 'tenant-2',
    campaignId: 'campaign-1',
    ipAddress: '203.0.113.12',
    userAgent: 'Mozilla/5.0',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });

  assert.equal(await repository.deleteByCampaign('campaign-1', 'tenant-1'), 1);
  assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-1'), []);
  assert.equal((await repository.findByCampaign('campaign-2', 'tenant-1')).length, 1);
  assert.equal((await repository.findByCampaign('campaign-1', 'tenant-2')).length, 1);
});

function createFakePostgresClient() {
  return {
    calls: [],
    campaigns: new Map(),
    logs: [],
    async query(text, params = []) {
      this.calls.push({ text, params });
      const normalized = text.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith('INSERT INTO campaigns')) {
        const row = campaignRow({
          id: params[0],
          tenantId: params[1],
          name: params[2],
          safeUrl: params[3],
          moneyUrl: params[4],
          redirectMode: params[5],
          createdAt: params[6],
          updatedAt: params[7]
        });
        this.campaigns.set(row.id, { ...row });
        return { rows: [{ ...row }], rowCount: 1 };
      }

      if (normalized.startsWith('SELECT') && normalized.includes('FROM campaigns') && normalized.includes('id = $1')) {
        const row = this.campaigns.get(params[0]);
        return { rows: row && row.tenant_id === params[1] ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
      }

      if (normalized.startsWith('SELECT') && normalized.includes('FROM campaigns')) {
        const rows = [...this.campaigns.values()]
          .filter((row) => row.tenant_id === params[0])
          .sort((left, right) => left.created_at.localeCompare(right.created_at))
          .map((row) => ({ ...row }));
        return { rows, rowCount: rows.length };
      }

      if (normalized.startsWith('UPDATE campaigns')) {
        const [name, safeUrl, moneyUrl, redirectMode, updatedAt, id, tenantId] = params;
        const row = this.campaigns.get(id);

        if (!row || row.tenant_id !== tenantId) {
          return { rows: [], rowCount: 0 };
        }

        const updated = {
          ...row,
          name: name ?? row.name,
          safe_url: safeUrl ?? row.safe_url,
          money_url: moneyUrl ?? row.money_url,
          redirect_mode: redirectMode ?? row.redirect_mode,
          updated_at: updatedAt
        };
        this.campaigns.set(id, updated);
        return { rows: [{ ...updated }], rowCount: 1 };
      }

      if (normalized.startsWith('DELETE FROM campaigns')) {
        const [id, tenantId] = params;
        const row = this.campaigns.get(id);

        if (!row || row.tenant_id !== tenantId) {
          return { rows: [], rowCount: 0 };
        }

        this.campaigns.delete(id);
        return { rows: [], rowCount: 1 };
      }

      if (normalized.startsWith('INSERT INTO access_logs')) {
        const row = accessLogRow({
          id: params[0],
          tenantId: params[1],
          campaignId: params[2],
          ipAddress: params[3],
          userAgent: params[4],
          verdict: params[5],
          action: params[6],
          confidence: params[7],
          detectionReasons: params[8],
          createdAt: params[9],
          updatedAt: params[10]
        });
        this.logs.push({ ...row, detection_reasons: [...row.detection_reasons] });
        return { rows: [cloneRow(row)], rowCount: 1 };
      }

      if (normalized.includes('COUNT(*) AS total') && normalized.includes('FROM access_logs')) {
        return { rows: [{ total: String(filterLogs(this.logs, normalized, params).length) }], rowCount: 1 };
      }

      if (normalized.startsWith('DELETE FROM access_logs')) {
        const before = this.logs.length;
        this.logs = this.logs.filter(
          (row) => row.campaign_id !== params[0] || row.tenant_id !== params[1]
        );
        return { rows: [], rowCount: before - this.logs.length };
      }

      if (normalized.startsWith('SELECT') && normalized.includes('FROM access_logs')) {
        let rows = filterLogs(this.logs, normalized, params)
          .sort((left, right) => {
            const direction = normalized.includes('ORDER BY created_at DESC') ? -1 : 1;
            return direction * left.created_at.localeCompare(right.created_at);
          });
        const { limit, offset } = limitOffset(normalized, params);

        if (limit !== null) {
          rows = rows.slice(offset, offset + limit);
        }

        return { rows: rows.map(cloneRow), rowCount: rows.length };
      }

      throw new Error(`Unhandled SQL: ${normalized}`);
    }
  };
}

function campaignRow(input) {
  return {
    id: input.id,
    tenant_id: input.tenantId,
    name: input.name,
    safe_url: input.safeUrl,
    money_url: input.moneyUrl,
    redirect_mode: input.redirectMode,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

function accessLogRow(input) {
  return {
    id: input.id,
    tenant_id: input.tenantId,
    campaign_id: input.campaignId,
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
    verdict: input.verdict,
    action: input.action,
    confidence: input.confidence,
    detection_reasons: input.detectionReasons,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

function filterLogs(logs, sql, params) {
  return logs.filter((row) => {
    if (sql.includes('campaign_id = $1') && row.campaign_id !== params[0]) {
      return false;
    }

    const tenantIndex = paramIndex(sql, 'tenant_id');
    if (tenantIndex !== null && row.tenant_id !== params[tenantIndex]) {
      return false;
    }

    return (
      matchesOptionalFilter(row, sql, params, 'verdict', 'verdict') &&
      matchesOptionalFilter(row, sql, params, 'action', 'action') &&
      matchesOptionalFilter(row, sql, params, 'ip_address', 'ip_address') &&
      matchesRange(row, sql, params, 'created_at', '>=') &&
      matchesRange(row, sql, params, 'created_at', '<=')
    );
  });
}

function matchesOptionalFilter(row, sql, params, column, key) {
  const index = paramIndex(sql, column);
  return index === null || row[key] === params[index];
}

function matchesRange(row, sql, params, column, operator) {
  const index = paramIndex(sql, column, operator);
  return index === null || (operator === '>=' ? row[column] >= params[index] : row[column] <= params[index]);
}

function paramIndex(sql, column, operator = '=') {
  const escapedOperator = operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`${column}\\s*${escapedOperator}\\s*\\$(\\d+)`));
  return match ? Number(match[1]) - 1 : null;
}

function limitOffset(sql, params) {
  const limitIndex = keywordParamIndex(sql, 'LIMIT');
  const offsetIndex = keywordParamIndex(sql, 'OFFSET');

  return {
    limit: limitIndex === null ? null : params[limitIndex],
    offset: offsetIndex === null ? 0 : params[offsetIndex]
  };
}

function keywordParamIndex(sql, keyword) {
  const match = sql.match(new RegExp(`${keyword}\\s*\\$(\\d+)`));
  return match ? Number(match[1]) - 1 : null;
}

function cloneRow(row) {
  return {
    ...row,
    detection_reasons: Array.isArray(row.detection_reasons)
      ? [...row.detection_reasons]
      : row.detection_reasons
  };
}
