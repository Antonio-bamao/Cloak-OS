import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { CampaignService } from '../src/services/campaign.service.js';
import { createApp } from '../src/server/app.js';

const AUTH_HEADERS = { Authorization: 'Bearer dev-admin-token' };

test('campaign logs API returns paginated access logs for a campaign', async () => {
  const campaignRepository = new InMemoryCampaignRepository();
  const accessLogRepository = new InMemoryAccessLogRepository({
    now: (() => {
      const times = [
        '2026-04-23T10:00:00.000Z',
        '2026-04-23T10:01:00.000Z',
        '2026-04-23T10:02:00.000Z'
      ];
      return () => times.shift();
    })()
  });
  const campaignService = new CampaignService({
    repository: campaignRepository,
    accessLogRepository
  });
  const campaign = await campaignService.createCampaign({
    name: 'Log Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const otherCampaign = await campaignService.createCampaign({
    name: 'Other Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const firstLog = await accessLogRepository.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    ipAddress: '203.0.113.1',
    userAgent: 'UA 1',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });
  await accessLogRepository.create({
    tenantId: otherCampaign.tenantId,
    campaignId: otherCampaign.id,
    ipAddress: '203.0.113.2',
    userAgent: 'UA 2',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['ip: matched']
  });
  const secondLog = await accessLogRepository.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    ipAddress: '203.0.113.3',
    userAgent: 'UA 3',
    verdict: 'suspicious',
    action: 'safe',
    confidence: 65,
    detectionReasons: ['ua: weak signal']
  });
  const app = createApp({ campaignService });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}/logs?page=1&pageSize=1`,
      { headers: AUTH_HEADERS }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: [secondLog],
      message: 'Access logs fetched',
      pagination: {
        page: 1,
        pageSize: 1,
        total: 2
      }
    });

    const secondPageResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}/logs?page=2&pageSize=1`,
      { headers: AUTH_HEADERS }
    );
    const secondPage = await secondPageResponse.json();

    assert.deepEqual(secondPage.data, [firstLog]);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('campaign logs API filters by verdict, action, IP, and time range', async () => {
  const campaignRepository = new InMemoryCampaignRepository();
  const accessLogRepository = new InMemoryAccessLogRepository();
  const campaignService = new CampaignService({
    repository: campaignRepository,
    accessLogRepository
  });
  const campaign = await campaignService.createCampaign({
    name: 'Filtered Logs',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  await accessLogRepository.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    ipAddress: '203.0.113.1',
    userAgent: 'UA 1',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: [],
    createdAt: '2026-04-23T09:00:00.000Z'
  });
  const matchingLog = await accessLogRepository.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    ipAddress: '66.249.66.1',
    userAgent: 'Googlebot/2.1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['ip: matched'],
    createdAt: '2026-04-23T10:00:00.000Z'
  });
  await accessLogRepository.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    ipAddress: '66.249.66.1',
    userAgent: 'Googlebot/2.1',
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    detectionReasons: ['ip: matched'],
    createdAt: '2026-04-24T10:00:00.000Z'
  });
  const app = createApp({ campaignService });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}/logs?verdict=bot&action=safe&ipAddress=66.249.66.1&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-23T23%3A59%3A59.999Z`,
      { headers: AUTH_HEADERS }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: [matchingLog],
      message: 'Access logs fetched',
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
