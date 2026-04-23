import { DEFAULT_TENANT_ID } from '../config/index.js';

export class AccessLogService {
  constructor({ repository } = {}) {
    this.repository = repository;
  }

  async listLogs(
    { page = 1, pageSize = 20, filters = {} } = {},
    tenantId = DEFAULT_TENANT_ID
  ) {
    if (!this.repository?.findPageByTenant) {
      return {
        items: [],
        total: 0,
        page,
        pageSize
      };
    }

    return this.repository.findPageByTenant(tenantId, {
      page,
      pageSize,
      filters
    });
  }
}
