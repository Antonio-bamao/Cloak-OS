import { ok } from '../utils/api-response.js';

export function createHealthRoute({
  now = Date.now,
  startedAt = Date.now(),
  version = '0.1.0'
} = {}) {
  return async function healthRoute() {
    return {
      statusCode: 200,
      body: ok(
        {
          status: 'ok',
          uptimeSeconds: Math.max(0, Math.floor((now() - startedAt) / 1000)),
          version
        },
        'ok'
      )
    };
  };
}
