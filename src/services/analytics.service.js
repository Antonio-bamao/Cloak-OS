import { DEFAULT_TENANT_ID } from '../config/index.js';

const VERDICTS = ['human', 'bot', 'suspicious'];
const ACTIONS = ['money', 'safe', 'block'];

export class AnalyticsService {
  constructor({ campaignRepository, accessLogRepository } = {}) {
    if (!campaignRepository) {
      throw new TypeError('AnalyticsService requires a campaignRepository');
    }

    this.campaignRepository = campaignRepository;
    this.accessLogRepository = accessLogRepository;
  }

  async getOverview(tenantId = DEFAULT_TENANT_ID) {
    const campaigns = await this.campaignRepository.findAll(tenantId);
    const logs = await this.findLogsByTenant(tenantId);

    return {
      campaignCount: campaigns.length,
      totalVisits: logs.length,
      verdicts: countBy(logs, 'verdict', VERDICTS),
      actions: countBy(logs, 'action', ACTIONS)
    };
  }

  async findLogsByTenant(tenantId) {
    if (!this.accessLogRepository?.findAllByTenant) {
      return [];
    }

    return this.accessLogRepository.findAllByTenant(tenantId);
  }
}

function countBy(items, field, knownValues) {
  const counts = Object.fromEntries(knownValues.map((value) => [value, 0]));

  for (const item of items) {
    if (Object.hasOwn(counts, item[field])) {
      counts[item[field]] += 1;
    }
  }

  return counts;
}
