import { AppError } from '../utils/errors.js';
import { InMemoryAccessLogRepository } from './access-log.repo.js';
import { InMemoryCampaignRepository } from './campaign.repo.js';
import { PostgresAccessLogRepository } from './postgres/access-log.repo.js';
import { PostgresCampaignRepository } from './postgres/campaign.repo.js';

export function createRepositories({
  config,
  postgresClient,
  now
} = {}) {
  const driver = config?.repository?.driver ?? 'memory';

  if (driver === 'memory') {
    return {
      campaignRepository: new InMemoryCampaignRepository({ now }),
      accessLogRepository: new InMemoryAccessLogRepository({ now })
    };
  }

  if (driver === 'postgres') {
    if (!postgresClient) {
      throw new AppError(
        'repository.driver=postgres requires an injected postgresClient',
        500,
        'REPOSITORY_CLIENT_REQUIRED'
      );
    }

    return {
      campaignRepository: new PostgresCampaignRepository({ client: postgresClient, now }),
      accessLogRepository: new PostgresAccessLogRepository({ client: postgresClient, now })
    };
  }

  throw new AppError(
    `Unsupported repository driver: ${driver}`,
    500,
    'REPOSITORY_DRIVER_UNSUPPORTED'
  );
}
