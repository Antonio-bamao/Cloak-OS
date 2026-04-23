import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../config/index.js';

export class InMemoryCampaignRepository {
  constructor() {
    this.campaigns = new Map();
  }

  async create(input) {
    const now = new Date().toISOString();
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

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const campaign = this.campaigns.get(id);

    if (!campaign || campaign.tenantId !== tenantId) {
      return null;
    }

    return campaign;
  }
}
