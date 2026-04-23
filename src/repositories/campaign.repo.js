import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../config/index.js';
import { cloneRecord, cloneRecords } from './clone.js';

export class InMemoryCampaignRepository {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.campaigns = new Map();
    this.now = now;
  }

  async create(input) {
    const now = input.createdAt ?? this.now();
    const campaign = {
      id: randomUUID(),
      tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
      name: input.name,
      safeUrl: input.safeUrl,
      moneyUrl: input.moneyUrl,
      redirectMode: input.redirectMode ?? 'redirect',
      createdAt: now,
      updatedAt: now
    };

    this.campaigns.set(campaign.id, cloneRecord(campaign));
    return cloneRecord(campaign);
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const campaign = this.campaigns.get(id);

    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }

    return cloneRecord(campaign);
  }

  async findAll(tenantId = DEFAULT_TENANT_ID) {
    const campaigns = [...this.campaigns.values()].filter(
      (campaign) => campaign.tenantId === tenantId
    );

    return cloneRecords(campaigns);
  }

  async update(id, tenantId = DEFAULT_TENANT_ID, patch = {}) {
    const campaign = this.campaigns.get(id);

    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }

    const updated = {
      ...campaign,
      ...definedPatch(patch),
      id: campaign.id,
      tenantId: campaign.tenantId,
      createdAt: campaign.createdAt,
      updatedAt: this.now()
    };

    this.campaigns.set(id, cloneRecord(updated));
    return cloneRecord(updated);
  }

  async delete(id, tenantId = DEFAULT_TENANT_ID) {
    const campaign = this.campaigns.get(id);

    if (!campaign || campaign.tenantId !== tenantId) {
      return false;
    }

    this.campaigns.delete(id);
    return true;
  }
}

function definedPatch(patch) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
}
