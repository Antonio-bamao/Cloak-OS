import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultDetectionPipeline } from '../src/core/pipeline-factory.js';
import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { createDefaultCampaignService } from '../src/server/app.js';

test('createDefaultDetectionPipeline registers IP and UA detectors in stable order', async () => {
  const pipeline = createDefaultDetectionPipeline({
    botIps: ['66.249.66.1']
  });

  const results = await pipeline.execute({
    ip: '66.249.66.1',
    userAgent: 'Mozilla/5.0 Googlebot/2.1'
  });

  assert.deepEqual(results, [
    {
      detector: 'ip',
      isBot: true,
      confidence: 95,
      reason: 'IP matched configured bot source'
    },
    {
      detector: 'ua',
      isBot: true,
      confidence: 90,
      reason: 'User-Agent matched crawler signature'
    }
  ]);
});

test('createDefaultCampaignService wires repositories and the default pipeline', async () => {
  const repository = new InMemoryCampaignRepository();
  const accessLogRepository = new InMemoryAccessLogRepository({
    now: () => '2026-04-23T10:00:00.000Z'
  });
  const service = createDefaultCampaignService({
    repository,
    accessLogRepository,
    botIps: ['66.249.66.1']
  });
  const campaign = await service.createCampaign({
    name: 'Default Service',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  const result = await service.handleVisit(campaign.id, {
    ip: '66.249.66.1',
    userAgent: 'Mozilla/5.0 Chrome/123.0'
  });

  assert.equal(result.decision.verdict, 'bot');
  assert.equal(result.response.headers.Location, 'https://safe.example');
});

test('createDefaultCampaignService reads bot IPs from config detection settings', async () => {
  const repository = new InMemoryCampaignRepository();
  const service = createDefaultCampaignService({
    repository,
    accessLogRepository: new InMemoryAccessLogRepository(),
    config: {
      detection: {
        botIps: ['66.249.66.1']
      }
    }
  });
  const campaign = await service.createCampaign({
    name: 'Config Service',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  const result = await service.handleVisit(campaign.id, {
    ip: '66.249.66.1',
    userAgent: 'Mozilla/5.0 Chrome/123.0'
  });

  assert.equal(result.decision.verdict, 'bot');
});

test('createDefaultCampaignService can load bot IPs from a configured file source', async () => {
  const campaignService = createDefaultCampaignService({
    config: {
      detection: {
        botIps: [],
        botIpSource: {
          type: 'file',
          filePath: 'config/bot-ips.txt'
        }
      }
    },
    repositories: {
      campaignRepository: new InMemoryCampaignRepository(),
      accessLogRepository: new InMemoryAccessLogRepository()
    },
    readBotIpFile: () => '66.249.66.1\n'
  });

  const campaign = await campaignService.createCampaign({
    tenantId: 'tenant-1',
    name: 'File Bot IP Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example'
  });

  const result = await campaignService.handleVisit(
    campaign.id,
    {
      ip: '66.249.66.1',
      userAgent: 'Mozilla/5.0'
    },
    'tenant-1'
  );

  assert.equal(result.decision.verdict, 'bot');
  assert.equal(result.decision.action, 'safe');
});
