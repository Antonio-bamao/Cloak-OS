import test from 'node:test';
import assert from 'node:assert/strict';

import { DetectionPipeline } from '../src/core/pipeline.js';
import { DecisionEngine } from '../src/core/decision-engine.js';
import { BaseDetector } from '../src/detectors/base.detector.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';
import { CampaignService } from '../src/services/campaign.service.js';
import { createApp } from '../src/server/app.js';

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

test('public cloak HTTP route sends clean traffic to the money URL as a raw redirect', async () => {
  const repository = new InMemoryCampaignRepository();
  const pipeline = new DetectionPipeline();
  pipeline.register(new StaticDetector({ isBot: false, confidence: 0, reason: 'clean' }));
  const campaignService = new CampaignService({
    repository,
    pipeline,
    decisionEngine: new DecisionEngine()
  });
  const campaign = await campaignService.createCampaign({
    name: 'Public Cloak',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const app = createApp({ campaignService });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/c/${campaign.id}`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/123.0' }
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://money.example');
    assert.equal(await response.text(), '');
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('HTTP server preserves HTML strategy headers and body for cloak responses', async () => {
  const repository = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository });
  const campaign = await campaignService.createCampaign({
    name: 'Iframe Cloak',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'iframe'
  });
  const app = createApp({ campaignService });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/c/${campaign.id}`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(body, /<iframe/);
    assert.match(body, /https:\/\/money\.example/);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('public cloak HTTP route returns 429 when the rate limiter rejects a visitor', async () => {
  const repository = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository });
  const campaign = await campaignService.createCampaign({
    name: 'Limited Cloak',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const app = createApp({
    campaignService,
    cloakRateLimiter: {
      consume() {
        return {
          allowed: false,
          retryAfterSeconds: 30
        };
      }
    }
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/c/${campaign.id}`, {
      redirect: 'manual'
    });

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '30');
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
