import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessLogService } from '../src/services/access-log.service.js';
import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';

test('AccessLogService lists tenant logs with pagination and filters', async () => {
  const repository = new InMemoryAccessLogRepository();
  const service = new AccessLogService({ repository });
  await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    ipAddress: '203.0.113.1',
    userAgent: 'UA 1',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: [],
    createdAt: '2026-04-23T09:00:00.000Z'
  });
  const matchingLog = await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-2',
    ipAddress: '66.249.66.1',
    userAgent: 'Googlebot/2.1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['ip: matched'],
    createdAt: '2026-04-23T10:00:00.000Z'
  });
  await repository.create({
    tenantId: 'tenant-2',
    campaignId: 'campaign-3',
    ipAddress: '66.249.66.1',
    userAgent: 'Googlebot/2.1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: [],
    createdAt: '2026-04-23T11:00:00.000Z'
  });

  assert.deepEqual(
    await service.listLogs({
      page: 1,
      pageSize: 1,
      filters: {
        verdict: 'bot',
        action: 'safe',
        ipAddress: '66.249.66.1',
        from: '2026-04-23T00:00:00.000Z',
        to: '2026-04-23T23:59:59.999Z'
      }
    }, 'tenant-1'),
    {
      items: [matchingLog],
      total: 1,
      page: 1,
      pageSize: 1
    }
  );
});

test('AccessLogService returns an empty page when logging is unavailable', async () => {
  const service = new AccessLogService();

  assert.deepEqual(await service.listLogs({ page: 2, pageSize: 10 }), {
    items: [],
    total: 0,
    page: 2,
    pageSize: 10
  });
});
