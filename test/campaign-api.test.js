import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server/app.js';
import { CampaignService } from '../src/services/campaign.service.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';

test('campaign API creates and lists campaigns with unified responses', async () => {
  const app = createApp({
    campaignService: new CampaignService({
      repository: new InMemoryCampaignRepository()
    })
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const createResponse = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Launch Campaign',
        safeUrl: 'https://safe.example',
        moneyUrl: 'https://money.example',
        redirectMode: 'redirect'
      })
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.success, true);
    assert.equal(created.message, 'Campaign created');
    assert.equal(created.data.name, 'Launch Campaign');
    assert.ok(created.data.id);

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns`);

    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), {
      success: true,
      data: [created.data],
      message: 'Campaigns fetched'
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('campaign API fetches a single campaign through a route param', async () => {
  const service = new CampaignService({
    repository: new InMemoryCampaignRepository()
  });
  const campaign = await service.createCampaign({
    name: 'Single Campaign',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'iframe'
  });
  const app = createApp({ campaignService: service });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: campaign,
      message: 'Campaign fetched'
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('campaign API rejects invalid JSON with a unified error response', async () => {
  const app = createApp({
    campaignService: new CampaignService({
      repository: new InMemoryCampaignRepository()
    })
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json'
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON request body'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('campaign API updates and deletes a campaign through REST routes', async () => {
  const service = new CampaignService({
    repository: new InMemoryCampaignRepository()
  });
  const campaign = await service.createCampaign({
    name: 'Before Update',
    safeUrl: 'https://safe.example',
    moneyUrl: 'https://money.example',
    redirectMode: 'redirect'
  });
  const app = createApp({ campaignService: service });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'After Update',
        redirectMode: 'iframe'
      })
    });

    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.success, true);
    assert.equal(updated.message, 'Campaign updated');
    assert.equal(updated.data.name, 'After Update');
    assert.equal(updated.data.redirectMode, 'iframe');
    assert.equal(updated.data.safeUrl, 'https://safe.example');

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}`, {
      method: 'DELETE'
    });

    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(await deleteResponse.json(), {
      success: true,
      data: { id: campaign.id },
      message: 'Campaign deleted'
    });

    const getDeletedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/campaigns/${campaign.id}`);

    assert.equal(getDeletedResponse.status, 404);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
