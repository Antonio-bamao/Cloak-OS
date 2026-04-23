import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server/app.js';
import { CampaignService } from '../src/services/campaign.service.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';

const AUTH_HEADERS = { Authorization: 'Bearer dev-admin-token' };

test('analytics overview API returns a protected management summary', async () => {
  const overview = {
    campaignCount: 2,
    totalVisits: 4,
    verdicts: {
      human: 1,
      bot: 2,
      suspicious: 1
    },
    actions: {
      money: 1,
      safe: 3,
      block: 0
    }
  };
  const app = createApp({
    campaignService: new CampaignService({
      repository: new InMemoryCampaignRepository()
    }),
    analyticsService: {
      getOverview: async () => overview
    }
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/overview`, {
      headers: AUTH_HEADERS
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: overview,
      message: 'Analytics overview fetched'
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('analytics overview API rejects missing admin authorization', async () => {
  const app = createApp({
    campaignService: new CampaignService({
      repository: new InMemoryCampaignRepository()
    }),
    analyticsService: {
      getOverview: async () => ({})
    }
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/overview`);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
