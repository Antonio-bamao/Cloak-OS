import { createHealthRoute } from '../routes/health.routes.js';
import { createCampaignRoutes } from '../routes/campaign.routes.js';
import { createCloakRoute } from '../routes/cloak.routes.js';
import { createRateLimitedRoute } from '../routes/rate-limit.js';
import { createAuthenticatedRoutes } from '../routes/authenticated-routes.js';
import { BearerTokenAuthService } from '../auth/bearer-token-auth.service.js';
import { CampaignService } from '../services/campaign.service.js';
import { InMemoryCampaignRepository } from '../repositories/campaign.repo.js';
import { InMemoryAccessLogRepository } from '../repositories/access-log.repo.js';
import { createDefaultDetectionPipeline } from '../core/pipeline-factory.js';
import { InMemoryRateLimiter } from '../utils/rate-limiter.js';
import { config as defaultConfig } from '../config/index.js';
import { createHttpServer } from './http-server.js';

export function createApp({
  version,
  logger,
  config = defaultConfig,
  cloakRateLimiter = new InMemoryRateLimiter({ limit: 120, windowMs: 60_000 }),
  adminAuthService = new BearerTokenAuthService({ token: config.auth.adminToken }),
  campaignService = createDefaultCampaignService({ config })
} = {}) {
  const cloakRoute = createCloakRoute({ campaignService });
  const campaignRoutes = createAuthenticatedRoutes(
    createCampaignRoutes({ campaignService }),
    adminAuthService
  );

  return createHttpServer({
    logger,
    routes: {
      'GET /health': createHealthRoute({ version }),
      ...campaignRoutes,
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
