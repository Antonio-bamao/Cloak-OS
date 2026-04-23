import { AppError } from '../utils/errors.js';

export function createRateLimitedRoute({
  route,
  limiter,
  keyFromRequest = (request) => request.ip ?? 'unknown'
}) {
  return async function rateLimitedRoute(request) {
    const result = limiter.consume(keyFromRequest(request));

    if (!result.allowed) {
      throw new AppError('Too many requests', 429, 'RATE_LIMITED', {
        headers: {
          'Retry-After': String(result.retryAfterSeconds)
        }
      });
    }

    return route(request);
  };
}
