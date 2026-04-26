import { ok } from '../utils/api-response.js';

export function createSettingsRoutes({ settingsService }) {
  if (!settingsService) {
    throw new TypeError('createSettingsRoutes requires settingsService');
  }

  return {
    'GET /api/v1/settings': async () => ({
      statusCode: 200,
      body: ok(settingsService.getSettings(), 'Settings fetched')
    })
  };
}
