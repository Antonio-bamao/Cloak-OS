import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../config/index.js';

export class InMemoryAccessLogRepository {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.logs = [];
    this.now = now;
  }

  async create(input) {
    const now = this.now();
    const log = {
      id: randomUUID(),
      tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
      campaignId: input.campaignId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent ?? '',
      verdict: input.verdict,
      action: input.action,
      confidence: input.confidence,
      detectionReasons: input.detectionReasons ?? [],
      createdAt: now,
      updatedAt: now
    };

    this.logs.push(log);
    return log;
  }

  async findByCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    return this.logs.filter(
      (log) => log.campaignId === campaignId && log.tenantId === tenantId
    );
  }

  async findPageByCampaign(
    campaignId,
    tenantId = DEFAULT_TENANT_ID,
    { page = 1, pageSize = 20 } = {}
  ) {
    const allLogs = (await this.findByCampaign(campaignId, tenantId)).sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt)
    );
    const start = (page - 1) * pageSize;

    return {
      items: allLogs.slice(start, start + pageSize),
      total: allLogs.length,
      page,
      pageSize
    };
  }
}
