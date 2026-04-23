import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsService } from '../src/services/analytics.service.js';
import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';

test('AnalyticsService summarizes campaign and access-log counts by tenant', async () => {
  const campaignRepository = new InMemoryCampaignRepository();
  const accessLogRepository = new InMemoryAccessLogRepository();
  const service = new AnalyticsService({
    campaignRepository,
    accessLogRepository
  });
  const firstCampaign = await campaignRepository.create({
    tenantId: 'tenant-1',
    name: 'First',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example'
  });
  await campaignRepository.create({
    tenantId: 'tenant-1',
    name: 'Second',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example'
  });
  await campaignRepository.create({
    tenantId: 'tenant-2',
    name: 'Other Tenant',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example'
  });

  await accessLogRepository.create({
    tenantId: 'tenant-1',
    campaignId: firstCampaign.id,
    ipAddress: '203.0.113.1',
    userAgent: 'UA 1',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });
  await accessLogRepository.create({
    tenantId: 'tenant-1',
    campaignId: firstCampaign.id,
    ipAddress: '66.249.66.1',
    userAgent: 'Googlebot/2.1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['ip: matched']
  });
  await accessLogRepository.create({
    tenantId: 'tenant-1',
    campaignId: firstCampaign.id,
    ipAddress: '203.0.113.2',
    userAgent: 'UA 2',
    verdict: 'suspicious',
    action: 'safe',
    confidence: 65,
    detectionReasons: ['ua: weak signal']
  });
  await accessLogRepository.create({
    tenantId: 'tenant-2',
    campaignId: 'other-campaign',
    ipAddress: '203.0.113.3',
    userAgent: 'UA 3',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: []
  });

  assert.deepEqual(await service.getOverview('tenant-1'), {
    campaignCount: 2,
    totalVisits: 3,
    verdicts: {
      human: 1,
      bot: 1,
      suspicious: 1
    },
    actions: {
      money: 1,
      safe: 2,
      block: 0
    }
  });
});

test('AnalyticsService returns empty overview when access logging is unavailable', async () => {
  const campaignRepository = new InMemoryCampaignRepository();
  const service = new AnalyticsService({ campaignRepository });

  await campaignRepository.create({
    name: 'No Logs Yet',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example'
  });

  assert.deepEqual(await service.getOverview(), {
    campaignCount: 1,
    totalVisits: 0,
    verdicts: {
      human: 0,
      bot: 0,
      suspicious: 0
    },
    actions: {
      money: 0,
      safe: 0,
      block: 0
    }
  });
});
