import { ok } from '../utils/api-response.js';

export function createAccessLogRoutes({ accessLogService }) {
  if (!accessLogService) {
    throw new TypeError('createAccessLogRoutes requires accessLogService');
  }

  return {
    'GET /api/v1/logs': async (request) => {
      const page = positiveInteger(request.query.page, 1);
      const pageSize = positiveInteger(request.query.pageSize, 20);
      const result = await accessLogService.listLogs({
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
