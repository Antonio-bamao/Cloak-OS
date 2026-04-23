import { createHealthRoute } from '../routes/health.routes.js';
import { createCampaignRoutes } from '../routes/campaign.routes.js';
import { CampaignService } from '../services/campaign.service.js';
import { InMemoryCampaignRepository } from '../repositories/campaign.repo.js';
import { InMemoryAccessLogRepository } from '../repositories/access-log.repo.js';
import { createDefaultDetectionPipeline } from '../core/pipeline-factory.js';
import { createHttpServer } from './http-server.js';

export function createApp({
  version,
  logger,
  campaignService = createDefaultCampaignService()
} = {}) {
  return createHttpServer({
    logger,
    routes: {
      'GET /health': createHealthRoute({ version }),
      ...createCampaignRoutes({ campaignService })
    }
  });
}

export function createDefaultCampaignService({
  repository = new InMemoryCampaignRepository(),
  accessLogRepository = new InMemoryAccessLogRepository(),
  botIps = [],
  botIpSource
} = {}) {
  return new CampaignService({
    repository,
    accessLogRepository,
    pipeline: createDefaultDetectionPipeline({ botIps, botIpSource })
  });
}
