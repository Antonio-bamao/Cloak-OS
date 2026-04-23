import test from 'node:test';
import assert from 'node:assert/strict';

import { DetectionPipeline } from '../src/core/pipeline.js';
import { DecisionEngine } from '../src/core/decision-engine.js';
import { BaseDetector } from '../src/detectors/base.detector.js';
import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { CampaignService } from '../src/services/campaign.service.js';

class StaticDetector extends BaseDetector {
  constructor(result) {
    super();
    this.result = result;
  }

  get name() {
    return 'static';
  }

  async detect() {
    return this.result;
  }
}

test('access log repository stores tenant-scoped visit logs with timestamps', async () => {
  const repository = new InMemoryAccessLogRepository({
    now: () => '2026-04-23T10:00:00.000Z'
  });

  const log = await repository.create({
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    ipAddress: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    verdict: 'human',
    action: 'money',
    confidence: 0,
    detectionReasons: []
  });

  assert.equal(log.tenantId, 'tenant-1');
  assert.equal(log.createdAt, '2026-04-23T10:00:00.000Z');
  assert.equal(log.updatedAt, '2026-04-23T10:00:00.000Z');
  assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-1'), [log]);
  assert.deepEqual(await repository.findByCampaign('campaign-1', 'other-tenant'), []);
});

test('CampaignService records an access log after handling a visit', async () => {
  const campaignRepository = new InMemoryCampaignRepository();
  const accessLogRepository = new InMemoryAccessLogRepository({
    now: () => '2026-04-23T10:00:00.000Z'
  });
  const pipeline = new DetectionPipeline();
  pipeline.register(new StaticDetector({
    isBot: true,
    confidence: 95,
    reason: 'known bot'
  }));
  const service = new CampaignService({
    repository: campaignRepository,
    accessLogRepository,
    pipeline,
    decisionEngine: new DecisionEngine()
  });
  const campaign = await service.createCampaign({
    name: 'Logged Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  await service.handleVisit(campaign.id, {
    ip: '66.249.66.1',
    userAgent: 'Googlebot/2.1'
  });

  const logs = await accessLogRepository.findByCampaign(campaign.id, campaign.tenantId);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].campaignId, campaign.id);
  assert.equal(logs[0].ipAddress, '66.249.66.1');
  assert.equal(logs[0].userAgent, 'Googlebot/2.1');
  assert.equal(logs[0].verdict, 'bot');
  assert.equal(logs[0].action, 'safe');
  assert.equal(logs[0].confidence, 95);
  assert.deepEqual(logs[0].detectionReasons, ['static: known bot']);
});
