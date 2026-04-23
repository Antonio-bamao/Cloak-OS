export function createCloakRoute({ campaignService }) {
  if (!campaignService) {
    throw new TypeError('createCloakRoute requires campaignService');
  }

  return async function cloakRoute(request) {
    const campaignId = request.params?.campaignId;
    const result = await campaignService.handleVisit(campaignId, {
      ip: request.ip,
      userAgent: getHeader(request.headers, 'user-agent'),
      headers: request.headers ?? {}
    });

    return result.response;
  };
}

function getHeader(headers = {}, name) {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );

  return entry?.[1] ?? '';
}
