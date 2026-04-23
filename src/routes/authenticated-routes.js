import { AppError } from '../utils/errors.js';

export function createAuthenticatedRoutes(routes, authService) {
  return Object.fromEntries(
    Object.entries(routes).map(([key, handler]) => [
      key,
      async (request) => {
        const result = authService.authenticate(request.headers ?? {});

        if (!result.authenticated) {
          throw new AppError('Authentication required', 401, 'AUTH_REQUIRED', {
            headers: {
              'WWW-Authenticate': 'Bearer'
            }
          });
        }

        return handler(request);
      }
    ])
  );
}
