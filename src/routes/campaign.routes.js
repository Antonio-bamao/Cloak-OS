import { ok } from '../utils/api-response.js';

export function createCampaignRoutes({ campaignService }) {
  if (!campaignService) {
    throw new TypeError('createCampaignRoutes requires campaignService');
  }

  return {
    'GET /api/v1/campaigns': async () => ({
      statusCode: 200,
      body: ok(await campaignService.listCampaigns(), 'Campaigns fetched')
    }),
    'POST /api/v1/campaigns': async (request) => ({
      statusCode: 201,
      body: ok(
        await campaignService.createCampaign(request.body),
        'Campaign created'
      )
    }),
    'GET /api/v1/campaigns/:id': async (request) => ({
      statusCode: 200,
      body: ok(
        await campaignService.getCampaign(request.params.id),
        'Campaign fetched'
      )
    })
  };
}
