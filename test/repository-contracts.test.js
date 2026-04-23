import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAccessLogRepository } from '../src/repositories/access-log.repo.js';
import { InMemoryCampaignRepository } from '../src/repositories/campaign.repo.js';

function campaignRepositoryContract(name, createRepository) {
  test(`${name}: creates tenant-scoped campaigns with deterministic timestamps`, async () => {
    const repository = createRepository({
      now: () => '2026-04-23T10:00:00.000Z'
    });

    const campaign = await repository.create({
      tenantId: 'tenant-1',
      name: 'Contract Campaign',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example',
      redirectMode: 'iframe'
    });

    assert.equal(campaign.tenantId, 'tenant-1');
    assert.equal(campaign.createdAt, '2026-04-23T10:00:00.000Z');
    assert.equal(campaign.updatedAt, '2026-04-23T10:00:00.000Z');
    assert.deepEqual(await repository.findById(campaign.id, 'tenant-1'), campaign);
    assert.equal(await repository.findById(campaign.id, 'tenant-2'), null);
  });

  test(`${name}: does not expose mutable stored campaign objects`, async () => {
    const repository = createRepository();
    const campaign = await repository.create({
      tenantId: 'tenant-1',
      name: 'Original Name',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example'
    });

    campaign.name = 'Mutated Outside';

    const stored = await repository.findById(campaign.id, 'tenant-1');
    assert.equal(stored.name, 'Original Name');
  });

  test(`${name}: lists campaigns by tenant in created order`, async () => {
    const repository = createRepository();
    const first = await repository.create({
      tenantId: 'tenant-1',
      name: 'First',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example'
    });
    await repository.create({
      tenantId: 'tenant-2',
      name: 'Other Tenant',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example'
    });
    const second = await repository.create({
      tenantId: 'tenant-1',
      name: 'Second',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example'
    });

    assert.deepEqual(await repository.findAll('tenant-1'), [first, second]);
  });

  test(`${name}: updates campaigns by tenant and advances updatedAt`, async () => {
    const times = ['2026-04-23T10:00:00.000Z', '2026-04-23T10:05:00.000Z'];
    const repository = createRepository({
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
      redirectMode: 'iframe'
    });

    assert.equal(updated.name, 'After');
    assert.equal(updated.safeUrl, 'https://safe.example');
    assert.equal(updated.redirectMode, 'iframe');
    assert.equal(updated.createdAt, '2026-04-23T10:00:00.000Z');
    assert.equal(updated.updatedAt, '2026-04-23T10:05:00.000Z');
  });

  test(`${name}: deletes campaigns by tenant`, async () => {
    const repository = createRepository();
    const campaign = await repository.create({
      tenantId: 'tenant-1',
      name: 'Delete Me',
      safeUrl: 'https://safe.example',
      moneyUrl: 'https://money.example'
    });

    assert.equal(await repository.delete(campaign.id, 'tenant-2'), false);
    assert.equal(await repository.delete(campaign.id, 'tenant-1'), true);
    assert.equal(await repository.findById(campaign.id, 'tenant-1'), null);
  });
}

function accessLogRepositoryContract(name, createRepository) {
  test(`${name}: stores tenant-scoped logs and returns immutable copies`, async () => {
    const repository = createRepository({
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

    log.verdict = 'bot';

    const logs = await repository.findByCampaign('campaign-1', 'tenant-1');
    assert.equal(logs[0].verdict, 'human');
    assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-2'), []);
  });

  test(`${name}: lists all logs by tenant without exposing stored objects`, async () => {
    const repository = createRepository();
    const firstLog = await repository.create({
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
      tenantId: 'tenant-2',
      campaignId: 'campaign-2',
      ipAddress: '66.249.66.1',
      userAgent: 'Googlebot/2.1',
      verdict: 'bot',
      action: 'safe',
      confidence: 95,
      detectionReasons: []
    });

    const logs = await repository.findAllByTenant('tenant-1');
    logs[0].verdict = 'bot';

    assert.deepEqual(logs, [{ ...firstLog, verdict: 'bot' }]);
    assert.deepEqual(await repository.findAllByTenant('tenant-1'), [firstLog]);
  });

  test(`${name}: paginates with normalized positive page values`, async () => {
    const repository = createRepository();
    const first = await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-1',
      ipAddress: '203.0.113.1',
      userAgent: 'UA 1',
      verdict: 'human',
      action: 'money',
      confidence: 0,
      detectionReasons: [],
      createdAt: '2026-04-23T10:00:00.000Z'
    });
    const second = await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-1',
      ipAddress: '203.0.113.2',
      userAgent: 'UA 2',
      verdict: 'bot',
      action: 'safe',
      confidence: 95,
      detectionReasons: [],
      createdAt: '2026-04-23T10:01:00.000Z'
    });

    assert.deepEqual(
      await repository.findPageByCampaign('campaign-1', 'tenant-1', {
        page: 0,
        pageSize: -5
      }),
      {
        items: [second, first],
        total: 2,
        page: 1,
        pageSize: 20
      }
    );
  });

  test(`${name}: paginates all tenant logs with filters`, async () => {
    const repository = createRepository();
    const first = await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-1',
      ipAddress: '66.249.66.1',
      userAgent: 'UA 1',
      verdict: 'bot',
      action: 'safe',
      confidence: 95,
      detectionReasons: [],
      createdAt: '2026-04-23T10:00:00.000Z'
    });
    const second = await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-2',
      ipAddress: '66.249.66.1',
      userAgent: 'UA 2',
      verdict: 'bot',
      action: 'safe',
      confidence: 95,
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
      confidence: 95,
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
  });

  test(`${name}: deletes campaign logs by tenant`, async () => {
    const repository = createRepository();
    await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-1',
      ipAddress: '203.0.113.1',
      userAgent: 'UA 1',
      verdict: 'human',
      action: 'money',
      confidence: 0,
      detectionReasons: []
    });
    await repository.create({
      tenantId: 'tenant-1',
      campaignId: 'campaign-2',
      ipAddress: '203.0.113.2',
      userAgent: 'UA 2',
      verdict: 'bot',
      action: 'safe',
      confidence: 95,
      detectionReasons: []
    });
    await repository.create({
      tenantId: 'tenant-2',
      campaignId: 'campaign-1',
      ipAddress: '203.0.113.3',
      userAgent: 'UA 3',
      verdict: 'human',
      action: 'money',
      confidence: 0,
      detectionReasons: []
    });

    assert.equal(await repository.deleteByCampaign('campaign-1', 'tenant-2'), 1);
    assert.equal(await repository.deleteByCampaign('campaign-1', 'tenant-1'), 1);
    assert.deepEqual(await repository.findByCampaign('campaign-1', 'tenant-1'), []);
    assert.equal((await repository.findByCampaign('campaign-2', 'tenant-1')).length, 1);
  });
}

campaignRepositoryContract(
  'InMemoryCampaignRepository',
  (options) => new InMemoryCampaignRepository(options)
);

accessLogRepositoryContract(
  'InMemoryAccessLogRepository',
  (options) => new InMemoryAccessLogRepository(options)
);
