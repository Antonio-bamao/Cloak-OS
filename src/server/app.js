import { createHealthRoute } from '../routes/health.routes.js';
import { createCampaignRoutes } from '../routes/campaign.routes.js';
import { CampaignService } from '../services/campaign.service.js';
import { InMemoryCampaignRepository } from '../repositories/campaign.repo.js';
import { createHttpServer } from './http-server.js';

export function createApp({
  version,
  campaignService = new CampaignService({
    repository: new InMemoryCampaignRepository()
  })
} = {}) {
  return createHttpServer({
    routes: {
      'GET /health': createHealthRoute({ version }),
      ...createCampaignRoutes({ campaignService })
    }
  });
}
