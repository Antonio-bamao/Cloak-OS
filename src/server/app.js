import { createHealthRoute } from '../routes/health.routes.js';
import { createAdminStaticRoutes } from '../routes/admin-static.routes.js';
import { createCampaignRoutes } from '../routes/campaign.routes.js';
import { createAnalyticsRoutes } from '../routes/analytics.routes.js';
import { createAccessLogRoutes } from '../routes/access-log.routes.js';
import { createCloakRoute } from '../routes/cloak.routes.js';
import { createRateLimitedRoute } from '../routes/rate-limit.js';
import { createAuthenticatedRoutes } from '../routes/authenticated-routes.js';
import { BearerTokenAuthService } from '../auth/bearer-token-auth.service.js';
import { CampaignService } from '../services/campaign.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { AccessLogService } from '../services/access-log.service.js';
import { createRepositories } from '../repositories/factory.js';
import { createDefaultDetectionPipeline } from '../core/pipeline-factory.js';
import { InMemoryRateLimiter } from '../utils/rate-limiter.js';
import { config as defaultConfig } from '../config/index.js';
import { createHttpServer } from './http-server.js';

export function createApp({
  version,
  logger,
  config = defaultConfig,
  postgresClient,
  repositories,
  cloakRateLimiter = new InMemoryRateLimiter({ limit: 120, windowMs: 60_000 }),
  adminAuthService = new BearerTokenAuthService({ token: config.auth.adminToken }),
  campaignService = createDefaultCampaignService({ config, repositories, postgresClient }),
  analyticsService = createDefaultAnalyticsService({ campaignService }),
  accessLogService = createDefaultAccessLogService({ campaignService })
} = {}) {
  const cloakRoute = createCloakRoute({ campaignService });
  const managementRoutes = createAuthenticatedRoutes(
    {
      ...createCampaignRoutes({ campaignService }),
      ...createAccessLogRoutes({ accessLogService }),
      ...createAnalyticsRoutes({ analyticsService })
    },
    adminAuthService
  );

  return createHttpServer({
    logger,
    routes: {
      'GET /health': createHealthRoute({ version }),
      ...createAdminStaticRoutes(),
      ...managementRoutes,
      'GET /c/:campaignId': createRateLimitedRoute({
        route: cloakRoute,
        limiter: cloakRateLimiter
      })
    }
  });
}

export function createDefaultCampaignService({
  config,
  postgresClient,
  repositories = createRepositories({ config, postgresClient }),
  repository = repositories.campaignRepository,
  accessLogRepository = repositories.accessLogRepository,
  botIps = config?.detection?.botIps ?? [],
  botIpSource
} = {}) {
  return new CampaignService({
    repository,
    accessLogRepository,
    pipeline: createDefaultDetectionPipeline({ botIps, botIpSource })
  });
}

export function createDefaultAnalyticsService({
  campaignService,
  campaignRepository = campaignService?.repository,
  accessLogRepository = campaignService?.accessLogRepository
} = {}) {
  return new AnalyticsService({
    campaignRepository,
    accessLogRepository
  });
}

export function createDefaultAccessLogService({
  campaignService,
  repository = campaignService?.accessLogRepository
} = {}) {
  return new AccessLogService({ repository });
}
