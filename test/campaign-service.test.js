import test from 'node:test';
import assert from 'node:assert/strict';

import { DetectionPipeline } from '../src/core/pipeline.js';
import { DecisionEngine } from '../src/core/decision-engine.js';
import { BaseDetector } from '../src/detectors/base.detector.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { CampaignService } from '../src/services/campaign.service.js';
import { createCloakRoute } from '../src/routes/cloak.routes.js';

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

test('CampaignService creates campaigns with tenant and timestamp metadata', async () => {
  const repository = new InMemoryCampaignRepository();
  const service = new CampaignService({ repository });

  const campaign = await service.createCampaign({
    name: 'Main Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  assert.equal(campaign.tenantId, '00000000-0000-0000-0000-000000000000');
  assert.equal(campaign.name, 'Main Campaign');
  assert.ok(campaign.id);
  assert.ok(campaign.createdAt);
  assert.ok(campaign.updatedAt);
});

test('CampaignService handles a clean visit by sending traffic to the money URL', async () => {
  const repository = new InMemoryCampaignRepository();
  const pipeline = new DetectionPipeline();
  pipeline.register(new StaticDetector({ isBot: false, confidence: 0, reason: 'clean' }));

  const service = new CampaignService({
    repository,
    pipeline,
    decisionEngine: new DecisionEngine()
  });

  const campaign = await service.createCampaign({
    name: 'Main Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });

  const result = await service.handleVisit(campaign.id, { ip: '203.0.113.10' });

  assert.equal(result.decision.verdict, 'human');
  assert.deepEqual(result.response, {
    statusCode: 302,
    headers: { Location: 'https://money.example' },
    body: ''
  });
});

test('cloak route adapts HTTP-ish request data without reaching into repositories', async () => {
  const repository = new InMemoryCampaignRepository();
  const service = new CampaignService({ repository });
  const campaign = await service.createCampaign({
    name: 'Main Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const route = createCloakRoute({ campaignService: service });

  const result = await route({
    params: { campaignId: campaign.id },
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/123.0' },
    ip: '203.0.113.10'
  });

  assert.equal(result.statusCode, 302);
  assert.equal(result.headers.Location, 'https://money.example');
});
