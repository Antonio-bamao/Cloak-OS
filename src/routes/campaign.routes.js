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
    }),
    'GET /api/v1/campaigns/:id/logs': async (request) => {
      const page = positiveInteger(request.query.page, 1);
      const pageSize = positiveInteger(request.query.pageSize, 20);
      const result = await campaignService.listAccessLogs(request.params.id, {
        page,
        pageSize,
        filters: accessLogFilters(request.query)
      });

      return {
        statusCode: 200,
        body: ok(result.items, 'Access logs fetched', {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total
        })
      };
    }
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function accessLogFilters(query) {
  return {
    verdict: query.verdict,
    action: query.action,
    ipAddress: query.ipAddress,
    from: query.from,
    to: query.to
  };
}
