import { createHealthRoute } from '../routes/health.routes.js';
import { createCampaignRoutes } from '../routes/campaign.routes.js';
import { createCloakRoute } from '../routes/cloak.routes.js';
import { createRateLimitedRoute } from '../routes/rate-limit.js';
import { CampaignService } from '../services/campaign.service.js';
import { InMemoryCampaignRepository } from '../repositories/campaign.repo.js';
import { InMemoryAccessLogRepository } from '../repositories/access-log.repo.js';
import { createDefaultDetectionPipeline } from '../core/pipeline-factory.js';
import { InMemoryRateLimiter } from '../utils/rate-limiter.js';
import { createHttpServer } from './http-server.js';

export function createApp({
  version,
  logger,
  config,
  cloakRateLimiter = new InMemoryRateLimiter({ limit: 120, windowMs: 60_000 }),
  campaignService = createDefaultCampaignService({ config })
} = {}) {
  const cloakRoute = createCloakRoute({ campaignService });

  return createHttpServer({
    logger,
    routes: {
      'GET /health': createHealthRoute({ version }),
      ...createCampaignRoutes({ campaignService }),
      'GET /c/:campaignId': createRateLimitedRoute({
        route: cloakRoute,
        limiter: cloakRateLimiter
      })
    }
  });
}

export function createDefaultCampaignService({
  config,
  repository = new InMemoryCampaignRepository(),
  accessLogRepository = new InMemoryAccessLogRepository(),
  botIps = config?.detection?.botIps ?? [],
  botIpSource
} = {}) {
  return new CampaignService({
    repository,
    accessLogRepository,
    pipeline: createDefaultDetectionPipeline({ botIps, botIpSource })
  });
}
