import { ok } from '../utils/api-response.js';

export function createAnalyticsRoutes({ analyticsService }) {
  if (!analyticsService) {
    throw new TypeError('createAnalyticsRoutes requires analyticsService');
  }

  return {
    'GET /api/v1/analytics/overview': async () => ({
      statusCode: 200,
      body: ok(
        await analyticsService.getOverview(),
        'Analytics overview fetched'
      )
    })
  };
}
