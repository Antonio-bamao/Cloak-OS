import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../config/index.js';
import { cloneRecord, cloneRecords } from './clone.js';

export class InMemoryAccessLogRepository {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.logs = [];
    this.now = now;
  }

  async create(input) {
    const now = input.createdAt ?? this.now();
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

    this.logs.push(cloneRecord(log));
    return cloneRecord(log);
  }

  async findByCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    const logs = this.logs.filter(
      (log) => log.campaignId === campaignId && log.tenantId === tenantId
    );

    return cloneRecords(logs);
  }

  async findAllByTenant(tenantId = DEFAULT_TENANT_ID) {
    const logs = this.logs.filter((log) => log.tenantId === tenantId);

    return cloneRecords(logs);
  }

  async findPageByCampaign(
    campaignId,
    tenantId = DEFAULT_TENANT_ID,
    {
      page = 1,
      pageSize = 20,
      filters = {}
    } = {}
  ) {
    return paginateLogs(await this.findByCampaign(campaignId, tenantId), {
      page,
      pageSize,
      filters
    });
  }

  async findPageByTenant(
    tenantId = DEFAULT_TENANT_ID,
    {
      page = 1,
      pageSize = 20,
      filters = {}
    } = {}
  ) {
    return paginateLogs(await this.findAllByTenant(tenantId), {
      page,
      pageSize,
      filters
    });
  }

  async deleteByCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    const before = this.logs.length;
    this.logs = this.logs.filter(
      (log) => log.campaignId !== campaignId || log.tenantId !== tenantId
    );

    return before - this.logs.length;
  }
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function paginateLogs(logs, { page, pageSize, filters }) {
  const normalizedPage = positiveInteger(page, 1);
  const normalizedPageSize = positiveInteger(pageSize, 20);
  const allLogs = logs
    .filter((log) => matchesFilters(log, filters))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: allLogs.slice(start, start + normalizedPageSize),
    total: allLogs.length,
    page: normalizedPage,
    pageSize: normalizedPageSize
  };
}

function matchesFilters(log, filters) {
  if (filters.verdict && log.verdict !== filters.verdict) {
    return false;
  }

  if (filters.action && log.action !== filters.action) {
    return false;
  }

  if (filters.ipAddress && log.ipAddress !== filters.ipAddress) {
    return false;
  }

  if (filters.from && log.createdAt < filters.from) {
    return false;
  }

  if (filters.to && log.createdAt > filters.to) {
    return false;
  }

  return true;
}
